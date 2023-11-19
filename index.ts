import type { Plugin } from 'vite'
import type { Sharp } from 'sharp'
import type { OutputAsset } from 'rollup'

export default function ImagePlugin({ presets, options }: Props): Plugin {
  return {
    /** required: Names the plugin */
    name: 'image-gen',
    /** [When to run](https://vitejs.dev/guide/api-plugin#plugin-ordering) */
    enforce: 'pre',
    /**
     * Vite Hook called after the vite config is resolved.
     * https://vitejs.dev/guide/api-plugin#configresolved
     */
    configResolved: async () => {},
    /**
     * Vite Hook for configuring the dev server.
     * https://vitejs.dev/guide/api-plugin#configureserver
     */
    configureServer: async () => {},
    /**
     * Rollup Build Hook called before the files are written in build
     * Gathers generated images and adds them to the output files to write.
     * https://rollupjs.org/plugin-development/#generatebundle
     */
    generateBundle: async () => {},
    /**
     * Rollup Build Hook called on each incoming module request
     * This is a loader that checks the module request for the
     * presence of a preset, and returns the resolved image
     * https://rollupjs.org/plugin-development/#load
     */
    load: async () => {},
  }
}

function apiFactory(config: Config): API {
  // Used in dev and build to ensure images are loaded only once
  const requestedImagesById: Record<string, Sharp | Promise<Sharp>> = {}

  // Used in build to optimize file lookups and prevent duplicate processing
  const generatedImages: Promise<OutputAsset>[] = []

  return {
    getImage: async (id) => {
      if (id in requestedImagesById) return await requestedImagesById[id]!
      throw new Error(`${id} not found in cache`)
    },
    getImages: async () => await Promise.all(generatedImages),
    generateImage: async () => '',
    purgeCache: async () => {},
  }
}

type Props = {
  /** The presets for this project */
  presets: Preset
  /** Override default configuration */
  options: Partial<Options>
}

type Options = {
  /**
   * The directory in which to place processed images, relative to Vite's `outDir`.
   * @default 'assets/images'
   */
  assetsDir: string
  /**
   * The directory to use for caching images between builds.
   * @default 'node_modules/.images'
   */
  cacheDir: string
  /**
   * Definitions of image presets to apply.
   */
  presets: Preset
  /**
   * URL parameter that specifies the image preset.
   * @default 'preset'
   */
  urlParam: string
  /**
   * Whether to remove cached files that are no longer used.
   * @default true
   */
  purgeCache: boolean
  /**
   * Whether to write generated images in the bundle.
   * @default true
   */
  writeToBundle: boolean
}
type Config = Options & {
  /** whether we are running a build (true) or in dev mode (false) */
  isBuild: boolean
  /** Base public path when served in development or production. */
  base: string
  /** Project root directory. Can be an absolute path, or a path relative from the location of the config file itself. */
  root: string
}
type Preset = Record<string, unknown>
type API = {
  getImage: (id: string) => Promise<Sharp>
  getImages: () => Promise<OutputAsset[]>
  purgeCache: (images: OutputAsset[]) => void
  generateImage: (id: ParsedId) => Promise<string>
}
type ParsedId = { path: string; query: Record<string, string> }
