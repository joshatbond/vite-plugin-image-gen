"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// presets.ts
var presets_exports = {};
__export(presets_exports, {
  densityPreset: () => densityPreset,
  widthPreset: () => widthPreset
});
module.exports = __toCommonJS(presets_exports);
function densityPreset(props) {
  const {
    baseHeight,
    baseWidth,
    density,
    format,
    inferDimensions = false,
    isBackgroundImage = false,
    resizeOptions,
    withImage
  } = props;
  const formatKey = format == "original" ? format : Object.keys(format)[0];
  const formatValue = format == "original" ? void 0 : format[formatKey];
  const sortedDensity = [...density].sort((a, b) => a - b);
  const highestDensity = sortedDensity.reduce((a, v) => v >= a ? v : a, 1);
  return {
    inferDimensions,
    isBackgroundImage,
    image: {
      type: mimeTypeFor(formatKey),
      specs: sortedDensity.map(
        (density2) => cleanObject({
          condition: `${density2}x`,
          args: {
            ...props,
            preset: "density",
            density: density2 / highestDensity,
            format: toFormatArg(formatKey, formatValue)
          },
          generate: async (img, args) => {
            const {
              density: density3,
              format: { type, options }
            } = args;
            if (type != "original") {
              img = img.toFormat(type, options);
            }
            if (density3) {
              if (baseHeight || baseWidth) {
                img = img.resize({
                  width: x(density3, baseWidth),
                  height: x(density3, baseHeight),
                  withoutEnlargement: true,
                  ...resizeOptions
                });
              } else {
                const { width } = await img.metadata();
                img = img.resize({ width: x(density3, width) });
              }
            }
            return await withImage?.(img, {
              preset: "density",
              density: density3,
              format: toFormatArg(type, options)
            }) ?? img;
          }
        })
      )
    }
  };
}
function widthPreset(props) {
  const { format, inferDimensions = false, resizeOptions, withImage } = props;
  const formatKey = format == "original" ? format : Object.keys(format)[0];
  const formatValue = format == "original" ? void 0 : format[formatKey];
  const widths = props.widths === "original" ? ["original"] : props.widths;
  const density = props.widths === "original" ? void 0 : props.density ?? 1;
  const sortedWidths = [...widths].sort((a, b) => {
    if (typeof a == "string" || typeof b == "string") return 0;
    return a - b;
  });
  return {
    inferDimensions,
    image: {
      type: mimeTypeFor(formatKey),
      specs: sortedWidths.map(
        (width) => cleanObject({
          condition: width === "original" ? "" : `${width}w`,
          args: {
            preset: "width",
            format: toFormatArg(formatKey, formatValue),
            width,
            density,
            resizeOptions
          },
          generate: async (img, args) => {
            if (formatKey !== "original") {
              img = img.toFormat(formatKey, formatValue);
            }
            if (width !== "original" && typeof width == "number") {
              img = img.resize({
                width: x(width, density),
                withoutEnlargement: true,
                ...resizeOptions
              });
            }
            return await withImage?.(img, args) ?? img;
          }
        })
      )
    }
  };
}
function mimeTypeFor(format) {
  return format == "original" ? void 0 : format == "jpg" ? "jpeg" : `image/${format}`;
}
function toFormatArg(type, options) {
  if (type === "original") return { type };
  return { type, options };
}
function cleanObject(obj) {
  for (const [key, value] of Object.entries(obj)) {
    if (value === void 0 || value === null) delete obj[key];
    else if (isObject(value)) cleanObject(value);
  }
  return obj;
}
function isObject(value) {
  return typeof value === "object" && !Array.isArray(value) && value !== null;
}
function x(quantity, n) {
  return n ? Math.floor(quantity * n) : void 0;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  densityPreset,
  widthPreset
});
