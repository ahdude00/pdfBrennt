// UDF → PDF conversion core. It has no browser dependencies: the caller supplies
// the bytes of the bundled fallback fonts through `loadFallbackFont`.
import {
  PDFDocument, beginText, endText, popGraphicsState, pushGraphicsState, rgb,
  setFillingColor, setFontAndSize, setTextMatrix, showText,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { udfFontFamilyKey } from "../udf-custom-fonts.js";
import { defaultUdfFontFamily, udfFontPresets } from "../udf-font-presets.js";
import { fail, parseUdf } from "./document.js";
import { layoutDocument } from "./layout.js";
import { hasJavaMetrics, measureFont } from "./metrics.js";

const faceLabels = { regular: "normal", bold: "kalın", italic: "italik", boldItalic: "kalın italik" };
const fallbackFamilies = new Map(udfFontPresets.flatMap(({ family, fallback }) => [
  [udfFontFamilyKey(family), fallback],
  [udfFontFamilyKey(fallback), fallback],
]));
// Java logical font names and the physical fonts they stand for on Windows.
const logicalFamilies = new Map([["serif", "Times New Roman"], ["sansserif", "Arial"], ["sans-serif", "Arial"]]);
const javaFamilyOf = new Map([["liberation serif", "times new roman"], ["liberation sans", "arial"]]);
const parsed = new WeakMap();

function load(bytes) {
  if (!parsed.has(bytes)) parsed.set(bytes, parseUdf(bytes));
  return parsed.get(bytes);
}

function styleFamily(style, defaultFamily) {
  const name = style.family?.trim() || defaultFamily;
  return logicalFamilies.get(udfFontFamilyKey(name)) ?? name;
}

function styleFace(style) {
  for (const key of ["bold", "italic"]) {
    if (style[key] != null && !["true", "false"].includes(style[key])) fail();
  }
  const bold = style.bold === "true";
  const italic = style.italic === "true";
  return bold ? (italic ? "boldItalic" : "bold") : (italic ? "italic" : "regular");
}

function* paragraphs(blocks) {
  for (const block of blocks) {
    if (block.type === "paragraph") yield block;
    else if (block.type === "table") for (const row of block.rows) for (const cell of row.cells) yield* paragraphs(cell.blocks);
  }
}

function collectFontRequirements(blocks, defaultFamily) {
  const needed = new Map();
  for (const block of paragraphs(blocks)) {
    const styles = block.runs.filter(run => run.type === "text").map(run => run.style);
    for (const style of [...styles, block.settings]) {
      const family = styleFamily(style, defaultFamily);
      const key = udfFontFamilyKey(family);
      const requirement = needed.get(key) ?? { family, faces: new Set() };
      requirement.faces.add(styleFace(style));
      needed.set(key, requirement);
    }
  }
  return [...needed.values()].map(({ family, faces }) => ({ family, faces: [...faces] }));
}

export function inspectUdf(bytes, defaultFamily = defaultUdfFontFamily) {
  const model = load(bytes);
  return collectFontRequirements(model.blocks, defaultFamily);
}

export async function convertUdf(bytes, { customFonts = new Map(), defaultFamily = defaultUdfFontFamily, loadFallbackFont }) {
  const model = load(bytes);
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const embedded = new Map();
  const alternativeFonts = new Map();
  const approximate = new Set();

  async function face(style) {
    const family = styleFamily(style, defaultFamily);
    const key = udfFontFamilyKey(family);
    const faceName = styleFace(style);
    const supplied = customFonts.get(key)?.faces[faceName];
    const fallback = fallbackFamilies.get(key);
    if (!supplied) {
      if (customFonts.size || !fallback) fail(`Belge için “${family}” yazı tipinin ${faceLabels[faceName]} TTF dosyasını ekleyin.`);
      if (key !== udfFontFamilyKey(fallback)) alternativeFonts.set(key, { family, fallback });
    }
    const fontKey = `${supplied ? key : udfFontFamilyKey(fallback)}:${faceName}`;
    if (!embedded.has(fontKey)) {
      const bytes = supplied?.bytes ?? await loadFallbackFont(fallback, faceName);
      const metrics = fontkit.create(bytes);
      const font = await document.embedFont(bytes, {
        subset: supplied?.subset ?? true,
        features: { kern: false, liga: false, clig: false, calt: false },
      });
      const javaFamily = javaFamilyOf.get(udfFontFamilyKey(supplied ? family : fallback)) ?? key;
      const exact = hasJavaMetrics(javaFamily);
      if (!exact) approximate.add(family);
      embedded.set(fontKey, {
        font, metrics, javaFamily, exact, faceName, sizes: new Map(),
        characters: new Set(font.getCharacterSet()), family: supplied ? family : fallback,
      });
    }
    return embedded.get(fontKey);
  }

  const fonts = {
    async get(style, size) {
      const entry = await face(style);
      if (!entry.sizes.has(size)) {
        entry.sizes.set(size, measureFont({ metrics: entry.metrics, familyKey: entry.javaFamily, face: entry.faceName, size, exact: entry.exact }));
      }
      return { pdfFont: entry.font, measure: entry.sizes.get(size), characters: entry.characters, family: entry.family };
    },
  };

  for (const { family, faces } of collectFontRequirements(model.blocks, defaultFamily)) {
    if (!customFonts.size) continue;
    const supplied = customFonts.get(udfFontFamilyKey(family));
    const missing = faces.filter(name => !supplied?.faces[name]);
    if (missing.length) fail(`“${family}” için şu TTF biçimlerini ekleyin: ${missing.map(name => faceLabels[name]).join(", ")}.`);
  }

  const layout = await layoutDocument(model, fonts);
  const images = new Map();
  for (const items of layout.pages.map(pageLayout => pageLayout.items)) {
    const page = document.addPage(layout.pageSize);
    const fontKeys = new Map();
    const text = [];
    for (const item of items) {
      if (item.type !== "text") continue;
      if (!fontKeys.has(item.font.pdfFont)) fontKeys.set(item.font.pdfFont, page.node.newFontDictionary("UdfFont", item.font.pdfFont.ref));
      text.push(setFillingColor(rgb(...item.color.map(value => value / 255))), setFontAndSize(fontKeys.get(item.font.pdfFont), item.size),
        setTextMatrix(1, 0, 0, 1, item.x, item.y), showText(item.font.pdfFont.encodeText(item.text)));
    }
    if (text.length) page.pushOperators(pushGraphicsState(), beginText(), ...text, endText(), popGraphicsState());
    for (const item of items) {
      if (item.type === "line") {
        page.drawLine({ start: { x: item.x0, y: item.y }, end: { x: item.x1, y: item.y }, thickness: 1, color: rgb(...item.color.map(value => value / 255)) });
      } else if (item.type === "rect") {
        page.drawRectangle({ x: item.x, y: item.y, width: item.width, height: item.height, borderWidth: 1, borderColor: rgb(0, 0, 0) });
      } else if (item.type === "image") {
        if (!images.has(item.image)) {
          // The original image bytes are embedded unchanged.
          images.set(item.image, item.image.format === "png" ? await document.embedPng(item.image.bytes) : await document.embedJpg(item.image.bytes));
        }
        page.drawImage(images.get(item.image), { x: item.x, y: item.y, width: item.width, height: item.height });
      }
    }
  }
  document.setProducer("PDF Brennt");
  const warnings = [...alternativeFonts.values()].map(({ family, fallback }) =>
    `“${family}” için ${fallback} kullanıldı. Satır ve sayfa düzeni korunur, harf biçimleri biraz farklı görünebilir.`);
  if (approximate.size) warnings.push(`${[...approximate].join(", ")} için UYAP ölçüleri bilinmiyor. Yerleşim yaklaşık olabilir, önizlemeyi kontrol edin.`);
  if (model.signed) warnings.push("Bu UDF e-imzalı. PDF belgenin görüntüsüdür, imza PDF’ye taşınmaz ve doğrulanmaz.");
  return {
    bytes: await document.save(),
    mimeType: "application/pdf",
    pageCount: document.getPageCount(),
    fileCount: 1,
    warnings,
  };
}
