import sharp, { ResizeOptions, AvifOptions, GifOptions, HeifOptions, JpegOptions, PngOptions, TiffOptions, WebpOptions } from 'sharp';

declare function densityPreset(props: DensityProps): PresetConfig;
declare function widthPreset(props: WidthProps): PresetConfig;
type DensityBase = PresetBase & {
    /** modify the image to a new height, maintaining aspect ratio */
    baseHeight?: number;
    /** modify the image to a new width, maintaining aspect ratio */
    baseWidth?: number;
    /** Setting this flag will generate an `imageSet` instead of a `srcset` */
    isBackgroundImage?: boolean;
};
type DensityProps = DensityBase & {
    /**
     * @description The desired image density
     * @example `density: [1, 2]` -> 1x, 2x images generated
     */
    density: number[];
    /** Convert the original image to a new format */
    format: AllowedFormat;
};
type DensityArgs = DensityBase & {
    density: number;
    format: {
        type: AllowedFormatKeys;
        options: ImageFormatValues;
    };
};
type PresetBase = {
    /** Specify specific sharp resize options to use */
    resizeOptions?: ResizeOptions;
    /** Customize the image generator */
    withImage?: ImageGenerator;
    /**
     * Should the plugin expose the intrinsic width and height of the image as
     * additional properties in the returned value?
     */
    inferDimensions?: boolean;
};
type WidthProps = PresetBase & {
    format: AllowedFormat;
} & (OriginalWidth | ModifiedWidth);
type OriginalWidth = {
    /** maintain original image size */
    widths: 'original';
};
type ModifiedWidth = {
    /** A list of image widths to generate */
    widths: number[];
    /** Modify the width by some scalar amount */
    density?: number;
};
type WidthArgs = PresetBase & {
    density?: number;
    format: {
        type: AllowedFormatKeys;
        options: ImageFormatValues;
    };
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
type AllowedFormat = ImageFormat | 'original';
type AllowedFormatKeys = keyof ImageFormat | 'original';
type ImageGenerator = (img: Image, args: PresetArgs) => Image | Promise<Image>;
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
