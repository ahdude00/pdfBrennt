import { zipSync } from "fflate";
import { degrees, EncryptedPDFError, PageSizes, PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFString } from "pdf-lib";

const pdfType = "application/pdf";
const zipType = "application/zip";
const encryptedPdfMessage = new EncryptedPDFError().message;
const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const exifSignature = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];

// Offsets are fractions of the oriented image's width and height.
const exifPlacement = {
  1: { rotation: 0 },
  2: { rotation: 0, flipX: true, offsetX: 1 },
  3: { rotation: 180, offsetX: 1, offsetY: 1 },
  4: { rotation: 0, flipY: true, offsetY: 1 },
  5: { rotation: 90, flipX: true, offsetX: 1, offsetY: 1 },
  6: { rotation: -90, offsetY: 1 },
  7: { rotation: -90, flipX: true },
  8: { rotation: 90, offsetX: 1 },
};

async function loadPdf(file) {
  const name = file.name || "PDF";
  let document;
  let pageCount;
  try {
    document = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
    pageCount = document.getPageCount();
  } catch (error) {
    const encrypted = error instanceof EncryptedPDFError || error?.message === encryptedPdfMessage;
    const message = encrypted
      ? `${name} şifreli. İşleme devam etmek için önce PDF’nin kilidini açın.`
      : `${name} açılamadı. Geçerli ve okunabilir bir PDF seçin.`;
    throw new Error(message, { cause: error });
  }
  if (pageCount === 0) {
    throw new Error(`${name} dosyasında sayfa bulunamadı.`);
  }
  return document;
}

function resolvePages(pages, document) {
  if (pages == null) return document.getPageIndices();
  const count = document.getPageCount();
  if (!Array.isArray(pages) || pages.length === 0
    || pages.some(number => !Number.isInteger(number) || number < 1 || number > count)) {
    throw new Error(`1 ile ${count} arasında geçerli sayfalar seçin.`);
  }
  return pages.map(number => number - 1);
}

async function appendPages(output, source, indices) {
  const pages = await output.copyPages(source, indices);
  for (const page of pages) output.addPage(page);
}

async function pdfResult(document, options = {}) {
  const bytes = await document.save({ updateFieldAppearances: false });
  return { bytes, mimeType: pdfType, pageCount: document.getPageCount(), fileCount: 1, ...options };
}

function hasDigitalSignature(document) {
  try {
    const form = document.catalog.lookup(PDFName.of("AcroForm"));
    const fields = form instanceof PDFDict ? form.lookup(PDFName.of("Fields")) : undefined;
    if (!(fields instanceof PDFArray)) return false;

    const pending = [{ entries: fields, inheritedType: undefined }];
    const visited = new Set();
    while (pending.length) {
      const { entries, inheritedType } = pending.pop();
      for (let index = 0; index < entries.size(); index += 1) {
        const field = entries.lookup(index);
        if (!(field instanceof PDFDict) || visited.has(field)) continue;
        visited.add(field);
        const type = field.lookup(PDFName.of("FT")) ?? inheritedType;
        if (type === PDFName.of("Sig")) {
          const value = field.lookup(PDFName.of("V"));
          if (value instanceof PDFDict) {
            const range = value.lookup(PDFName.of("ByteRange"));
            const contents = value.lookup(PDFName.of("Contents"));
            const present = contents instanceof PDFHexString
              ? /[1-9a-f]/i.test(contents.asString())
              : contents instanceof PDFString && contents.asString().length > 0;
            if (present && range instanceof PDFArray && range.size() >= 2) return true;
          }
        }
        const children = field.lookup(PDFName.of("Kids"));
        if (children instanceof PDFArray) pending.push({ entries: children, inheritedType: type });
      }
    }
    return false;
  } catch {
    // Unreadable form metadata does not prevent page operations.
    return false;
  }
}

export async function inspectPdf(file) {
  const document = await loadPdf(file);
  return { pageCount: document.getPageCount(), hasDigitalSignature: hasDigitalSignature(document) };
}

export async function mergePdfs(files) {
  if (files.length < 2) throw new Error("Birleştirmek için en az iki PDF seçin.");

  const output = await PDFDocument.create();
  for (const { file, pages } of files) {
    const source = await loadPdf(file);
    await appendPages(output, source, resolvePages(pages, source));
  }
  return pdfResult(output);
}

export async function splitPdf(file, groups) {
  if (groups.length === 0) throw new Error("Ayırmak için en az bir sayfa seçin.");

  const source = await loadPdf(file);
  const indices = groups.map(pages => resolvePages(pages, source));
  if (indices.length === 1) {
    const output = await PDFDocument.create();
    await appendPages(output, source, indices[0]);
    return pdfResult(output);
  }

  const entries = {};
  let pageCount = 0;
  const padding = Math.max(2, String(indices.length).length);
  for (const [index, group] of indices.entries()) {
    const output = await PDFDocument.create();
    await appendPages(output, source, group);
    const number = String(index + 1).padStart(padding, "0");
    entries[`bolum-${number}.pdf`] = await output.save({ updateFieldAppearances: false });
    pageCount += group.length;
  }
  // PDF streams are already compressed.
  const bytes = zipSync(entries, { level: 0 });
  return { bytes, mimeType: zipType, pageCount, fileCount: indices.length };
}

function matchesAt(bytes, signature, offset = 0) {
  return signature.every((value, index) => bytes[offset + index] === value);
}

