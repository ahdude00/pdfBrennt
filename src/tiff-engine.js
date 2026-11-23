import UTIF from "utif";
import { zlibSync } from "fflate";

const maxDirectories = 1000;
const maxPagePixels = 100_000_000;

// UTIF decodes these. 32946 is the obsolete code for the same zlib stream as 8.
const compressionNames = {
  1: "sıkıştırmasız", 3: "CCITT G3", 4: "CCITT G4", 5: "LZW", 6: "eski JPEG", 7: "JPEG",
  8: "Deflate", 32773: "PackBits", 32946: "Deflate",
};
const unsupportedCompressionNames = {
  2: "CCITT RLE", 34712: "JPEG 2000", 34887: "JPEG 2000", 34892: "kayıpsız JPEG", 50000: "Zstandard", 50001: "WebP",
};

export class TiffError extends Error {}

// UTIF's JPEG decoder (from pdf.js) converts every three-channel JPEG from YCbCr unless an Adobe
// marker says otherwise. In TIFF the PhotometricInterpretation tag decides: libtiff writes RGB pages
// without the marker. The minified decoder keeps pdf.js's `colorTransform` option in `B`; 0 turns
// the conversion off, -1 keeps the default.
const BaseJpegDecoder = UTIF.JpegDecoder;
let jpegFromYCbCr = true;
UTIF.JpegDecoder = function JpegDecoder() {
  const decoder = new BaseJpegDecoder();
  decoder.B = jpegFromYCbCr ? -1 : 0;
  return decoder;
};

const invalid = () => new TiffError("TIFF yapısı bozuk.");

function directoryCount(bytes) {
  if (bytes.byteLength < 8) throw invalid();
  const order = String.fromCharCode(bytes[0], bytes[1]);
  if (order !== "II" && order !== "MM") throw invalid();
  const littleEndian = order === "II";
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = view.getUint16(2, littleEndian);
  if (magic === 43) throw new TiffError("BigTIFF biçimi desteklenmiyor.");
  if (magic !== 42) throw invalid();

  // UTIF follows the directory chain without a guard, so check it ends first.
  const seen = new Set();
  for (let offset = view.getUint32(4, littleEndian); offset !== 0;) {
    if (seen.has(offset) || seen.size >= maxDirectories || offset + 2 > bytes.byteLength) throw invalid();
    seen.add(offset);
    const next = offset + 2 + view.getUint16(offset, littleEndian) * 12;
    if (next + 4 > bytes.byteLength) throw invalid();
    offset = view.getUint32(next, littleEndian);
  }
  if (!seen.size) throw invalid();
  return seen.size;
}

function tag(directory, id, fallback) {
  const value = directory[`t${id}`];
  return value?.length ? value : fallback;
}

function checkPage(directory, number) {
  const page = `${number}. sayfa`;
  const width = tag(directory, 256)[0];
  const height = tag(directory, 257)[0];
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new TiffError(`${page} için görsel boyutu geçersiz.`);
  }
  if (width * height > maxPagePixels) {
    throw new TiffError(`${page} ${width} × ${height} piksel. En çok 100 megapiksel desteklenir.`);
  }
  if (!tag(directory, 273) && !tag(directory, 324)) throw new TiffError(`${page} görsel verisi içermiyor.`);

  let compression = tag(directory, 259, [1])[0];
  if (compression === 32946) directory.t259 = [compression = 8];
  if (!compressionNames[compression]) {
    const name = unsupportedCompressionNames[compression] ?? `kod ${compression}`;
    throw new TiffError(`${page} ${name} sıkıştırması kullanıyor. Bu yöntem desteklenmiyor.`);
  }

  let bits = tag(directory, 258, [1]);
  const samples = tag(directory, 277, [bits.length])[0];
  if (bits.some(value => value !== bits[0])) throw new TiffError(`${page} için kanal bit derinlikleri farklı.`);
  if (!Number.isInteger(samples) || samples < 1 || samples > 5) {
    throw new TiffError(`${page} ${samples} renk kanalı içeriyor. Bu biçim desteklenmiyor.`);
  }
  // UTIF counts channels from BitsPerSample. Some writers store one value for all channels.
  if (bits.length !== samples) directory.t258 = bits = Array(samples).fill(bits[0]);
  if (tag(directory, 339, [1]).some(format => format !== 1)) {
    throw new TiffError(`${page} kayan noktalı veya işaretli örnekler içeriyor. Bu biçim desteklenmiyor.`);
  }
  if (samples > 1 && tag(directory, 284, [1])[0] === 2) {
    throw new TiffError(`${page} düzlemsel (planar) kanal düzeni kullanıyor. Bu biçim desteklenmiyor.`);
  }

  let photometric = tag(directory, 262)?.[0];
  if (photometric === undefined) {
    // The tag is required, but some fax writers leave it out. libtiff guesses the same way.
    photometric = samples >= 3 ? 2 : compression === 3 || compression === 4 ? 0 : 1;
    directory.t262 = [photometric];
  }
  const jpeg = compression === 6 || compression === 7;
  const depth = bits[0];
  const supported = {
    0: samples === 1 && [1, 4, 8].includes(depth),
    1: samples === 1 && [1, 2, 8, 16].includes(depth),
    2: (samples === 3 || samples === 4) && [8, 16].includes(depth),
    3: samples === 1 && depth === 8 && tag(directory, 320)?.length === 768,
    5: (samples === 4 || samples === 5) && depth === 8 && tag(directory, 332, [1])[0] === 1,
    6: jpeg && samples === 3 && depth === 8,
  }[photometric];
  if (!supported) {
    throw new TiffError(`${page} desteklenmeyen bir renk biçimi kullanıyor (renk modeli ${photometric}, ${samples} kanal, ${depth} bit).`);
  }
  return { width, height, depth, photometric };
}

