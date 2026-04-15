import {
  __async,
  __spreadProps,
  __spreadValues
} from "./chunk-6FNC3XMI.js";

// presets.ts
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
            format: { type: formatKey, options: formatValue }
          }),
          generate: (_0, _1) => __async(null, [_0, _1], function* (img, { density: density3, format: { type, options } }) {
            var _a;
            if (type != "original") {
              img = img.toFormat(type, options);
            }
            if (density3) {
              if (baseHeight || baseWidth) {
                img = img.resize(__spreadValues({
                  width: x(density3 / highestDensity, baseWidth),
                  height: x(density3 / highestDensity, baseHeight),
                  withoutEnlargement: true
                }, resizeOptions));
              } else {
                const { width } = yield img.metadata();
                img = img.resize({ width: x(density3, width) });
              }
            }
            return (_a = yield withImage == null ? void 0 : withImage(img, {
              density: density3,
              format: { type, options }
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
  const widths = props.widths == "original" ? ["original"] : props.widths;
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
            format: { type: formatKey, options: formatValue },
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
export {
  densityPreset,
  widthPreset
};
