import sharp from 'sharp'
import type {
  AvifOptions,
  GifOptions,
  HeifOptions,
  JpegOptions,
  PngOptions,
  ResizeOptions,
  TiffOptions,
  WebpOptions,
} from 'sharp'

/**
 * Create a density-based preset (for example `1x`, `2x`, `3x`).
 *
 * Use this when you want a `srcset` (or CSS `image-set`) driven by pixel density
 * rather than viewport width.
 *
 * @example
 * const retina = densityPreset({
 *   density: [1, 2],
 *   baseWidth: 1200,
 *   format: { webp: { quality: 80 } },
 * })
 */
export function densityPreset(props: DensityProps): PresetConfig {
  const {
    baseHeight,
    baseWidth,
    density,
    format,
    inferDimensions = false,
    isBackgroundImage = false,
    resizeOptions,
    withImage,
  } = props
  const formatKey =
    format == 'original' ? format : (Object.keys(format)[0] as ImageFormatKeys)
  const formatValue =
    format == 'original'
      ? undefined
      : (format[formatKey as ImageFormatKeys] as ImageFormatValues)
  const sortedDensity = [...density].sort((a, b) => a - b)

  const highestDensity = sortedDensity.reduce((a, v) => (v >= a ? v : a), 1)

  return {
    inferDimensions,
    isBackgroundImage,
    image: {
      type: mimeTypeFor(formatKey),
      specs: sortedDensity.map((density) =>
        cleanObject({
          condition: `${density}x`,
          args: {
            ...props,
            preset: 'density',
            density: density / highestDensity,
            format: toFormatArg(formatKey, formatValue),
          },
          generate: async (img, args) => {
            const {
              density,
              format: { type, options },
            } = args as DensityArgs
            if (type != 'original') {
              img = img.toFormat(type, options)
            }
            if (density) {
              if (baseHeight || baseWidth) {
                img = img.resize({
                  width: x(density, baseWidth),
                  height: x(density, baseHeight),
                  withoutEnlargement: true,
                  ...resizeOptions,
                })
              } else {
                const { width } = await img.metadata()
                img = img.resize({ width: x(density, width) })
              }
            }

            return (
              (await withImage?.(img, {
                preset: 'density',
                density,
                format: toFormatArg(type, options),
              })) ?? img
            )
          },
        })
      ),
    },
  }
}
/**
 * Create a width-based preset (for example `320w`, `640w`, `1280w`).
 *
 * Use this for responsive `<img>` `srcset` generation where the browser selects
 * the best candidate using `sizes`.
 *
 * @example
 * const responsive = widthPreset({
 *   widths: [320, 640, 960, 1280],
 *   format: { avif: { quality: 60 } },
 *   inferDimensions: true,
 * })
 */
export function widthPreset(props: WidthProps): PresetConfig {
  const { format, inferDimensions = false, resizeOptions, withImage } = props
  const formatKey =
    format == 'original' ? format : (Object.keys(format)[0] as ImageFormatKeys)
  const formatValue =
    format == 'original'
      ? undefined
      : (format[formatKey as ImageFormatKeys] as ImageFormatValues)
  const widths: Array<number | 'original'> =
    props.widths === 'original' ? ['original'] : props.widths
  const density = props.widths === 'original' ? undefined : props.density ?? 1
  const sortedWidths = [...widths].sort((a, b) => {
    if (typeof a == 'string' || typeof b == 'string') return 0
    return a - b
  })

  return {
    inferDimensions,
    image: {
      type: mimeTypeFor(formatKey),
      specs: sortedWidths.map((width) =>
        cleanObject({
          condition: width === 'original' ? '' : `${width}w`,
          args: {
            preset: 'width',
            format: toFormatArg(formatKey, formatValue),
            width,
            density,
            resizeOptions,
          },
          generate: async (img, args) => {
            if (formatKey !== 'original') {
              img = img.toFormat(formatKey, formatValue)
            }
            if (width !== 'original' && typeof width == 'number') {
              img = img.resize({
                width: x(width, density),
                withoutEnlargement: true,
                ...resizeOptions,
              })
            }

            return (await withImage?.(img, args)) ?? img
          },
        })
      ),
    },
  }
}

function mimeTypeFor(format: AllowedFormatKeys) {
  return format == 'original'
    ? undefined
    : format == 'jpg'
    ? 'jpeg'
    : `image/${format}`
}
function toFormatArg(
  type: AllowedFormatKeys,
  options: ImageFormatValues | undefined
): FormatArg {
  if (type === 'original') return { type }
  return { type, options }
}
function cleanObject<T extends Record<string, unknown>>(obj: T): T {
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) delete obj[key]
    else if (isObject(value)) cleanObject(value)
  }

  return obj
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && !Array.isArray(value) && value !== null
}
function x(quantity: number, n?: number) {
  return n ? Math.floor(quantity * n) : undefined
}

