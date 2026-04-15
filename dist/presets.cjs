"use strict";
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
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
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x2) => x2.done ? resolve(x2.value) : Promise.resolve(x2.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

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
  const highestDensity = density.sort((a, b) => a - b).reduce((a, v) => v >= a ? v : a, 1);
  return {
    inferDimensions,
    isBackgroundImage,
    image: {
      type: mimeTypeFor(formatKey),
      specs: density.sort((a, b) => a - b).map(
        (density2) => cleanObject({
          condition: `${density2}x`,
          args: __spreadProps(__spreadValues({}, props), {
            preset: "density",
            density: density2 / highestDensity,
            format: toFormatArg(formatKey, formatValue)
          }),
          generate: (img, args) => __async(null, null, function* () {
            var _a;
            const {
              density: density3,
              format: { type, options }
            } = args;
            if (type != "original") {
              img = img.toFormat(type, options);
            }
            if (density3) {
              if (baseHeight || baseWidth) {
                img = img.resize(__spreadValues({
                  width: x(density3, baseWidth),
                  height: x(density3, baseHeight),
                  withoutEnlargement: true
                }, resizeOptions));
              } else {
                const { width } = yield img.metadata();
                img = img.resize({ width: x(density3, width) });
              }
            }
            return (_a = yield withImage == null ? void 0 : withImage(img, {
              preset: "density",
              density: density3,
              format: toFormatArg(type, options)
            })) != null ? _a : img;
          })
        })
      )
    }
  };
}
function widthPreset(props) {
  var _a;
  const { format, inferDimensions = false, resizeOptions, withImage } = props;
  const formatKey = format == "original" ? format : Object.keys(format)[0];
  const formatValue = format == "original" ? void 0 : format[formatKey];
  const widths = props.widths === "original" ? ["original"] : props.widths;
  const density = props.widths === "original" ? void 0 : (_a = props.density) != null ? _a : 1;
  return {
    inferDimensions,
    image: {
      type: mimeTypeFor(formatKey),
      specs: widths.sort((a, b) => {
        if (typeof a == "string" || typeof b == "string") return 0;
        return a - b;
      }).map(
        (width) => cleanObject({
          condition: width === "original" ? "" : `${width}w`,
          args: {
            preset: "width",
            format: toFormatArg(formatKey, formatValue),
            width,
            density,
            resizeOptions
          },
          generate: (img, args) => __async(null, null, function* () {
            var _a2;
            if (formatKey !== "original") {
              img = img.toFormat(formatKey, formatValue);
            }
            if (width !== "original" && typeof width == "number") {
              img = img.resize(__spreadValues({
                width: x(width, density),
                withoutEnlargement: true
              }, resizeOptions));
            }
            return (_a2 = yield withImage == null ? void 0 : withImage(img, args)) != null ? _a2 : img;
          })
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
