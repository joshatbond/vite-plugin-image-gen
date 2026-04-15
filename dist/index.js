import {
  __async,
  __spreadValues
} from "./chunk-6FNC3XMI.js";

// index.ts
import { join as join2 } from "path";
import { mkdir } from "fs/promises";

// node_modules/.pnpm/@nuxt+devalue@2.0.2/node_modules/@nuxt/devalue/dist/devalue.mjs
var chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$";
var unsafeChars = /[<>\b\f\n\r\t\0\u2028\u2029]/g;
var reserved = /^(?:do|if|in|for|int|let|new|try|var|byte|case|char|else|enum|goto|long|this|void|with|await|break|catch|class|const|final|float|short|super|throw|while|yield|delete|double|export|import|native|return|switch|throws|typeof|boolean|default|extends|finally|package|private|abstract|continue|debugger|function|volatile|interface|protected|transient|implements|instanceof|synchronized)$/;
var escaped = {
  "<": "\\u003C",
  ">": "\\u003E",
  "/": "\\u002F",
  "\\": "\\\\",
  "\b": "\\b",
  "\f": "\\f",
  "\n": "\\n",
  "\r": "\\r",
  "	": "\\t",
  "\0": "\\0",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029"
};
var objectProtoOwnPropertyNames = Object.getOwnPropertyNames(Object.prototype).sort().join("\0");
function devalue(value) {
  const counts = /* @__PURE__ */ new Map();
  let logNum = 0;
  function log(message) {
    if (logNum < 100) {
      console.warn(message);
      logNum += 1;
    }
  }
  function walk(thing) {
    if (typeof thing === "function") {
      log(`Cannot stringify a function ${thing.name}`);
      return;
    }
    if (counts.has(thing)) {
      counts.set(thing, counts.get(thing) + 1);
      return;
    }
    counts.set(thing, 1);
    if (!isPrimitive(thing)) {
      const type = getType(thing);
      switch (type) {
        case "Number":
        case "String":
        case "Boolean":
        case "Date":
        case "RegExp":
          return;
        case "Array":
          thing.forEach(walk);
          break;
        case "Set":
        case "Map":
          Array.from(thing).forEach(walk);
          break;
        default:
          const proto = Object.getPrototypeOf(thing);
          if (proto !== Object.prototype && proto !== null && Object.getOwnPropertyNames(proto).sort().join("\0") !== objectProtoOwnPropertyNames) {
            if (typeof thing.toJSON !== "function") {
              log(`Cannot stringify arbitrary non-POJOs ${thing.constructor.name}`);
            }
          } else if (Object.getOwnPropertySymbols(thing).length > 0) {
            log(`Cannot stringify POJOs with symbolic keys ${Object.getOwnPropertySymbols(thing).map((symbol) => symbol.toString())}`);
          } else {
            Object.keys(thing).forEach((key) => walk(thing[key]));
          }
      }
    }
  }
  walk(value);
  const names = /* @__PURE__ */ new Map();
  Array.from(counts).filter((entry) => entry[1] > 1).sort((a, b) => b[1] - a[1]).forEach((entry, i) => {
    names.set(entry[0], getName(i));
  });
  function stringify(thing) {
    if (names.has(thing)) {
      return names.get(thing);
    }
    if (isPrimitive(thing)) {
      return stringifyPrimitive(thing);
    }
    const type = getType(thing);
    switch (type) {
      case "Number":
      case "String":
      case "Boolean":
        return `Object(${stringify(thing.valueOf())})`;
      case "RegExp":
        return thing.toString();
      case "Date":
        return `new Date(${thing.getTime()})`;
      case "Array":
        const members = thing.map((v, i) => i in thing ? stringify(v) : "");
        const tail = thing.length === 0 || thing.length - 1 in thing ? "" : ",";
        return `[${members.join(",")}${tail}]`;
      case "Set":
      case "Map":
        return `new ${type}([${Array.from(thing).map(stringify).join(",")}])`;
      default:
        if (thing.toJSON) {
          let json = thing.toJSON();
          if (getType(json) === "String") {
            try {
              json = JSON.parse(json);
            } catch (e) {
            }
          }
          return stringify(json);
        }
        if (Object.getPrototypeOf(thing) === null) {
          if (Object.keys(thing).length === 0) {
            return "Object.create(null)";
          }
          return `Object.create(null,{${Object.keys(thing).map((key) => `${safeKey(key)}:{writable:true,enumerable:true,value:${stringify(thing[key])}}`).join(",")}})`;
        }
        return `{${Object.keys(thing).map((key) => `${safeKey(key)}:${stringify(thing[key])}`).join(",")}}`;
    }
  }
  const str = stringify(value);
  if (names.size) {
    const params = [];
    const statements = [];
    const values = [];
    names.forEach((name, thing) => {
      params.push(name);
      if (isPrimitive(thing)) {
        values.push(stringifyPrimitive(thing));
        return;
      }
      const type = getType(thing);
      switch (type) {
        case "Number":
        case "String":
        case "Boolean":
          values.push(`Object(${stringify(thing.valueOf())})`);
          break;
        case "RegExp":
          values.push(thing.toString());
          break;
        case "Date":
          values.push(`new Date(${thing.getTime()})`);
          break;
        case "Array":
          values.push(`Array(${thing.length})`);
          thing.forEach((v, i) => {
            statements.push(`${name}[${i}]=${stringify(v)}`);
          });
          break;
        case "Set":
          values.push("new Set");
          statements.push(`${name}.${Array.from(thing).map((v) => `add(${stringify(v)})`).join(".")}`);
          break;
        case "Map":
          values.push("new Map");
          statements.push(`${name}.${Array.from(thing).map(([k, v]) => `set(${stringify(k)}, ${stringify(v)})`).join(".")}`);
          break;
        default:
          values.push(Object.getPrototypeOf(thing) === null ? "Object.create(null)" : "{}");
          Object.keys(thing).forEach((key) => {
            statements.push(`${name}${safeProp(key)}=${stringify(thing[key])}`);
          });
      }
    });
    statements.push(`return ${str}`);
    return `(function(${params.join(",")}){${statements.join(";")}}(${values.join(",")}))`;
  } else {
    return str;
  }
}
function getName(num) {
  let name = "";
  do {
    name = chars[num % chars.length] + name;
    num = ~~(num / chars.length) - 1;
  } while (num >= 0);
  return reserved.test(name) ? `${name}0` : name;
}
function isPrimitive(thing) {
  return Object(thing) !== thing;
}
function stringifyPrimitive(thing) {
  if (typeof thing === "string") {
    return stringifyString(thing);
  }
  if (thing === void 0) {
    return "void 0";
  }
  if (thing === 0 && 1 / thing < 0) {
    return "-0";
  }
  const str = String(thing);
  if (typeof thing === "number") {
    return str.replace(/^(-)?0\./, "$1.");
  }
  return str;
}
function getType(thing) {
  return Object.prototype.toString.call(thing).slice(8, -1);
}
function escapeUnsafeChar(c) {
  return escaped[c] || c;
}
function escapeUnsafeChars(str) {
  return str.replace(unsafeChars, escapeUnsafeChar);
}
function safeKey(key) {
  return /^[_$a-zA-Z][_$a-zA-Z0-9]*$/.test(key) ? key : escapeUnsafeChars(JSON.stringify(key));
}
function safeProp(key) {
  return /^[_$a-zA-Z][_$a-zA-Z0-9]*$/.test(key) ? `.${key}` : `[${escapeUnsafeChars(JSON.stringify(key))}]`;
}
function stringifyString(str) {
  let result = '"';
  for (let i = 0; i < str.length; i += 1) {
    const char = str.charAt(i);
    const code = char.charCodeAt(0);
    if (char === '"') {
      result += '\\"';
    } else if (char in escaped) {
      result += escaped[char];
    } else if (code >= 55296 && code <= 57343) {
      const next = str.charCodeAt(i + 1);
      if (code <= 56319 && (next >= 56320 && next <= 57343)) {
        result += char + str[++i];
      } else {
        result += `\\u${code.toString(16).toUpperCase()}`;
      }
    } else {
      result += char;
    }
  }
  result += '"';
  return result;
}

