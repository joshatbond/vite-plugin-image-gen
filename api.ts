import sharp from 'sharp'
import type { OutputAsset } from 'rollup'

import type { Config, ParsedId } from './index'
import type {
  Image,
  ImageFormatKeys,
  ImageGenerator,
  PresetArgs,
} from './presets'
import { access, constants, readFile, readdir, rm } from 'fs/promises'
import { createHash } from 'node:crypto'
import { basename, extname, join, resolve } from 'node:path'

export function apiFactory(config: Config, pluginId: string): API {
  // Used in dev and build to ensure images are loaded only once
  const requestedImagesById: Record<
    string,
    sharp.Sharp | Promise<sharp.Sharp>
  > = {}

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

    return pluginId + id
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
export async function formatFor(image: sharp.Sharp): Promise<ImageFormatKeys> {
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
/** Load an image into sharp from a URL */
function loadImage(url: string) {
  return sharp(decodeURIComponent(parseURL(url).pathname))
}
/** Convert string to a URL */
function parseURL(rawURL: string) {
  return new URL(rawURL.replace(/#/g, '%23'), 'file://')
}
/** Check if a file exists */
async function exists(path: string) {
  return await access(path, constants.F_OK).then(
    () => true,
    () => false
  )
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
/** Generate an 8 character hex hash for an asset */
function getAssetHash(content: string | Buffer) {
  return createHash('sha256').update(content).digest('hex').slice(0, 8)
}

export type API = {
  /** Retrieve a single */
  getImage: (id?: string) => Promise<sharp.Sharp>
  /** Retrieve all images */
  getImages: () => Promise<OutputAsset[]>
  /** Remove unused files (i.e: not imported) from the cache */
  purgeCache: (images: OutputAsset[]) => void
  /** Generate all permutations of an image based on a given preset */
  generateImage: (id: ParsedId) => Promise<PresetAttr>
}

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
