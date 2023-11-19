import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'

import serialize from '@nuxt/devalue'

import type { Plugin } from 'vite'
import type { Sharp } from 'sharp'
import type { OutputAsset } from 'rollup'

const VIRTUAL_ID = '@imagepresets'

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
      api = apiFactory(config)
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

function apiFactory(config: Config): API {
  // Used in dev and build to ensure images are loaded only once
  const requestedImagesById: Record<string, Sharp | Promise<Sharp>> = {}

  // Used in build to optimize file lookups and prevent duplicate processing
  const generatedImages: Promise<OutputAsset>[] = []

  return {
    getImage: async (id) => {
      if (!id) throw new Error('No id provided')
      if (!(id in requestedImagesById))
        throw new Error(`${id} not found in cache`)

      return await requestedImagesById[id]!
    },
    getImages: async () => await Promise.all(generatedImages),
    // TODO: Implement
    generateImage: async () => '',
    // TODO: Implement
    purgeCache: async () => {},
  }
}

// TODO: Implement
// TODO: better format types
/** Retrieve the image format for a given image */
declare function formatFor(image: Sharp): Promise<string>

// TODO: Implement
/** parse the incoming module as a URL */
declare function parseId(id: string): ParsedId

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
  /** Retrieve a single */
  getImage: (id?: string) => Promise<Sharp>
  /** Retrieve all images */
  getImages: () => Promise<OutputAsset[]>
  /** Remove unused files (i.e: not imported) from the cache */
  purgeCache: (images: OutputAsset[]) => void
  /** Generate all permutations of an image based on a given preset */
  generateImage: (id: ParsedId) => Promise<string>
}
type ParsedId = { path: string; query: Record<string, string> }
