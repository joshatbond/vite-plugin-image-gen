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

  const highestDensity = density
    .sort((a, b) => a - b)
    .reduce((a, v) => (v >= a ? v : a), 1)

  return {
    inferDimensions,
    isBackgroundImage,
    image: {
      type: mimeTypeFor(formatKey),
      specs: density
        .sort((a, b) => a - b)
        .map((density) =>
          cleanObject({
            condition: `${density}x`,
            args: {
              ...props,
              preset: 'density',
              density: density / highestDensity,
              format: { type: formatKey, options: formatValue },
            },
            generate: async (img, { density, format: { type, options } }) => {
              if (type != 'original') {
                img = img.toFormat(type, options)
              }
              if (density) {
                if (baseHeight || baseWidth) {
                  img = img.resize({
                    width: x(density / highestDensity, baseWidth),
                    height: x(density / highestDensity, baseHeight),
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
                  density,
                  format: { type, options },
                })) ?? img
              )
            },
          })
        ),
    },
  }
}
export function widthPreset(props: WidthProps): PresetConfig {
  const { format, inferDimensions = false, resizeOptions, withImage } = props
  const formatKey =
    format == 'original' ? format : (Object.keys(format)[0] as ImageFormatKeys)
  const formatValue =
    format == 'original'
      ? undefined
      : (format[formatKey as ImageFormatKeys] as ImageFormatValues)
  const widths = props.widths == 'original' ? ['original'] : props.widths
  const density = props.widths === 'original' ? undefined : props.density ?? 1

  return {
    inferDimensions,
    image: {
      type: mimeTypeFor(formatKey),
      specs: widths
        .sort((a, b) => {
          if (typeof a == 'string' || typeof b == 'string') return 0
          return a - b
        })
        .map((width) =>
          cleanObject({
            condition: width === 'original' ? '' : `${width}w`,
            args: {
              preset: 'width',
              format: { type: formatKey, options: formatValue },
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
  /** modify the image to a new height, maintaining aspect ratio */
  baseHeight?: number
  /** modify the image to a new width, maintaining aspect ratio */
  baseWidth?: number
  /** Setting this flag will generate an `imageSet` instead of a `srcset` */
  isBackgroundImage?: boolean
}
type DensityProps = DensityBase & {
  /**
   * @description The desired image density
   * @example `density: [1, 2]` -> 1x, 2x images generated
   */
  density: number[]
  /** Convert the original image to a new format */
  format: AllowedFormat
}
type DensityArgs = DensityBase & {
  density: number
  format: { type: AllowedFormatKeys; options: ImageFormatValues }
}
type PresetBase = {
  /** Specify specific sharp resize options to use */
  resizeOptions?: ResizeOptions
  /** Customize the image generator */
  withImage?: ImageGenerator
  /**
   * Should the plugin expose the intrinsic width and height of the image as
   * additional properties in the returned value?
   */
  inferDimensions?: boolean
}
type WidthProps = PresetBase & { format: AllowedFormat } & (
    | OriginalWidth
    | ModifiedWidth
  )
type OriginalWidth = {
  /** maintain original image size */
  widths: 'original'
}
type ModifiedWidth = {
  /** A list of image widths to generate */
  widths: number[]
  /** Modify the width by some scalar amount */
  density?: number
}
type WidthArgs = PresetBase & {
  density?: number
  format: { type: AllowedFormatKeys; options: ImageFormatValues }
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
type AllowedFormat = ImageFormat | 'original'
type AllowedFormatKeys = keyof ImageFormat | 'original'
export type ImageGenerator = (
  img: Image,
  args: PresetArgs
) => Image | Promise<Image>
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