type DensityBase = PresetBase & {
  /**
   * Target height for the highest density variant.
   * Lower density variants are scaled down from this value.
   */
  baseHeight?: number
  /**
   * Target width for the highest density variant.
   * Lower density variants are scaled down from this value.
   */
  baseWidth?: number
  /**
   * Return background-image style output (`imageSet`) instead of standard image
   * `srcset` attributes.
   */
  isBackgroundImage?: boolean
}
type DensityProps = DensityBase & {
  /**
   * Pixel density variants to generate.
   *
   * @example
   * density: [1, 2] // generates 1x and 2x outputs
   */
  density: number[]
  /**
   * Output format configuration.
   * Use `'original'` to keep the input format, or provide one format option
   * object like `{ webp: { quality: 80 } }`.
   */
  format: AllowedFormat
}
type DensityArgs = DensityBase & {
  preset: 'density'
  density: number
  format: FormatArg
}
type PresetBase = {
  /**
   * Additional options forwarded to `sharp.resize(...)`.
   * Useful for setting `fit`, `position`, etc.
   */
  resizeOptions?: ResizeOptions
  /**
   * Optional hook to customize each generated image variant.
   * Receives the in-progress Sharp instance and preset-specific args.
   */
  withImage?: ImageGenerator
  /**
   * Include intrinsic `width` and `height` in returned attributes.
   *
   * This can be helpful for avoiding layout shift in `<img>` usage.
   */
  inferDimensions?: boolean
}
type WidthProps = PresetBase & { format: AllowedFormat } & (
  | OriginalWidth
  | ModifiedWidth
)
type OriginalWidth = {
  /** Keep a single output at the image's original width. */
  widths: 'original'
}
type ModifiedWidth = {
  /**
   * Width descriptors to generate for `srcset`.
   *
   * @example
   * widths: [320, 640, 960]
   */
  widths: number[]
  /**
   * Scalar multiplier applied to each configured width.
   *
   * @example
   * widths: [400, 800], density: 2 // outputs 800w and 1600w
   */
  density?: number
}
type WidthArgs = PresetBase & {
  preset: 'width'
  width: number | 'original'
  density?: number
  format: FormatArg
}

export type Image = sharp.Sharp
type ImageFormatOptions = {
  avif: AvifOptions
  gif: GifOptions
  heif: HeifOptions
  jpeg: JpegOptions
  jpg: JpegOptions
  png: PngOptions
  tiff: TiffOptions
  tif: TiffOptions
  webp: WebpOptions
}
type ImageFormat = ExactlyOne<ImageFormatOptions>
export type ImageFormatKeys = keyof ImageFormat
type ImageFormatValues = ValueOf<ImageFormat>
type OriginalFormatArg = { type: 'original'; options?: undefined }
type TransformedFormatArg = {
  type: ImageFormatKeys
  options?: ImageFormatValues
}
type FormatArg = OriginalFormatArg | TransformedFormatArg
type AllowedFormat = ImageFormat | 'original'
type AllowedFormatKeys = keyof ImageFormat | 'original'
export type ImageGenerator = (
  img: Image,
  args: PresetArgs
) => Image | Promise<Image>
/**
 * Internal normalized preset configuration consumed by the plugin.
 */
export type PresetConfig = {
  inferDimensions: boolean
  /** only defined if using density preset */
  isBackgroundImage?: boolean
  image: {
    type?: string
    specs: PresetSpec[]
  }
}
type PresetSpec = {
  /** The parameters for the image generation function. */
  args: PresetArgs
  /**
   * A condition descriptor that specifies when the image should be used.
   * Can be a width descriptor or a density descriptor.
   * https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/srcset
   */
  condition: string
  /** A function to generate the image */
  generate: ImageGenerator
}
/**
 * Union of arguments passed to `withImage` callback functions.
 * Use `args.preset` to discriminate between width and density variants.
 */
export type PresetArgs = DensityArgs | WidthArgs

/**
 * Map over an object (T), and for each member of keyof T -> return a union of types
 * @example
 * given:
 * type Foo = {
 *   a: number;
 *   b: string;
 *   c: boolean;
 * }
 * type SplitFoo = Split<Foo>;
 *
 * will have the following surface:
 *
 * type SplitFoo = { a: number; b: never; c: never } | { a: never; b: string; c: never; } | { a: never; b: never; c: boolean }
 */
type ExpandPropsToUnion<Obj, ObjKey extends keyof Obj> = ObjKey extends unknown
  ? { [Prop in keyof Obj]: Prop extends ObjKey ? Obj[Prop] : never }
  : never

// Create the exploded object type
// In order for this to work the member properties need to be Partial
type AtMostOne<Obj> = ExpandPropsToUnion<Partial<Obj>, keyof Obj>

// Ensure that at least one property is defined
type AtLeastOne<
  Obj,
  ObjPropUnion = { [Key in keyof Obj]: Pick<Obj, Key> }
> = Partial<Obj> & ValueOf<ObjPropUnion>

// Using an intersection, we can ensure that exactly one member is included
type ExactlyOne<T> = AtMostOne<T> & AtLeastOne<T>

type ValueOf<Obj> = Obj[keyof Obj]