// api.ts
import sharp from "sharp";
import { access, constants, readFile, readdir, rm } from "fs/promises";
import { createHash } from "crypto";
import { basename, extname, join, posix, resolve } from "path";
function apiFactory(config, pluginId) {
  const requestedImagesById = {};
  const generatedImages = [];
  const imageFilenamesById = {};
  const imageHashesByFile = {};
  return {
    getImage: (id) => __async(null, null, function* () {
      if (!id || !(id in requestedImagesById)) return void 0;
      return yield requestedImagesById[id];
    }),
    getImages: () => __async(null, null, function* () {
      return yield Promise.all(generatedImages);
    }),
    generateImage: (_0) => __async(null, [_0], function* ({ path: filename, query }) {
      const { [config.urlParam]: presetName } = query;
      if (!presetName)
        throw new Error("vite-plugin-image-gen: No preset was defined");
      const preset = config.presets[presetName];
      if (!preset)
        throw new Error(
          `vite-plugin-image-gen: Unknown image preset '${presetName}'`
        );
      const sourceSet = yield Promise.all(
        preset.image.specs.map((_02) => __async(null, [_02], function* ({ condition, args, generate }) {
          return [
            encodeURI(yield getImageSrc(filename, args, generate)),
            condition
          ];
        }))
      );
      const source = sourceSet[sourceSet.length - 1];
      if (!source || !source[0])
        throw new Error(
          `vite-plugin-image-gen: The image ${filename} doesn't seem to exist`
        );
      if (preset.isBackgroundImage) {
        const src = source[0];
        const imageSet = sourceSet.map((s) => `url(${s[0]}) ${s[1]}`).join(", ");
        return {
          _type: "bg",
          src,
          imageSet,
          srcset: sourceSet.map((s) => s.filter(Boolean).join(" ")).join(", ")
        };
      } else {
        let imageWidth = void 0;
        let imageHeight = void 0;
        if (preset.inferDimensions) {
          const lastSrc = preset.image.specs[preset.image.specs.length - 1];
          if (!lastSrc) throw new Error("No image source");
          const image = yield lastSrc.generate(
            loadImage(resolve(config.root, filename)),
            lastSrc.args
          );
          const {
            info: { width, height }
          } = yield image.toBuffer({ resolveWithObject: true });
          imageWidth = width;
          imageHeight = height;
        }
        return {
          _type: "img",
          src: source[0],
          srcset: sourceSet.map((s) => s.filter(Boolean).join(" ")).join(", "),
          height: imageHeight,
          width: imageWidth
        };
      }
    }),
    purgeCache: (assets) => __async(null, null, function* () {
      if (!config.purgeCache) return;
      const usedFiles = new Set(assets.map((a) => a.name));
      const cachedFiles = yield readdir(config.cacheDir);
      const unusedFiles = cachedFiles.filter((f) => !usedFiles.has(f));
      for (const file of unusedFiles)
        rm(resolve(config.cacheDir, file), { force: true });
    })
  };
  function getImageHash(filename) {
    return __async(this, null, function* () {
      return yield imageHashesByFile[filename] || (imageHashesByFile[filename] = loadImage(filename).toBuffer().then(getAssetHash));
    });
  }
  function getImageSrc(filename, args, fn) {
    return __async(this, null, function* () {
      filename = resolve(config.root, filename);
      const id = generateImageID(filename, args);
      requestedImagesById[id] || (requestedImagesById[id] = fn(loadImage(filename), args));
      if (config.isBuild) {
        const image = yield requestedImagesById[id];
        if (!image) throw new Error(`No image exists for ${id}!`);
        imageFilenamesById[id] || (imageFilenamesById[id] = queueImageAndGetFilename(id, filename, image));
        return config.base + (yield imageFilenamesById[id]);
      }
      return pluginId + id;
    });
  }
  function queueImageAndGetFilename(id, sourceFilename, image) {
    return __async(this, null, function* () {
      const base = basename(sourceFilename, extname(sourceFilename));
      const hash = getAssetHash(id + (yield getImageHash(sourceFilename)));
      const format = yield formatFor(image);
      const filename = `${base}.${hash}.${format}`;
      generatedImages.push(writeImageFile(filename, image));
      return posix.join(config.assetsDir, filename);
    });
  }
  function writeImageFile(filename, image) {
    return __async(this, null, function* () {
      const cachedFilename = join(config.cacheDir, filename);
      if (!(yield exists(cachedFilename))) {
        yield image.toFile(cachedFilename);
      }
      return {
        fileName: posix.join(config.assetsDir, filename),
        name: filename,
        needsCodeReference: true,
        source: yield readFile(cachedFilename),
        type: "asset"
      };
    });
  }
}
function formatFor(image) {
  return __async(this, null, function* () {
    var _a;
    const allowedFormats = [
      "avif",
      "gif",
      "heif",
      "jpeg",
      "jpg",
      "png",
      "tif",
      "tiff",
      "webp"
    ];
    let format = (_a = image.options) == null ? void 0 : _a.formatOut;
    if (format == "input") format = (yield image.metadata()).format;
    if (!format || !allowedFormats.includes(format)) {
      console.error(`Could not infer image format for ${image}`);
      throw new Error("Could not infer image format");
    }
    if (format == "heif") return "avif";
    return format;
  });
}
function loadImage(url) {
  return sharp(decodeURIComponent(parseURL(url).pathname));
}
function parseURL(rawURL) {
  return new URL(rawURL.replace(/#/g, "%23"), "file://");
}
function exists(path) {
  return __async(this, null, function* () {
    return yield access(path, constants.F_OK).then(
      () => true,
      () => false
    );
  });
}
function generateImageID(url, args) {
  const extension = args.format.type !== "original" ? `.${args.format.type}` : "";
  const base = createHash("sha256").update(url).update(JSON.stringify(args)).digest("hex").slice(0, 8);
  return base + extension;
}
function getAssetHash(content) {
  return createHash("sha256").update(content).digest("hex").slice(0, 8);
}

// index.ts
var VIRTUAL_ID = "/@imagepresets";
function ImagePlugin({ presets, options }) {
  let api;
  let config;
  let devVirtualId = VIRTUAL_ID;
  return {
    /** required: Names the plugin */
    name: "image-gen",
    /** [When to run](https://vitejs.dev/guide/api-plugin#plugin-ordering) */
    enforce: "pre",
    /**
     * Vite Hook called after the vite config is resolved.
     * https://vitejs.dev/guide/api-plugin#configresolved
     */
    configResolved: (_0) => __async(null, [_0], function* ({ build: { assetsDir }, base, command, root }) {
      config = __spreadValues({
        assetsDir,
        base,
        cacheDir: join2(root, "node_modules", ".images"),
        isBuild: command === "build",
        // from plugin instantiation
        presets,
        purgeCache: true,
        root,
        urlParam: "preset",
        writeToBundle: true
      }, options);
      devVirtualId = withBase(config.base, VIRTUAL_ID);
      api = apiFactory(config, devVirtualId);
      if (config.isBuild) yield mkdir(config.cacheDir, { recursive: true });
    }),
    /**
     * Vite Hook for configuring the dev server.
     * https://vitejs.dev/guide/api-plugin#configureserver
     */
    configureServer: (server) => {
      server.middlewares.use((req, res, next) => __async(null, null, function* () {
        const requestUrl = req.url;
        const virtualIdPrefix = (requestUrl == null ? void 0 : requestUrl.startsWith(devVirtualId)) ? devVirtualId : (requestUrl == null ? void 0 : requestUrl.startsWith(VIRTUAL_ID)) ? VIRTUAL_ID : void 0;
        if (virtualIdPrefix && requestUrl) {
          const id = requestUrl.slice(virtualIdPrefix.length);
          const image = yield api.getImage(id);
          if (!image) {
            res.statusCode = 404;
            return res.end();
          }
          res.setHeader("Content-Type", `image/${yield formatFor(image)}`);
          res.setHeader("Cache-Control", "max-age=360000");
          return image.clone().on("error", (e) => console.error(e)).pipe(res);
        }
        next();
      }));
    },
    /**
     * Rollup Build Hook called before the files are written in build
     * Gathers generated images and adds them to the output files to write.
     * https://rollupjs.org/plugin-development/#generatebundle
     */
    generateBundle: (_, output) => __async(null, null, function* () {
      if (!config.writeToBundle) return;
      const images = yield api.getImages();
      for (const image of images) output[image.fileName] = image;
      api.purgeCache(images);
    }),
    /**
     * Rollup Build Hook called on each incoming module request
     * This is a loader that checks the module request for the
     * presence of a preset, and returns the resolved image
     * https://rollupjs.org/plugin-development/#load
     */
    load: (id) => __async(null, null, function* () {
      const parsedId = parseId(id);
      if (!(config.urlParam in parsedId.query)) return;
      const image = yield api.generateImage(parsedId);
      return `export default ${devalue(image)}`;
    })
  };
}
function parseId(id) {
  const index = id.indexOf("?");
  if (index < 0) return { path: id, query: {} };
  return {
    path: id.slice(0, index),
    query: Object.fromEntries(new URLSearchParams(id.slice(index)))
  };
}
function withBase(base, path) {
  if (base === "/") return path;
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return normalizedBase + normalizedPath;
}
export {
  ImagePlugin as default
};