export function readTiff(buffer) {
  const bytes = new Uint8Array(buffer);
  const expected = directoryCount(bytes);
  let directories;
  try {
    directories = UTIF.decode(buffer);
  } catch (error) {
    throw new TiffError("TIFF yapısı bozuk.", { cause: error });
  }
  if (directories.length !== expected) throw invalid();
  // Bit 0 marks thumbnails and other reduced copies; bit 2 marks transparency masks.
  const pages = directories.filter(directory => tag(directory, 256) && (tag(directory, 254, [0])[0] & 5) === 0);
  if (!pages.length) throw new TiffError("TIFF içinde sayfa bulunamadı.");
  const details = pages.map((directory, index) => checkPage(directory, index + 1));
  return { buffer, directories, pages, details };
}

// Page size in points. Uses the scan resolution when it is plausible, so a 300 DPI A4 scan
// becomes an A4 page and fax pages with different horizontal and vertical resolution keep their shape.
function naturalSize(directory, width, height) {
  const x = tag(directory, 282, [])[0];
  const y = tag(directory, 283, [])[0];
  if (!(x > 0 && y > 0 && Number.isFinite(x) && Number.isFinite(y))) return { width, height };
  const unit = tag(directory, 296, [2])[0];
  if (unit === 2 || unit === 3) {
    const perInch = unit === 3 ? 2.54 : 1;
    const dpiX = x * perInch;
    const dpiY = y * perInch;
    if (dpiX >= 20 && dpiY >= 20 && dpiX <= 10000 && dpiY <= 10000) {
      return { width: width * 72 / dpiX, height: height * 72 / dpiY };
    }
  }
  const ratio = x / y;
  return ratio >= 0.1 && ratio <= 10 ? { width, height: height * ratio } : { width, height };
}

function imageStreams(rgba, width, height, associatedAlpha) {
  let opaque = true;
  let gray = true;
  let bilevel = true;
  for (let index = 0; index < rgba.length; index += 4) {
    const red = rgba[index];
    if (rgba[index + 3] !== 255) opaque = false;
    if (gray && (red !== rgba[index + 1] || red !== rgba[index + 2])) gray = bilevel = false;
    else if (bilevel && red !== 0 && red !== 255) bilevel = false;
    if (!opaque && !gray) break;
  }

  const pixels = width * height;
  let alpha;
  if (!opaque) {
    alpha = new Uint8Array(pixels);
    for (let pixel = 0; pixel < pixels; pixel += 1) {
      const value = rgba[pixel * 4 + 3];
      alpha[pixel] = value;
      if (associatedAlpha && value && value < 255) {
        for (let channel = 0; channel < 3; channel += 1) {
          const index = pixel * 4 + channel;
          rgba[index] = Math.min(255, Math.round(rgba[index] * 255 / value));
        }
      }
    }
  }

  if (bilevel) {
    const rowBytes = Math.ceil(width / 8);
    const data = new Uint8Array(rowBytes * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (rgba[(y * width + x) * 4]) data[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
    return { data, colorSpace: "DeviceGray", bits: 1, alpha };
  }
  if (gray) {
    const data = new Uint8Array(pixels);
    for (let pixel = 0; pixel < pixels; pixel += 1) data[pixel] = rgba[pixel * 4];
    return { data, colorSpace: "DeviceGray", bits: 8, alpha };
  }
  const data = new Uint8Array(pixels * 3);
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    data[pixel * 3] = rgba[pixel * 4];
    data[pixel * 3 + 1] = rgba[pixel * 4 + 1];
    data[pixel * 3 + 2] = rgba[pixel * 4 + 2];
  }
  return { data, colorSpace: "DeviceRGB", bits: 8, alpha };
}

function imageObject(context, data, width, height, colorSpace, bits, extra = {}) {
  return context.register(context.stream(zlibSync(data), {
    Type: "XObject", Subtype: "Image", Width: width, Height: height,
    ColorSpace: colorSpace, BitsPerComponent: bits, Filter: "FlateDecode", ...extra,
  }));
}

// Decodes one page and adds it to the document as an image XObject.
export function embedTiffPage(document, tiff, index) {
  const directory = tiff.pages[index];
  const { width, height, depth, photometric } = tiff.details[index];
  let rgba;
  try {
    jpegFromYCbCr = photometric === 6;
    UTIF.decodeImage(tiff.buffer, directory, tiff.directories);
    rgba = UTIF.toRGBA8(directory);
  } catch (error) {
    throw new TiffError(`${index + 1}. sayfanın görsel verisi okunamadı.`, { cause: error });
  } finally {
    directory.data = null;
  }
  if (rgba.length !== width * height * 4) throw new TiffError(`${index + 1}. sayfanın görsel verisi okunamadı.`);

  const extraSamples = tag(directory, 338, []);
  if (photometric === 2 && extraSamples[0] === 0) {
    // An unspecified extra sample is not transparency.
    for (let alpha = 3; alpha < rgba.length; alpha += 4) rgba[alpha] = 255;
  }
  const { data, colorSpace, bits, alpha } = imageStreams(rgba, width, height, extraSamples[0] === 1);
  const context = document.context;
  const mask = alpha && imageObject(context, alpha, width, height, "DeviceGray", 8);
  const ref = imageObject(context, data, width, height, colorSpace, bits, mask ? { SMask: mask } : {});
  const orientation = tag(directory, 274, [1])[0];
  return {
    ref,
    natural: naturalSize(directory, width, height),
    orientation: orientation >= 1 && orientation <= 8 ? orientation : 1,
    sixteenBit: depth === 16,
    cmyk: photometric === 5,
  };
}
