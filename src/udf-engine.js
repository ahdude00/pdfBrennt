// Browser entry for UDF conversion. The conversion itself lives in ./udf/convert.js.
import { zipSync } from "fflate";
import { convertUdf, inspectUdf } from "./udf/convert.js";
import { defaultUdfFontFamily } from "./udf-font-presets.js";
import regularUrl from "./udf-fonts/LiberationSerif-Regular.ttf?url";
import boldUrl from "./udf-fonts/LiberationSerif-Bold.ttf?url";
import italicUrl from "./udf-fonts/LiberationSerif-Italic.ttf?url";
import boldItalicUrl from "./udf-fonts/LiberationSerif-BoldItalic.ttf?url";
import sansRegularUrl from "./udf-fonts/LiberationSans-Regular.ttf?url";
import sansBoldUrl from "./udf-fonts/LiberationSans-Bold.ttf?url";
import sansItalicUrl from "./udf-fonts/LiberationSans-Italic.ttf?url";
import sansBoldItalicUrl from "./udf-fonts/LiberationSans-BoldItalic.ttf?url";

// Paragraph layout was first adapted from egPDF's MIT-licensed UDF renderer
// (acc-studio/egpdf at c14775fd388cc49c5e9884d4a1b01340261ae0ec) and has since been
// rebuilt against UYAP Editör exports. Redistribution notices are in public/licenses.

const fontUrls = {
  "Liberation Serif": { regular: regularUrl, bold: boldUrl, italic: italicUrl, boldItalic: boldItalicUrl },
  "Liberation Sans": { regular: sansRegularUrl, bold: sansBoldUrl, italic: sansItalicUrl, boldItalic: sansBoldItalicUrl },
};
const fileBytes = new WeakMap();

async function readFile(file) {
  if (!fileBytes.has(file)) fileBytes.set(file, file.arrayBuffer().then(buffer => new Uint8Array(buffer)));
  return fileBytes.get(file);
}

async function loadFallbackFont(family, face) {
  const response = await fetch(fontUrls[family][face]);
  if (!response.ok) throw new Error("UDF yazı tipi yüklenemedi. Yeniden deneyin.");
  return new Uint8Array(await response.arrayBuffer());
}

export async function inspectUdfFonts(file, defaultFontFamily = defaultUdfFontFamily) {
  if (!file.size || file.size > 16 * 1024 * 1024) throw new Error("16 MB veya daha küçük, geçerli bir UDF seçin.");
  return inspectUdf(await readFile(file), defaultFontFamily);
}

export async function udfToPdf(file, customFonts = new Map(), defaultFontFamily = defaultUdfFontFamily) {
  return convertUdf(await readFile(file), { customFonts, defaultFamily: defaultFontFamily, loadFallbackFont });
}

// Several converted PDFs in one ZIP. PDF streams are already compressed.
export function zipFiles(entries) {
  return zipSync(entries, { level: 0 });
}
