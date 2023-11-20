import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'

import serialize from '@nuxt/devalue'

import type { Plugin } from 'vite'
import type { PresetConfig } from './presets'
import {
  apiFactory,
  formatFor,
  type API,
  type PresetAttr as TPresetAttr,
  type BGAttr as TBGAttr,
  type ImageAttr as TImageAttr,
} from './api'

const VIRTUAL_ID = '/@imagepresets'

export default function ImagePlugin({ presets, options }: Props): Plugin {
  let api: API
  let config: Config

  return {
    /** required: Names the plugin */
    name: 'image-gen',
    /** [When to run](https://vitejs.dev/guide/api-plugin#plugin-ordering) */
    enforce: 'pre',
    /**
     * Vite Hook called after the vite config is resolved.
     * https://vitejs.dev/guide/api-plugin#configresolved
     */
    configResolved: async ({ build: { assetsDir }, base, command, root }) => {
      config = {
        assetsDir,
        base,
        cacheDir: join(root, 'node_modules', '.images'),
        isBuild: command === 'build',
        // from plugin instantiation
        presets,
        purgeCache: true,
        root,
        urlParam: 'preset',
        writeToBundle: true,

        // from plugin instantiation, overrides the above
        ...options,
      }
      api = apiFactory(config, VIRTUAL_ID)
      if (config.isBuild) await mkdir(config.cacheDir, { recursive: true })
    },
    /**
     * Vite Hook for configuring the dev server.
     * https://vitejs.dev/guide/api-plugin#configureserver
     */
    configureServer: (server) => {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith(VIRTUAL_ID)) {
          const id = req.url.split(VIRTUAL_ID)[1]
          const image = await api.getImage(id)

          if (!image) {
            console.error(`image not found: ${id}`)
            res.statusCode = 404
            return res.end()
          }

          res.setHeader('Content-Type', `image/${await formatFor(image)}`)
          res.setHeader('Cache-Control', 'max-age=360000')

          return image
            .clone()
            .on('error', (e) => console.error(e))
            .pipe(res)
        }

        next()
      })
    },
    /**
     * Rollup Build Hook called before the files are written in build
     * Gathers generated images and adds them to the output files to write.
     * https://rollupjs.org/plugin-development/#generatebundle
     */
    generateBundle: async (_, output) => {
      if (!config.writeToBundle) return
      const images = await api.getImages()
      for (const image of images) output[image.fileName] = image
      api.purgeCache(images)
    },
    /**
     * Rollup Build Hook called on each incoming module request
     * This is a loader that checks the module request for the
     * presence of a preset, and returns the resolved image
     * https://rollupjs.org/plugin-development/#load
     */
    load: async (id) => {
      const parsedId = parseId(id)
      if (!(config.urlParam in parsedId.query)) return

      const image = await api.generateImage(parsedId)
      return `export default ${serialize(image)}`
    },
  }
}

/** parse the incoming module as a URL */
function parseId(id: string): ParsedId {
  const index = id.indexOf('?')

  if (index < 0) return { path: id, query: {} }
  return {
    path: id.slice(0, index),
    query: Object.fromEntries(new URLSearchParams(id.slice(index))),
  }
}

export type Config = Options & {
  /** whether we are running a build (true) or in dev mode (false) */
  isBuild: boolean
  /** Base public path when served in development or production. */
  base: string
  /** Project root directory. Can be an absolute path, or a path relative from the location of the config file itself. */
  root: string
}
export type ParsedId = { path: string; query: Record<string, string> }
export type PresetAttr = TPresetAttr
export type ImageAttr = TImageAttr
export type BGAttr = TBGAttr

type Props = {
  /** The presets for this project */
  presets: Preset
  /** Override default configuration */
  options?: Partial<Options>
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

type Preset = Record<string, PresetConfig>
