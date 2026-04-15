# vite-plugin-image-gen

A Vite plugin that generates optimized image variants from query-string presets at import time.

## Install

```bash
pnpm add -D vite-plugin-image-gen
# or: npm i -D vite-plugin-image-gen
# or: yarn add -D vite-plugin-image-gen
```

## Add To A Vite Project

Create or update your Vite config and register the plugin with named presets.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import imagePlugin from 'vite-plugin-image-gen'
import { widthPreset, densityPreset } from 'vite-plugin-image-gen/presets'

export default defineConfig({
  plugins: [
    imagePlugin({
      presets: {
        responsive: widthPreset({
          widths: [320, 640, 960, 1280],
          format: { webp: { quality: 80 } },
          inferDimensions: true,
        }),
        retina: densityPreset({
          density: [1, 2],
          format: { avif: { quality: 60 } },
          baseWidth: 1200,
        }),
      },
    }),
  ],
})
```

Then import any local image with `?preset=<name>`:

```ts
import hero from './assets/hero.jpg?preset=responsive'

console.log(hero)
// {
//   _type: "img",
//   src: "...",
//   srcset: "...",
//   width?: number,
//   height?: number
// }
```

### TypeScript Module Declaration (Required)

If you are using TypeScript, declare each configured preset name explicitly.
TypeScript does not reliably resolve a generic `*?preset=*` declaration for these
imports in many setups.

Create or update `vite-env.d.ts` (or another global `.d.ts` file):

```ts
/// <reference types="vite/client" />

declare module '*?preset=responsive' {
  import type { PresetAttr } from 'vite-plugin-image-gen'
  const value: PresetAttr
  export default value
}

declare module '*?preset=retina' {
  import type { PresetAttr } from 'vite-plugin-image-gen'
  const value: PresetAttr
  export default value
}

declare module '*?preset=background' {
  import type { PresetAttr } from 'vite-plugin-image-gen'
  const value: PresetAttr
  export default value
}
```

Add one `declare module '*?preset=<name>'` block per preset you configure in your
Vite plugin options.

## Common Scenarios

### 1) Responsive `<img>` with width descriptors

```tsx
import cover from './assets/cover.jpg?preset=responsive'

export function ArticleCover() {
  return (
    <img
      src={cover.src}
      srcSet={cover.srcset}
      sizes="(max-width: 768px) 100vw, 768px"
      width={cover.width}
      height={cover.height}
      alt="Article cover"
      loading="lazy"
    />
  )
}
```

### 2) Retina asset set (1x/2x)

```ts
import avatar from './assets/avatar.png?preset=retina'

const image = new Image()
image.src = avatar.src
image.srcset = avatar.srcset
```

### 3) CSS background image-set

Configure a background preset:

```ts
// vite.config.ts
import { densityPreset } from 'vite-plugin-image-gen/presets'

const background = densityPreset({
  density: [1, 2],
  baseWidth: 1600,
  format: { webp: { quality: 75 } },
  isBackgroundImage: true,
})
```

Use it in app code:

```ts
import bg from './assets/hero-background.jpg?preset=background'

document.body.style.backgroundImage = bg.imageSet
// Also useful for preloading:
// <link rel="preload" as="image" imagesrcset={bg.srcset} />
```

### 4) Apply custom Sharp transforms with `withImage`

```ts
// vite.config.ts
import { widthPreset } from 'vite-plugin-image-gen/presets'

const roundedThumb = widthPreset({
  widths: [200, 400],
  format: { webp: { quality: 80 } },
  withImage: async (img) =>
    img
      .resize({ fit: 'cover', width: 400, height: 400 })
      .grayscale()
      .sharpen(),
})
```

## Preset Helpers

### `widthPreset(...)`

Use for responsive width-based `srcset` output.

Key options:

- `widths`: `number[]` or `'original'`
- `format`: `'original'` or one image format option object (`webp`, `avif`, `jpg`, etc.)
- `density` (optional): scales each width
- `inferDimensions` (optional): includes `width` and `height` in returned value
- `resizeOptions` (optional): passed to `sharp.resize(...)`
- `withImage` (optional): custom post-processing

### `densityPreset(...)`

Use for density descriptors like `1x, 2x`.

Key options:

- `density`: `number[]`
- `format`: `'original'` or one image format option object
- `baseWidth` / `baseHeight` (optional): control output size before density scaling
- `isBackgroundImage` (optional): returns a background payload with `imageSet`
- `inferDimensions` (optional): includes intrinsic dimensions
- `resizeOptions` and `withImage` (optional)

## Returned Attributes

For standard image presets:

```ts
type ImageAttr = {
  _type: 'img'
  src: string
  srcset: string
  width?: number
  height?: number
}
```

For background-image presets (`isBackgroundImage: true`):

```ts
type BGAttr = {
  _type: 'bg'
  src: string
  srcset: string
  imageSet: string
}
```

## Plugin Options

Pass `options` as the second config field:

```ts
imagePlugin({
  presets: { /* ... */ },
  options: {
    assetsDir: 'assets/images',
    cacheDir: 'node_modules/.images',
    urlParam: 'preset',
    purgeCache: true,
    writeToBundle: true,
  },
})
```

## Notes

- Images are generated on demand in dev and emitted as build assets in production.
- Generated file names include content-based hashes for stable caching.
- By default, unused cached files are purged during build.
