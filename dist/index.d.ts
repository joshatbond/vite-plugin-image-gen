import { Plugin } from 'vite';
import { PresetConfig } from './presets.js';
import 'sharp';

type PresetAttr$1 = BGAttr$1 | ImageAttr$1;
type BGAttr$1 = {
    _type: 'bg';
    /** the url of the largest image */
    src: string;
    /** a complete image-set CSS attribute */
    imageSet: string;
    /** a srcset attribute for preloading, identical to the image-set */
    srcset: string;
};
type ImageAttr$1 = {
    _type: 'img';
    src: string;
    srcset: string;
    height?: number;
    width?: number;
};

declare function ImagePlugin({ presets, options }: Props): Plugin;
type Config = Options & {
    /** whether we are running a build (true) or in dev mode (false) */
    isBuild: boolean;
    /** Base public path when served in development or production. */
    base: string;
    /** Project root directory. Can be an absolute path, or a path relative from the location of the config file itself. */
    root: string;
};
type ParsedId = {
    path: string;
    query: Record<string, string>;
};
type PresetAttr = PresetAttr$1;
type ImageAttr = ImageAttr$1;
type BGAttr = BGAttr$1;
type Props = {
    /** The presets for this project */
    presets: Preset;
    /** Override default configuration */
    options?: Partial<Options>;
};
type Options = {
    /**
     * The directory in which to place processed images, relative to Vite's `outDir`.
     * @default 'assets/images'
     */
    assetsDir: string;
    /**
     * The directory to use for caching images between builds.
     * @default 'node_modules/.images'
     */
    cacheDir: string;
    /**
     * Definitions of image presets to apply.
     */
    presets: Preset;
    /**
     * URL parameter that specifies the image preset.
     * @default 'preset'
     */
    urlParam: string;
    /**
     * Whether to remove cached files that are no longer used.
     * @default true
     */
    purgeCache: boolean;
    /**
     * Whether to write generated images in the bundle.
     * @default true
     */
    writeToBundle: boolean;
};
type Preset = Record<string, PresetConfig>;

export { type BGAttr, type Config, type ImageAttr, type ParsedId, type PresetAttr, ImagePlugin as default };