function tiffOrientation(bytes) {
  if (bytes.byteLength < 8) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const order = view.getUint16(0);
  if (order !== 0x4949 && order !== 0x4d4d) return undefined;
  const littleEndian = order === 0x4949;
  if (view.getUint16(2, littleEndian) !== 42) return undefined;
  const directory = view.getUint32(4, littleEndian);
  if (directory < 8 || directory + 2 > bytes.byteLength) return undefined;

  const count = view.getUint16(directory, littleEndian);
  for (let index = 0; index < count; index += 1) {
    const entry = directory + 2 + index * 12;
    if (entry + 12 > bytes.byteLength) break;
    if (view.getUint16(entry, littleEndian) !== 0x0112) continue;
    if (view.getUint16(entry + 2, littleEndian) !== 3
      || view.getUint32(entry + 4, littleEndian) !== 1) break;
    const orientation = view.getUint16(entry + 8, littleEndian);
    if (orientation >= 1 && orientation <= 8) return orientation;
    break;
  }
  return undefined;
}

function jpegOrientation(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let cursor = 2;
  while (cursor + 3 < bytes.byteLength && bytes[cursor] === 0xff) {
    while (bytes[cursor] === 0xff) cursor += 1;
    const marker = bytes[cursor];
    cursor += 1;
    if (marker === 0xda || marker === 0xd9 || cursor + 2 > bytes.byteLength) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;

    const length = view.getUint16(cursor);
    const end = cursor + length;
    if (length < 2 || end > bytes.byteLength) break;
    const payload = cursor + 2;
    if (marker === 0xe1 && length >= 8 && matchesAt(bytes, exifSignature, payload)) {
      const orientation = tiffOrientation(bytes.subarray(payload + exifSignature.length, end));
      if (orientation !== undefined) return orientation;
    }
    cursor = end;
  }
  return 1;
}

function pngDefaultImage(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const spans = [];
  let keptStart = 0;
  let omittedBytes = 0;
  for (let offset = pngSignature.length; offset + 12 <= bytes.byteLength;) {
    const length = view.getUint32(offset);
    const chunkType = view.getUint32(offset + 4);
    const end = offset + length + 12;
    if (end > bytes.byteLength) break;
    // Drop acTL, fcTL and fdAT. IDAT stays byte-for-byte intact.
    if (chunkType === 0x6163544c || chunkType === 0x6663544c || chunkType === 0x66644154) {
      if (keptStart < offset) spans.push(bytes.subarray(keptStart, offset));
      keptStart = end;
      omittedBytes += end - offset;
    }
    if (chunkType === 0x49454e44) { // IEND
      if (length !== 0) break;
      if (!omittedBytes) return bytes;
      spans.push(bytes.subarray(keptStart, end));
      const image = new Uint8Array(end - omittedBytes);
      let destination = 0;
      for (const span of spans) {
        image.set(span, destination);
        destination += span.length;
      }
      return image;
    }
    offset = end;
  }
  throw new Error("Geçersiz PNG parça yapısı.");
}

function addImagePage(document, image, orientation, size) {
  const { rotation, flipX, flipY, offsetX = 0, offsetY = 0 } = exifPlacement[orientation];
  const quarterTurn = Math.abs(rotation) === 90;
  const width = quarterTurn ? image.height : image.width;
  const height = quarterTurn ? image.width : image.height;
  let scale = Math.min(1, 14400 / width, 14400 / height);
  let pageWidth = width * scale;
  let pageHeight = height * scale;

  if (size === "a4") {
    const [shortSide, longSide] = PageSizes.A4;
    [pageWidth, pageHeight] = width > height ? [longSide, shortSide] : [shortSide, longSide];
    const margin = 24;
    scale = Math.min(1, (pageWidth - 2 * margin) / width, (pageHeight - 2 * margin) / height);
  }

  const drawnWidth = width * scale;
  const drawnHeight = height * scale;
  const page = document.addPage([pageWidth, pageHeight]);
  page.drawImage(image, {
    x: (pageWidth - drawnWidth) / 2 + offsetX * drawnWidth,
    y: (pageHeight - drawnHeight) / 2 + offsetY * drawnHeight,
    width: image.width * scale * (flipX ? -1 : 1),
    height: image.height * scale * (flipY ? -1 : 1),
    rotate: degrees(rotation),
  });
}

export async function imagesToPdf(files, { size = "original" } = {}) {
  if (files.length === 0) throw new Error("En az bir PNG veya JPEG dosyası seçin.");
  if (size !== "original" && size !== "a4") throw new Error("Geçerli bir sayfa boyutu seçin.");

  const output = await PDFDocument.create();
  const warnings = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const png = matchesAt(bytes, pngSignature);
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    if (!png && !jpeg) throw new Error(`${file.name} desteklenmiyor. PNG veya JPEG seçin.`);
    try {
      const imageBytes = png ? pngDefaultImage(bytes) : bytes;
      const image = png ? await output.embedPng(imageBytes) : await output.embedJpg(imageBytes);
      if (image.width < 1 || image.height < 1) throw new Error("Geçersiz görsel boyutu.");
      addImagePage(output, image, jpeg ? jpegOrientation(bytes) : 1, size);
      if (imageBytes !== bytes) {
        warnings.push(`${file.name} için animasyonun varsayılan karesi PDF’ye eklendi.`);
      }
    } catch (error) {
      throw new Error(`${file.name} açılamadı. Sağlam bir PNG veya JPEG dosyası seçin.`, { cause: error });
    }
    if (png && bytes[24] === 16) {
      warnings.push(`${file.name} için 16 bit renk derinliği PDF’de 8 bite düşürüldü.`);
    }
  }
  return pdfResult(output, { warnings });
}
