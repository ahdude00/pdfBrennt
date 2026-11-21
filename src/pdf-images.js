import { zipSync } from "fflate";
import { openPdfDocument } from "./pdf-preview.js";

const formats = {
  png: { mimeType: "image/png", extension: "png" },
  jpeg: { mimeType: "image/jpeg", extension: "jpg", quality: 0.95 },
};
// Keep canvas size within a range supported on mobile browsers.
const maxCanvasSide = 8192;
const maxCanvasPixels = 16 * 1024 * 1024;
const maxOutputBytes = 96 * 1024 * 1024;

function insertBytes(bytes, offset, addition) {
  const output = new Uint8Array(bytes.length + addition.length);
  output.set(bytes.subarray(0, offset));
  output.set(addition, offset);
  output.set(bytes.subarray(offset), offset + addition.length);
  return output;
}

function pngCrc(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return ~crc;
}

function pngDensity(bytes, dpi) {
  // pHYs stores horizontal and vertical pixels per meter.
  const chunkType = 0x70485973;
  const density = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21);
  const fields = new DataView(chunk.buffer);
  fields.setUint32(0, 9);
  fields.setUint32(4, chunkType);
  fields.setUint32(8, density);
  fields.setUint32(12, density);
  fields.setUint8(16, 1);
  fields.setUint32(17, pngCrc(chunk.subarray(4, 17)));

  const image = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  // Start after the PNG signature and IHDR, and stop before the compressed pixels.
  for (let offset = 33; offset + 12 <= bytes.length;) {
    const length = image.getUint32(offset);
    const type = image.getUint32(offset + 4);
    if (type === chunkType && length === 9) {
      bytes.set(chunk, offset);
      return bytes;
    }
    if (type === 0x49444154) break; // IDAT
    offset += length + 12;
  }
  return insertBytes(bytes, 33, chunk);
}

function jpegDensity(bytes, dpi) {
  // APP0 carries the JFIF density. Use dots per inch as the unit.
  const jfif = [0x4a, 0x46, 0x49, 0x46, 0];
  const hasJfif = bytes.length >= 20 && bytes[2] === 0xff && bytes[3] === 0xe0
    && jfif.every((byte, index) => bytes[index + 6] === byte);
  if (!hasJfif) {
    const segment = new Uint8Array([0xff, 0xe0, 0, 16, ...jfif, 1, 1, 1, 0, 0, 0, 0, 0, 0]);
    bytes = insertBytes(bytes, 2, segment);
  }
  const image = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  image.setUint8(13, 1);
  image.setUint16(14, dpi);
  image.setUint16(16, dpi);
  return bytes;
}

function canvasBlob(canvas, { mimeType, quality }) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob?.type === mimeType) resolve(blob);
      else reject(new Error("Tarayıcı seçilen biçimde bir görsel oluşturamadı."));
    }, mimeType, quality);
  });
}

function pixelSize(size) {
  // Ignore floating-point error when an edge lands on an exact pixel.
  const nearest = Math.round(size);
  return Math.abs(size - nearest) <= Number.EPSILON * size * 4 ? nearest : Math.ceil(size);
}

async function renderImage(pdf, number, canvas, format, dpi) {
  const page = await pdf.getPage(number);
  try {
    const viewport = page.getViewport({ scale: dpi / 72 });
    const width = pixelSize(viewport.width);
    const height = pixelSize(viewport.height);
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
      throw new Error("Sayfanın boyutları geçersiz.");
    }
    if (width > maxCanvasSide || height > maxCanvasSide || width * height > maxCanvasPixels) {
      throw new Error("Sayfa seçilen çözünürlük için çok büyük. Daha düşük bir DPI seçin.");
    }
    canvas.width = width;
    canvas.height = height;
    await page.render({ canvas, viewport, background: "#fff" }).promise;
    return { blob: await canvasBlob(canvas, format), width, height };
  } finally {
    // Resizing releases the backing store before drawing the next page.
    canvas.width = 0;
    canvas.height = 0;
    page.cleanup();
  }
}

export async function pdfToImages(file, { pages, format = "png", dpi = 150 }, progress = () => {}) {
  if (!Object.hasOwn(formats, format) || ![72, 150, 300].includes(dpi)) {
    throw new Error("Geçerli bir görsel biçimi ve çözünürlük seçin.");
  }
  if (!Array.isArray(pages) || !pages.length || new Set(pages).size !== pages.length) {
    throw new Error("Dönüştürülecek sayfaları birer kez seçin.");
  }
  if (pages.length > 0xffff) throw new Error("Tek ZIP dosyasına en fazla 65.535 sayfa eklenebilir.");

  const outputFormat = formats[format];
  const { pdf, close } = await openPdfDocument(file, { stopAtErrors: true });
  try {
    if (pages.some(number => !Number.isInteger(number) || number < 1 || number > pdf.numPages)) {
      throw new Error(`1 ile ${pdf.numPages} arasında geçerli bir sayfa seçin.`);
    }
    const canvas = document.createElement("canvas");
    const entries = {};
    const pageCount = pages.length;
    const padding = Math.max(3, String(pdf.numPages).length);
    let totalBytes = 0;
    for (const [index, number] of pages.entries()) {
      progress(index + 1, pageCount);
      try {
        const { blob, width, height } = await renderImage(pdf, number, canvas, outputFormat, dpi);
        totalBytes += blob.size;
        if (totalBytes > maxOutputBytes) {
          throw new Error("Çıktı 96 MB sınırını aşıyor. Daha az sayfa, daha düşük bir DPI veya JPEG seçin.");
        }
        const encoded = new Uint8Array(await blob.arrayBuffer());
        // Canvas encoders use a default physical resolution independent of the pixel dimensions.
        const bytes = format === "png" ? pngDensity(encoded, dpi) : jpegDensity(encoded, dpi);
        if (pageCount === 1) {
          return { bytes, mimeType: outputFormat.mimeType, pageCount, fileCount: 1, width, height };
        }
        const pageName = String(number).padStart(padding, "0");
        entries[`sayfa-${pageName}.${outputFormat.extension}`] = bytes;
      } catch (error) {
        throw new Error(`${number}. sayfa · ${error?.message || "Görsel oluşturulamadı."}`, { cause: error });
      }
    }
    // PNG and JPEG data are already compressed.
    return { bytes: zipSync(entries, { level: 0 }), mimeType: "application/zip", pageCount, fileCount: pageCount };
  } finally {
    await close().catch(() => {});
  }
}
