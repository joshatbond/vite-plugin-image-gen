import sharp, { ResizeOptions, AvifOptions, GifOptions, HeifOptions, JpegOptions, PngOptions, TiffOptions, WebpOptions } from 'sharp';

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
declare function densityPreset(props: DensityProps): PresetConfig;
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
declare function widthPreset(props: WidthProps): PresetConfig;
type DensityBase = PresetBase & {
    /**
     * Target height for the highest density variant.
     * Lower density variants are scaled down from this value.
     */
    baseHeight?: number;
    /**
     * Target width for the highest density variant.
     * Lower density variants are scaled down from this value.
     */
    baseWidth?: number;
    /**
     * Return background-image style output (`imageSet`) instead of standard image
     * `srcset` attributes.
     */
    isBackgroundImage?: boolean;
};
type DensityProps = DensityBase & {
    /**
     * Pixel density variants to generate.
     *
     * @example
     * density: [1, 2] // generates 1x and 2x outputs
     */
    density: number[];
    /**
     * Output format configuration.
     * Use `'original'` to keep the input format, or provide one format option
     * object like `{ webp: { quality: 80 } }`.
     */
    format: AllowedFormat;
};
type DensityArgs = DensityBase & {
    preset: 'density';
    density: number;
    format: FormatArg;
};
type PresetBase = {
    /**
     * Additional options forwarded to `sharp.resize(...)`.
     * Useful for setting `fit`, `position`, etc.
     */
    resizeOptions?: ResizeOptions;
    /**
     * Optional hook to customize each generated image variant.
     * Receives the in-progress Sharp instance and preset-specific args.
     */
    withImage?: ImageGenerator;
    /**
     * Include intrinsic `width` and `height` in returned attributes.
     *
     * This can be helpful for avoiding layout shift in `<img>` usage.
     */
    inferDimensions?: boolean;
};
type WidthProps = PresetBase & {
    format: AllowedFormat;
} & (OriginalWidth | ModifiedWidth);
type OriginalWidth = {
    /** Keep a single output at the image's original width. */
    widths: 'original';
};
type ModifiedWidth = {
    /**
     * Width descriptors to generate for `srcset`.
     *
     * @example
     * widths: [320, 640, 960]
     */
    widths: number[];
    /**
     * Scalar multiplier applied to each configured width.
     *
     * @example
     * widths: [400, 800], density: 2 // outputs 800w and 1600w
     */
    density?: number;
};
type WidthArgs = PresetBase & {
    preset: 'width';
    width: number | 'original';
    density?: number;
    format: FormatArg;
};
type Image = sharp.Sharp;
type ImageFormatOptions = {
    avif: AvifOptions;
    gif: GifOptions;
    heif: HeifOptions;
    jpeg: JpegOptions;
    jpg: JpegOptions;
    png: PngOptions;
    tiff: TiffOptions;
    tif: TiffOptions;
    webp: WebpOptions;
};
type ImageFormat = ExactlyOne<ImageFormatOptions>;
type ImageFormatKeys = keyof ImageFormat;
type ImageFormatValues = ValueOf<ImageFormat>;
type OriginalFormatArg = {
    type: 'original';
    options?: undefined;
};
type TransformedFormatArg = {
    type: ImageFormatKeys;
    options?: ImageFormatValues;
};
type FormatArg = OriginalFormatArg | TransformedFormatArg;
type AllowedFormat = ImageFormat | 'original';
type ImageGenerator = (img: Image, args: PresetArgs) => Image | Promise<Image>;
/**
 * Internal normalized preset configuration consumed by the plugin.
 */
type PresetConfig = {
    inferDimensions: boolean;
    /** only defined if using density preset */
    isBackgroundImage?: boolean;
    image: {
        type?: string;
        specs: PresetSpec[];
    };
};
type PresetSpec = {
    /** The parameters for the image generation function. */
    args: PresetArgs;
    /**
     * A condition descriptor that specifies when the image should be used.
     * Can be a width descriptor or a density descriptor.
     * https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/srcset
     */
    condition: string;
    /** A function to generate the image */
    generate: ImageGenerator;
};
/**
 * Union of arguments passed to `withImage` callback functions.
 * Use `args.preset` to discriminate between width and density variants.
 */
type PresetArgs = DensityArgs | WidthArgs;
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
type ExpandPropsToUnion<Obj, ObjKey extends keyof Obj> = ObjKey extends unknown ? {
    [Prop in keyof Obj]: Prop extends ObjKey ? Obj[Prop] : never;
} : never;
type AtMostOne<Obj> = ExpandPropsToUnion<Partial<Obj>, keyof Obj>;
type AtLeastOne<Obj, ObjPropUnion = {
    [Key in keyof Obj]: Pick<Obj, Key>;
}> = Partial<Obj> & ValueOf<ObjPropUnion>;
type ExactlyOne<T> = AtMostOne<T> & AtLeastOne<T>;
type ValueOf<Obj> = Obj[keyof Obj];

export { type Image, type ImageFormatKeys, type ImageGenerator, type PresetArgs, type PresetConfig, densityPreset, widthPreset };
