import type { Plugin } from 'vite'

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
type Preset = Record<string, unknown>
