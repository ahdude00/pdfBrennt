import fontkit from "@pdf-lib/fontkit";

export function udfFontFamilyKey(family) {
  return (family ?? "").normalize("NFC").trim().replace(/\s+/gu, " ").toLowerCase();
}

function readTrueTypeTables(view, fileName) {
  const invalid = `“${fileName}” okunabilir bir yazı tipi dosyası değil.`;
  if (view.byteLength < 12) throw new Error(invalid);
  const signature = view.getUint32(0);
  if (signature !== 0x00010000 && signature !== 0x74727565) {
    throw new Error(`“${fileName}” desteklenmiyor. Tek yazı tipi içeren statik bir TrueType (.ttf) dosyası seçin.`);
  }

  const tableCount = view.getUint16(4);
  const directoryEnd = 12 + tableCount * 16;
  if (!tableCount || directoryEnd > view.byteLength) throw new Error(invalid);
  const tables = new Map();
  for (let record = 12; record < directoryEnd; record += 16) {
    const tag = String.fromCharCode(...[0, 1, 2, 3].map(index => view.getUint8(record + index)));
    const offset = view.getUint32(record + 8);
    const length = view.getUint32(record + 12);
    if ((length && offset < directoryEnd) || offset + length > view.byteLength || tables.has(tag)) {
      throw new Error(invalid);
    }
    tables.set(tag, { offset, length });
  }

  if (tables.has("fvar") || !tables.get("glyf")?.length || !tables.get("loca")?.length) {
    throw new Error(`“${fileName}” için statik, TrueType çizgileri içeren bir yazı tipi dosyası seçin.`);
  }
  const os2 = tables.get("OS/2");
  if (!os2 || os2.length < 64 || !(tables.get("head")?.length >= 54)) {
    throw new Error(`“${fileName}” dosyasının biçim veya PDF gömme bilgileri okunamadı.`);
  }
  return { os2, head: tables.get("head") };
}

function subsetAllowed(view, os2Offset, fileName) {
  // OpenType OS/2 fsType stores the permissions and restrictions separately.
  const version = view.getUint16(os2Offset);
  const flags = view.getUint16(os2Offset + 8);
  let permission = flags & 0x000f;
  if (version <= 2 && !(permission & 0x0001)) {
    // Older fonts can declare multiple levels, with the least restrictive taking effect.
    permission = permission & 0x0008 ? 8 : permission & 0x0004 ? 4 : permission;
  }
  if (![0, 4, 8].includes(permission) || (flags & 0x0200)) {
    throw new Error(`“${fileName}” yazı tipi PDF’ye gömmeye izin vermiyor.`);
  }
  return !(flags & 0x0100);
}

async function readFont(file) {
  let bytes;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    throw new Error(`“${file.name}” yazı tipi dosyası okunamadı.`);
  }
  const view = new DataView(bytes.buffer);
  const { os2, head } = readTrueTypeTables(view, file.name);
  const subset = subsetAllowed(view, os2.offset, file.name);
  const selection = view.getUint16(os2.offset + 62);
  const macStyle = view.getUint16(head.offset + 44);
  const bold = Boolean(selection & 0x0020);
  const italic = Boolean(selection & 0x0001);
  if (Boolean(macStyle & 0x0001) !== bold || Boolean(macStyle & 0x0002) !== italic) {
    throw new Error(`“${file.name}” yazı tipinin kalın veya italik biçim bilgileri birbiriyle uyuşmuyor.`);
  }
  const face = bold ? (italic ? "boldItalic" : "bold") : (italic ? "italic" : "regular");

  let family;
  try {
    family = fontkit.create(bytes).familyName?.trim();
  } catch {
    throw new Error(`“${file.name}” yazı tipi bilgileri okunamadı.`);
  }
  if (!family) throw new Error(`“${file.name}” yazı tipi ailesi belirlenemedi.`);
  return { family, face, bytes, subset, fileName: file.name };
}

export async function loadUdfCustomFonts(files) {
  const families = new Map();
  for (const file of files) {
    const { family, face, ...font } = await readFont(file);
    const key = udfFontFamilyKey(family);
    const entry = families.get(key) ?? { family, faces: {} };
    if (entry.faces[face]) {
      throw new Error(`“${font.fileName}” ve “${entry.faces[face].fileName}” aynı yazı tipi ailesine ve biçimine ait. Birini seçin.`);
    }
    entry.faces[face] = font;
    families.set(key, entry);
  }
  return families;
}
