import { basename, extname, join, resolve } from 'node:path'
import {
  access,
  constants,
  mkdir,
  readFile,
  readdir,
  rm,
} from 'node:fs/promises'

import serialize from '@nuxt/devalue'

import type { Plugin } from 'vite'
import type { Sharp } from 'sharp'
import type { OutputAsset } from 'rollup'
import sharp from 'sharp'
import type {
  Image,
  ImageFormatKeys,
  ImageGenerator,
  PresetArgs,
  PresetConfig,
} from './presets'
import { createHash } from 'node:crypto'

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
  const imageFilenamesById: Record<string, Promise<string>> = {}
  const imageHashesByFile: Record<string, Promise<string>> = {}

  return {
    getImage: async (id) => {
      if (!id) throw new Error('No id provided')
      if (!(id in requestedImagesById))
        throw new Error(`${id} not found in cache`)

      return await requestedImagesById[id]!
    },
    getImages: async () => await Promise.all(generatedImages),
    generateImage: async ({ path: filename, query }) => {
      const { [config.urlParam]: presetName } = query
      if (!presetName)
        throw new Error('vite-plugin-image-gen: No preset was defined')
      const preset = config.presets[presetName]

      if (!preset)
        throw new Error(
          `vite-plugin-image-gen: Unknown image preset '${presetName}'`
        )

      const sourceSet = await Promise.all(
        preset.image.specs.map(async ({ condition, args, generate }) => [
          encodeURI(await getImageSrc(filename, args, generate)),
          condition,
        ])
      )

      // choose the largest size to be the source
      const source = sourceSet[sourceSet.length - 1]
      if (!source || !source[0])
        throw new Error(
          `vite-plugin-image-gen: The image ${filename} doesn't seem to exist`
        )

      if (preset.isBackgroundImage) {
        const src = `url(${source[0]})`
        const imageSet = sourceSet
          .map((s) => `url(${s.filter(Boolean).join(' ')})`)
          .join(', ')

        return {
          _type: 'bg',
          src,
          imageSet,
        } satisfies BGAttr
      } else {
        let imageWidth = undefined
        let imageHeight = undefined

        if (preset.inferDimensions) {
          const lastSrc = preset.image.specs[preset.image.specs.length - 1]
          if (!lastSrc) throw new Error('No image source')

          const image = await lastSrc.generate(
            loadImage(resolve(config.root, filename)),
            lastSrc.args
          )
          const {
            info: { width, height },
          } = await image.toBuffer({ resolveWithObject: true })
          imageWidth = width
          imageHeight = height
        }

        return {
          _type: 'img',
          src: source[0],
          srcset: sourceSet.map((s) => s.filter(Boolean).join(' ')).join(', '),
          height: imageHeight,
          width: imageWidth,
        } satisfies ImageAttr
      }
    },
    purgeCache: async (assets) => {
      if (!config.purgeCache) return

      const usedFiles = new Set(assets.map((a) => a.name))
      const cachedFiles = await readdir(config.cacheDir)
      const unusedFiles = cachedFiles.filter((f) => !usedFiles.has(f))

      for (const file of unusedFiles)
        rm(resolve(config.cacheDir, file), { force: true })
    },
  }

  async function getImageHash(filename: string) {
    return await (imageHashesByFile[filename] ||= loadImage(filename)
      .toBuffer()
      .then(getAssetHash))
  }
  async function getImageSrc(
    filename: string,
    args: PresetArgs,
    fn: ImageGenerator
  ) {
    filename = resolve(config.root, filename)
    const id = generateImageID(filename, args)

    requestedImagesById[id] ||= fn(loadImage(filename), args)

    if (config.isBuild) {
      const image = await requestedImagesById[id]
      if (!image) throw new Error(`No image exists for ${id}!`)
      imageFilenamesById[id] ||= queueImageAndGetFilename(id, filename, image)

      return config.base + (await imageFilenamesById[id])
    }

    return VIRTUAL_ID + id
  }
  async function queueImageAndGetFilename(
    id: string,
    sourceFilename: string,
    image: Image
  ) {
    const base = basename(sourceFilename, extname(sourceFilename))
    const hash = getAssetHash(id + (await getImageHash(sourceFilename)))
    const format = await formatFor(image)
    const filename = `${base}.${hash}.${format}`

    generatedImages.push(writeImageFile(filename, image))

    return join(config.assetsDir, filename)
  }
  async function writeImageFile(
    filename: string,
    image: Image
  ): Promise<OutputAsset> {
    const cachedFilename = join(config.cacheDir, filename)

    if (!(await exists(cachedFilename))) {
      await image.toFile(cachedFilename)
    }

    return {
      fileName: join(config.assetsDir, filename),
      name: filename,
      needsCodeReference: true,
      source: await readFile(cachedFilename),
      type: 'asset',
    }
  }
}

/** Retrieve the image format for a given image */
async function formatFor(image: sharp.Sharp): Promise<ImageFormatKeys> {
  const allowedFormats = [
    'avif',
    'gif',
    'heif',
    'jpeg',
    'jpg',
    'png',
    'tif',
    'tiff',
    'webp',
  ]
  const format = (await image.metadata()).format
  if (!format || !allowedFormats.includes(format)) {
    console.error(`Could not infer image format for ${image}`)
    throw new Error('Could not infer image format')
  }
  if (format == 'heif') return 'avif'
  return format as ImageFormatKeys
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
/** Generate a hashed path for a url */
function generateImageID(url: string, args: PresetArgs) {
  const extension = args.format.type !== 'original' ? `.${args.format}` : ''
  const base = createHash('sha256')
    .update(url)
    .update(JSON.stringify(args))
    .digest('hex')
    .slice(0, 8)
  return base + extension
}
/** Load an image into sharp from a URL */
function loadImage(url: string) {
  return sharp(decodeURIComponent(parseURL(url).pathname))
}
/** Convert string to a URL */
function parseURL(rawURL: string) {
  return new URL(rawURL.replace(/#/g, '%23'), 'file://')
}
/** Generate an 8 character hex hash for an asset */
export function getAssetHash(content: string | Buffer) {
  return createHash('sha256').update(content).digest('hex').slice(0, 8)
}
/** Check if a file exists */
export async function exists(path: string) {
  return await access(path, constants.F_OK).then(
    () => true,
    () => false
  )
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
type Preset = Record<string, PresetConfig>
type API = {
  /** Retrieve a single */
  getImage: (id?: string) => Promise<Sharp>
  /** Retrieve all images */
  getImages: () => Promise<OutputAsset[]>
  /** Remove unused files (i.e: not imported) from the cache */
  purgeCache: (images: OutputAsset[]) => void
  /** Generate all permutations of an image based on a given preset */
  generateImage: (id: ParsedId) => Promise<PresetAttr>
}
type ParsedId = { path: string; query: Record<string, string> }
export type PresetAttr = BGAttr | ImageAttr
type BGAttr = {
  _type: 'bg'
  src: string
  imageSet: string
}
type ImageAttr = {
  _type: 'img'
  src: string
  srcset: string
  height?: number
  width?: number
}
