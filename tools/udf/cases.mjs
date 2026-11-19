// Writes the synthetic UDF test documents to test/udf/cases.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { compile, runJava8, toolDir } from "./java.mjs";
import { createDocument, filler } from "./udf-builder.mjs";

const root = join(toolDir, "..", "..");
const caseDir = join(root, "test", "udf", "cases");
const assetDir = join(root, "test", "udf", "assets");
if (!existsSync(join(assetDir, "photo.jpg"))) {
  compile("TestImages.java");
  runJava8("TestImages", [assetDir]);
}
const asset = name => readFileSync(join(assetDir, name));

export const cases = {
  "01-temel": d => d.build([
    d.paragraph({ Alignment: "1" }, [{ text: "T.C.", bold: "true" }]),
    d.paragraph({ Alignment: "1" }, [{ text: "ANKARA 1. ASLİYE HUKUK MAHKEMESİ", bold: "true", size: "14" }]),
    d.paragraph({}, [""]),
    d.paragraph({}, ["ESAS NO", { tab: true }, ": 2026/123"]),
    d.paragraph({}, ["KARAR NO", { tab: true }, ": 2026/456"]),
    d.paragraph({ Alignment: "2" }, ["Sağa yaslı satır"]),
    d.paragraph({ FirstLineIndent: "35.4" }, [filler(3)]),
    d.paragraph({ LeftIndent: "36.0", RightIndent: "18.0" }, [filler(2, 3)]),
    d.paragraph({ LineSpacing: "0.5", SpaceAbove: "6.0", SpaceBelow: "12.0" }, [filler(3, 1)]),
    d.paragraph({}, [{ text: "Kalın ", bold: "true" }, { text: "italik ", italic: "true" }, { text: "altı çizili", underline: "true" }, " ve ",
      { text: "kalın italik", bold: "true", italic: "true" }, " sözcükler."]),
    d.paragraph({}, [{ text: filler(2, 4), family: "Arial", size: "11" }]),
    d.paragraph({}, [{ text: filler(1, 5), size: "10" }, { text: " Büyük punto ", size: "16" }, { text: filler(1, 6), size: "8" }]),
  ]),
  "02-yasli": d => d.build([
    d.paragraph({ Alignment: "3" }, [filler(5)]),
    d.paragraph({ Alignment: "3", FirstLineIndent: "35.4" }, [filler(4, 2)]),
    d.paragraph({ Alignment: "3", LineSpacing: "0.5" }, [filler(4, 4)]),
    d.paragraph({ Alignment: "3" }, [filler(1, 1), { text: " Kalın bir bölüm de iki yana yaslanan satıra dahil edilmiştir ", bold: "true" }, filler(2, 3)]),
    d.paragraph({ Alignment: "3", LeftIndent: "28.0", RightIndent: "28.0" }, [{ text: filler(3, 5), family: "Arial", size: "11" }]),
    d.paragraph({ Alignment: "3" }, ["Kısa satır."]),
    d.paragraph({ Alignment: "3" }, [{ text: filler(3, 6), size: "13" }]),
  ]),
  "03-gorsel": d => d.build([
    d.paragraph({ Alignment: "1" }, [{ image: asset("logo.png"), width: 120, height: 60 }]),
    d.paragraph({}, [filler(1)]),
    d.paragraph({}, [{ image: asset("photo.jpg"), width: 300, height: 200 }]),
    d.paragraph({}, ["Satır içinde ", { image: asset("stamp.png"), width: 20, height: 20 }, " küçük bir görsel ve devam eden metin."]),
    d.paragraph({ Alignment: "2" }, [{ image: asset("photo.jpg"), width: 150, height: 100 }]),
    d.paragraph({ Alignment: "3" }, [filler(2, 2), { image: asset("stamp.png"), width: 12, height: 12 }, filler(2, 4)]),
  ]),
  "04-tablo": d => d.build([
    d.paragraph({}, ["Tablodan önceki paragraf."]),
    d.table({ tableName: "Sabit", columnCount: "3", columnSpans: "100,200,150", border: "borderCell" }, [
      d.row({ rowName: "row1", rowType: "dataRow" }, [
        d.cell({}, [d.paragraph({}, [{ text: "Sıra", bold: "true" }])]),
        d.cell({}, [d.paragraph({ Alignment: "1" }, [{ text: "Açıklama", bold: "true" }])]),
        d.cell({}, [d.paragraph({ Alignment: "2" }, [{ text: "Tutar", bold: "true" }])]),
      ]),
      d.row({ rowName: "row2", rowType: "dataRow" }, [
        d.cell({}, [d.paragraph({}, ["1"])]),
        d.cell({}, [d.paragraph({}, [filler(2)])]),
        d.cell({}, [d.paragraph({ Alignment: "2" }, ["1.250,00 TL"])]),
      ]),
      d.row({ rowName: "row3", rowType: "dataRow" }, [
        d.cell({}, [d.paragraph({}, ["2"])]),
        d.cell({}, [d.paragraph({}, ["Kısa açıklama"]), d.paragraph({}, ["İkinci paragraf"])]),
        d.cell({}, [d.paragraph({ Alignment: "2" }, ["980,50 TL"])]),
      ]),
    ]),
    d.paragraph({}, ["Tablodan sonraki paragraf."]),
  ]),
};

cases["05-sayfalama"] = d => d.build([
  d.paragraph({ Alignment: "1" }, [{ text: "SAYFALAMA DENEMESİ", bold: "true", size: "14" }]),
  ...Array.from({ length: 14 }, (_, index) => d.paragraph({ Alignment: index % 3 === 0 ? "3" : "0", SpaceBelow: "6.0", FirstLineIndent: index % 2 ? "28.35" : null },
    [filler(3 + (index % 4), index)])),
  d.pageBreak(),
  d.paragraph({}, ["Elle eklenen sayfa sonundan sonraki paragraf."]),
  ...Array.from({ length: 6 }, (_, index) => d.paragraph({ LineSpacing: "0.5" }, [{ text: filler(3, index + 2), size: index % 2 ? "11" : "12" }])),
]);
cases["06-kenar"] = d => d.build([
  d.paragraph({ Alignment: "1" }, [{ text: "Farklı kenar boşlukları", bold: "true" }]),
  d.paragraph({ Alignment: "2" }, ["Sağa yaslı satır"]),
  d.paragraph({ Alignment: "3" }, [filler(4)]),
  d.table({ tableName: "Sabit", columnCount: "7", columnSpans: "1,1,1,1,1,1,1", border: "borderCell" }, [
    d.row({ rowName: "row1", rowType: "dataRow" }, Array.from({ length: 7 }, (_, index) => d.cell({}, [d.paragraph({ Alignment: "1" }, [String(index + 1)])]))),
  ]),
  d.table({ tableName: "Sabit", columnCount: "2", columnSpans: "37,63", border: "borderNone" }, [
    d.row({ rowName: "row1", rowType: "dataRow" }, [d.cell({}, [d.paragraph({}, ["Kenarlıksız"])]), d.cell({}, [d.paragraph({}, [filler(1)])])]),
  ]),
  ...Array.from({ length: 30 }, (_, index) => d.paragraph({}, [filler(2, index)])),
]);
cases["07-ustalt"] = d => d.build([
  d.header({}, [d.paragraph({ Alignment: "1" }, [{ text: "T.C. ÖRNEK ADLİYESİ", bold: "true" }]), d.paragraph({ Alignment: "2" }, [{ text: "Dosya: 2026/1", size: "10" }])]),
  ...Array.from({ length: 22 }, (_, index) => d.paragraph({ Alignment: index % 2 ? "3" : "0" }, [filler(3, index)])),
  d.footer({}, [d.paragraph({ Alignment: "1" }, [{ text: "Adres: Örnek Mah. Deneme Sok. No: 1", size: "9" }]), d.paragraph({ Alignment: "1" }, [{ text: "Telefon: 0 312 000 00 00", size: "9" }])]),
]);
cases["08-ustalt-kenar"] = d => d.build([
  d.header({}, [d.paragraph({}, [{ image: asset("logo.png"), width: 60, height: 30 }]), d.paragraph({}, ["Üstbilgi ikinci satır"])]),
  ...Array.from({ length: 16 }, (_, index) => d.paragraph({}, [filler(4, index)])),
  d.footer({}, [d.paragraph({ Alignment: "2" }, ["Sağa yaslı altbilgi"])]),
]);
cases["09-sekme"] = d => d.build([
  d.paragraph({ TabSet: "100.0:0:0,250.0:1:0,350.0:2:0,450.0:4:0" }, ["Sol", { tab: true }, "Sola", { tab: true }, "Sağa yaslı", { tab: true }, "Ortalı", { tab: true }, "1.250,75"]),
  d.paragraph({ TabSet: "100.0:0:0,250.0:1:0,350.0:2:0,450.0:4:0" }, ["Uzun bir başlangıç", { tab: true }, "x", { tab: true }, "12", { tab: true }, "ab", { tab: true }, "980.5"]),
  d.paragraph({ TabSet: "150.0:0:0" }, ["DAVACI", { tab: true }, ": Örnek Kişi", { tab: true }, "son durağın ötesi"]),
  d.paragraph({ TabSet: "150.0:0:0", LeftIndent: "20.0", FirstLineIndent: "15.0" }, ["VEKİLİ", { tab: true }, ": Av. Örnek"]),
  d.paragraph({ TabSet: "85.05:0:0" }, ["DAVALI", { tab: true }, ": ", { text: "Deneme A.Ş.", bold: "true" }]),
  d.paragraph({}, ["Varsayılan", { tab: true }, "sekme", { tab: true }, { tab: true }, "çift"]),
]);
cases["10-liste"] = d => d.build([
  d.paragraph({}, ["Talepler:"]),
  ...["Davanın kabulüne,", "Yargılama giderlerinin davalıya yükletilmesine,", filler(3), "Vekâlet ücretine hükmedilmesine,"].map(text => d.paragraph({ Numbered: "true", NumberType: "NUMBER_TYPE_NUMBER_DOT", ListId: "7", ListLevel: "0", Alignment: "3" }, [text])),
  d.paragraph({}, ["Ara paragraf."]),
  ...Array.from({ length: 11 }, (_, index) => d.paragraph({ Numbered: "true", NumberType: ["NUMBER_TYPE_CHAR_SMALL_PARANTHESE", "NUMBER_TYPE_ROMAN_BIG_DOT", "NUMBER_TYPE_NUMBER_D_PARANTHESE"][index % 3], ListId: String(20 + (index % 3)), ListLevel: "0", LeftIndent: index % 2 ? "36.0" : null }, [`Madde ${index + 1}`])),
  ...["Birinci madde", "İkinci madde"].map(text => d.paragraph({ Bulleted: "true", BulletType: "BULLET_TYPE_ELLIPSE", ListId: "30", ListLevel: "0" }, [text])),
  d.paragraph({ Numbered: "true", NumberType: "NUMBER_TYPE_NUMBER_DOT", ListId: "40", ListLevel: "0", size: "16" }, [{ text: "Büyük punto", size: "16" }]),
  d.paragraph({ Bulleted: "true", BulletType: "BULLET_TYPE_ELLIPSE", ListId: "41", ListLevel: "0", size: "20", family: "Arial" }, [{ text: "Arial madde", size: "20", family: "Arial" }]),
]);
cases["11-yasli-sekme"] = d => d.build([
  d.paragraph({ Alignment: "3" }, [{ tab: true }, filler(4)]),
  d.paragraph({ Alignment: "3" }, [{ tab: true }, { tab: true }, filler(3, 2)]),
  d.paragraph({ Alignment: "3" }, ["Başlık", { tab: true }, filler(3, 4)]),
  d.paragraph({ Alignment: "3" }, [filler(1, 1), { tab: true }, filler(2, 5)]),
  d.paragraph({ Alignment: "1" }, [{ tab: true }, "Ortalı sekmeli satır"]),
  d.paragraph({ Alignment: "2" }, ["Sağa", { tab: true }, "yaslı"]),
]);
cases["12-tablo-kenar"] = d => d.build([
  d.paragraph({}, ["Dış kenarlıklı tablo:"]),
  d.table({ tableName: "Sabit", columnCount: "3", columnSpans: "100,200,150", border: "borderTable" }, [
    d.row({ rowName: "row1", rowType: "headerRow" }, ["No", "Konu", "Tutar"].map(text => d.cell({}, [d.paragraph({ Alignment: "1" }, [{ text, bold: "true" }])]))),
    d.row({ rowName: "row2", rowType: "dataRow", height: "30.0" }, ["1", filler(1), "100 TL"].map(text => d.cell({}, [d.paragraph({}, [text])]))),
  ]),
  d.paragraph({}, ["Satır kenarlıklı ve düzensiz satırlı tablo:"]),
  d.table({ tableName: "Sabit", columnCount: "3", columnSpans: "100,200,150", border: "borderRow" }, [
    d.row({ rowName: "row1", rowType: "dataRow" }, ["İki hücreli satır", "ikinci"].map(text => d.cell({}, [d.paragraph({}, [text])]))),
    d.row({ rowName: "row2", rowType: "dataRow" }, ["a", "b", "c"].map(text => d.cell({}, [d.paragraph({}, [text])]))),
    d.row({ rowName: "row3", rowType: "dataRow" }, [d.cell({}, [d.paragraph({ Alignment: "1" }, ["Tek hücre"])])]),
  ]),
  d.paragraph({}, ["Sayfaya taşan hücre kenarlıklı tablo:"]),
  d.table({ tableName: "Sabit", columnCount: "2", columnSpans: "1,3", border: "borderCell" }, [
    d.row({ rowName: "row1", rowType: "headerRow" }, ["Sıra", "Açıklama"].map(text => d.cell({}, [d.paragraph({}, [{ text, bold: "true" }])]))),
    ...Array.from({ length: 40 }, (_, index) => d.row({ rowName: `row${index + 2}`, rowType: "dataRow" }, [String(index + 1), filler(1 + (index % 2), index)].map(text => d.cell({}, [d.paragraph({}, [text])])))),
  ]),
  d.paragraph({}, ["Tablodan sonra."]),
]);
// Tables whose second row meets the page end with zero, some or all of its lines fitting.
cases["13-tablo-bolme"] = d => d.build([49, 50, 51].flatMap((count, index) => [
  ...(index ? [d.pageBreak()] : []),
  ...Array.from({ length: count }, (_, line) => d.paragraph({}, [`Paragraf ${line + 1}`])),
  d.table({ tableName: "Sabit", columnCount: "2", columnSpans: "1,9", border: index === 1 ? "borderNone" : "borderCell" }, [
    d.row({ rowName: "row1", rowType: "dataRow" }, [d.cell({}, [d.paragraph({}, ["1"])]), d.cell({}, [d.paragraph({}, ["tek satır"])])]),
    d.row({ rowName: "row2", rowType: "dataRow" }, [d.cell({}, [d.paragraph({}, ["2"])]), d.cell({}, Array.from({ length: [5, 3, 5][index] }, (_, line) => d.paragraph({}, [`madde ${line + 1}`])))]),
    d.row({ rowName: "row3", rowType: "dataRow" }, [d.cell({}, [d.paragraph({}, ["3"])]), d.cell({}, [d.paragraph({}, [filler(2, index)])])]),
  ]),
]).concat([d.paragraph({}, ["Son paragraf."])]));
// Underlined words, spaces and tabs in justified, aligned and tabbed lines.
cases["14-alti-cizili"] = d => {
  const u = (text, extra = {}) => ({ text, underline: "true", ...extra });
  const tab = (extra = {}) => ({ tab: true, underline: "true", ...extra });
  return d.build([
    d.paragraph({ Alignment: "3" }, [filler(1), u(" altı çizili bir bölüm  iki boşlukla ", { bold: "true" }), filler(2, 2)]),
    d.paragraph({ Alignment: "3" }, [u(filler(3, 4))]),
    d.paragraph({ Alignment: "3" }, [{ text: filler(2, 1), family: "Arial", size: "11" }, u(" Arial ile altı çizili boşluklar   ", { family: "Arial", size: "11" }), { text: filler(1, 3), family: "Arial", size: "11" }]),
    d.paragraph({ Alignment: "3" }, ["   Başında boşluk olan ", u("yaslı"), " paragraf. ", filler(2, 5)]),
    d.paragraph({ Alignment: "3" }, ["Sekmeli", tab(), u("yaslı satır"), " ", filler(2, 6)]),
    d.paragraph({}, ["Adı Soyadı:", tab(), tab(), tab()]),
    d.paragraph({}, ["İmza", tab(), u("          "), " Tarih: ", u("     ", { family: "Arial" })]),
    d.paragraph({ TabSet: "200.0:0:0,350.0:1:0,450.0:2:0" }, ["Sol", tab(), u("orta"), tab(), u("sağa"), tab(), u("merkez")]),
    d.paragraph({ Alignment: "1" }, [u("Ortalanmış altı çizili satır  ")]),
    d.paragraph({ Alignment: "2" }, [u("Sağa yaslı altı çizili")]),
  ]);
};
// Page numbers in the header and the footer: positions, fonts, texts and visibility flags.
cases["15-sayfa-no"] = d => d.build([
  d.header({ "pageNumber-spec": "4160", "pageNumber-foreStr": "Sayfa ", "pageNumber-fontFace": "Times New Roman", "pageNumber-fontItalic": "true", "pageNumber-fontSize": "10" },
    [d.paragraph({}, [{ text: "T.C. ÖRNEK ADLİYESİ", bold: "true" }])]),
  ...Array.from({ length: 70 }, (_, index) => d.paragraph({ Alignment: index % 3 ? "3" : "0" }, [filler(2, index)])),
  d.footer({ "pageNumber-spec": "2088", "pageNumber-seperator": " / ", "pageNumber-foreStr": "- ", "pageNumber-afterStr": " -", "pageNumber-fontBold": "true", "pageNumber-pageStartNumStr": "3" },
    [d.paragraph({ Alignment: "1" }, [{ text: "Adres: Örnek Mah. Deneme Sok. No: 1", size: "9" }])]),
]);
// Highlight, strike-through, sub- and superscript, underline at many sizes, also in justified lines.
cases["16-efektler"] = d => d.build([
  ...["Times New Roman", "Arial"].flatMap(family => [8, 12, 16, 24, 36].flatMap(size => {
    const s = String(size);
    return [
      d.paragraph({}, [{ text: `N${size} `, size: s, family }, { text: "üst", size: s, family, superscript: "true" }, { text: " orta ", size: s, family }, { text: "alt", size: s, family, subscript: "true" }, { text: " son", size: s, family }]),
      d.paragraph({}, [{ text: `S${size} `, size: s, family }, { text: "çizili", size: s, family, strikethrough: "true" }, { text: " ", size: s, family },
        { text: "altıçizili", size: s, family, underline: "true" }, { text: " ", size: s, family }, { text: "vurgu", size: s, family, background: "-256" }]),
    ];
  })),
  d.paragraph({}, [{ text: "Karma ", size: "12" }, { text: "büyük", size: "24" }, { text: " küçük vurgu", size: "10", background: "-16711936" },
    { text: " üst", size: "10", superscript: "true", background: "-65536" }, { text: " alt", size: "10", subscript: "true", strikethrough: "true" }]),
  d.paragraph({ Alignment: "3" }, [filler(1), { text: " vurgulu ve çizili yaslı bölüm ", background: "-3355393", strikethrough: "true" }, filler(1, 2),
    { text: " altı çizili üst simge", underline: "true", superscript: "true" }, filler(1, 3)]),
  d.paragraph({}, ["Renksiz arka planlar: ", { text: "eksi bir", background: "-1" }, " ", { text: "sıfır", background: "0" }, " ", { text: "beyaz", background: "16777215" }]),
  d.paragraph({}, ["Sekme", { tab: true, background: "-256", strikethrough: "true" }, { text: "son", background: "-256" }]),
]);
// Cell, row and table border settings and rows with their own column spans.
cases["17-tablo-bicim"] = d => {
  const cell = (attrs, text) => d.cell(attrs, [d.paragraph({}, [text])]);
  return d.build([
    d.paragraph({}, ["Hücre kenarlıkları:"]),
    d.table({ tableName: "A", columnCount: "3", columnSpans: "1,1,1", border: "borderCell" }, [
      d.row({ rowName: "r1", rowType: "dataRow" }, [
        cell({ borderSpec: "31", borderWidth: "2.0", borderColor: "-65536" }, "kırmızı 2"),
        cell({ borderSpec: "3", borderStyle: "borderStyle-dashed", borderWidth: "1.0" }, "üst kesik"),
        cell({ borderSpec: "25", borderStyle: "borderStyle-dotted", borderWidth: "1.0" }, "alt sol nokta"),
      ]),
      d.row({ rowName: "r2", rowType: "dataRow", columnSpans: "2,1" }, [cell({ borderStyle: "borderStyle-dottedDashed", borderWidth: "1.5" }, "birleşik"), cell({ borderSpec: "1" }, "hiç")]),
      d.row({ rowName: "r3", rowType: "dataRow", columnSpans: "1,3,2" }, [cell({}, "a"), cell({ borderSpec: "5" }, "b"), cell({ borderStyle: "borderStyle-xyz" }, "c")]),
      d.row({ rowName: "r4", rowType: "dataRow" }, [cell({ borderSpec: "19", borderStyle: "borderStyle-plain", borderWidth: "0.75", borderColor: "-16776961" }, filler(1)), cell({}, "d"), cell({ borderSpec: "13" }, "e")]),
    ]),
    d.paragraph({}, ["Satır kenarlıkları:"]),
    d.table({ tableName: "B", columnCount: "2", columnSpans: "1,1", border: "borderRow" }, [
      d.row({ rowName: "r1", rowType: "dataRow", borderSpec: "9", borderColor: "-16776961", borderWidth: "1.0" }, [cell({}, "x"), cell({}, "y")]),
      d.row({ rowName: "r2", rowType: "dataRow", borderStyle: "borderStyle-dashed", borderWidth: "0.5" }, [cell({}, "z"), cell({}, "w")]),
    ]),
    d.paragraph({}, ["Tablo kenarlığı:"]),
    d.table({ tableName: "C", columnCount: "2", columnSpans: "1,1", border: "borderTable", borderStyle: "borderStyle-dotted", borderWidth: "2.0", borderColor: "-16744448" }, [
      d.row({ rowName: "r1", rowType: "dataRow" }, [cell({}, "p"), cell({}, "q")]),
      d.row({ rowName: "r2", rowType: "dataRow" }, [cell({}, "s"), cell({}, "t")]),
    ]),
  ]);
};
// Rows split across pages for every border kind, a table border over pages and a row
// longer than two pages, all above a footer.
cases["18-tablo-sayfa"] = d => {
  const cell = (lines, from = 1) => d.cell({}, Array.from({ length: lines }, (_, i) => d.paragraph({}, [`satır ${from + i}`])));
  const lead = count => Array.from({ length: count }, (_, i) => d.paragraph({}, [filler(1, i).slice(0, 60)]));
  const table = (border, rows) => d.table({ tableName: border, columnCount: "2", columnSpans: "1,2", border }, rows.map((lines, i) =>
    d.row({ rowName: `r${i}`, rowType: "dataRow" }, [cell(lines), cell(Math.max(1, lines - 2), 100)])));
  return d.build([
    ...lead(45), table("borderRow", [1, 9, 2]),
    d.pageBreak(), ...lead(40), table("borderTable", [1, 2, 1, 2, 1, 2, 1, 2, 1, 2]),
    d.pageBreak(), ...lead(47), table("borderCell", [1, 9, 2]),
    d.pageBreak(), ...lead(3), table("borderCell", [1, 120]),
    d.paragraph({}, ["Son"]),
    d.footer({}, [d.paragraph({ Alignment: "1" }, [{ text: "Altbilgi", size: "9" }]), d.paragraph({ Alignment: "1" }, [{ text: "ikinci satır", size: "9" }])]),
  ]);
};
// Lists: every number and bullet style over levels 1–7, start numbers, level styles,
// both flags, lists without an id, long letter lists, indents, spacing, hanging
// indents, a list in a table and markers taking the first run's font.
cases["19-listeler"] = d => {
  const numberTypes = ["NUMBER_TYPE_NUMBER_DOT", "NUMBER_TYPE_ROMAN_BIG_TRE", "NUMBER_TYPE_CHAR_SMALL_D_PARANTHESE", "NUMBER_TYPE_NUMBER_DOT_2",
    "NUMBER_TYPE_NUMBER_PARANTHESE_2", "NUMBER_TYPE_CHAR_BIG_2", "NUMBER_TYPE_NUMBER_DOT_3"];
  const bulletTypes = ["BULLET_TYPE_ELLIPSE", "BULLET_TYPE_RECTANGLE", "BULLET_TYPE_RECTANGLE_D", "BULLET_TYPE_ARROW", "BULLET_TYPE_DIAMOND", "BULLET_TYPE_TRIANGLE", "BULLET_TYPE_DIAMOND_2"];
  return d.build([
    ...numberTypes.flatMap((type, t) => [d.paragraph({}, [type]),
      ...[1, 2, 3, 4, 5, 6, 7, 2, 1].map((level, i) => d.paragraph({ Numbered: "true", NumberType: type, ListId: String(100 + t), ListLevel: String(level), LeftIndent: String(18 * level) },
        [`${type.slice(12)} düzey ${level} öğe ${i + 1}`]))]),
    d.pageBreak(),
    ...bulletTypes.flatMap((type, t) => [d.paragraph({}, [type]),
      ...[1, 2, 3, 4, 5, 6].map(level => d.paragraph({ Bulleted: "true", BulletType: type, ListId: String(200 + t), ListLevel: String(level), LeftIndent: String(20 * level) },
        [{ text: `madde ${level}`, size: String(8 + level * 3) }]))]),
    d.pageBreak(),
    ...[0, 1, 2, 3].map(i => d.paragraph({ Numbered: "true", ListId: "300", ...(i === 2 ? { NumberSetted: "6" } : {}) }, [`öğe ${i}`])),
    d.paragraph({ Numbered: "true", ListId: "301", ListLevel: "2", SecListTypeLevel2: "BULLET_TYPE_ARROW" }, ["düzey türü madde"]),
    d.paragraph({ Bulleted: "true", Numbered: "true", ListId: "301", ListLevel: "1", SecListTypeLevel1: "NUMBER_TYPE_ROMAN_SMALL_DOT" }, ["iki bayrak, düzey türüyle"]),
    d.paragraph({ Bulleted: "true", Numbered: "true", ListId: "301", ListLevel: "1" }, ["iki bayrak, düzey türü yok"]),
    d.paragraph({ Numbered: "true" }, ["kimliksiz liste"]),
    d.paragraph({ Numbered: "true", ListId: "302", FirstLineIndent: "21.3", LeftIndent: "36.0" }, [filler(1)]),
    d.paragraph({ Bulleted: "true", ListId: "303", FirstLineIndent: "-18.0", LeftIndent: "36.0", Hanging: "18.0" }, [filler(2, 1)]),
    d.paragraph({ Numbered: "true", ListId: "304", LineSpacing: "0.5", SpaceAbove: "7.0" }, ["satır aralıklı"]),
    d.paragraph({ Numbered: "true", ListId: "304", Alignment: "1" }, ["ortalanmış"]),
    d.paragraph({ Numbered: "true", ListId: "305", NumberType: "NUMBER_TYPE_ROMAN_SMALL_DOT", NumberSetted: "6" }, [{ text: "kalın", bold: "true", size: "16" }, " sonra normal"]),
    d.paragraph({ Numbered: "true", ListId: "306" }, [{ text: "üst", superscript: "true" }, " simge ile"]),
    ...Array.from({ length: 31 }, (_, i) => d.paragraph({ Numbered: "true", ListId: "307", NumberType: "NUMBER_TYPE_CHAR_SMALL_DOT" }, [`harf ${i + 1}`])),
    d.table({ tableName: "T", columnCount: "2", columnSpans: "1,1", border: "borderCell" }, [
      d.row({ rowName: "r", rowType: "dataRow" }, [d.cell({}, [d.paragraph({ Numbered: "true", ListId: "300", LeftIndent: "20.0" }, ["hücrede"])]),
        d.cell({}, [d.paragraph({ Bulleted: "true", ListId: "308", LeftIndent: "20.0" }, ["hücre madde"])])]),
    ]),
    d.paragraph({ Numbered: "true", ListId: "300" }, ["tablodan sonra"]),
  ]);
};
// Font sizes UYAP Editör cannot read with Integer.parseInt (decimals, spaces), as other
// programs write them: UYAP ignores them and the text takes the paragraph's size, else
// the default. "+9" is read.
cases["20-okunamayan-boyut"] = d => d.build([
  d.paragraph({}, [{ text: "Kalın on buçuk ", bold: "true", size: "10.5" }, { text: "on altı", size: "16" }]),
  d.paragraph({ size: "18" }, [{ text: "Paragraf on sekiz, yazı on buçuk", size: "10.5" }]),
  d.paragraph({ size: "13.5" }, ["Paragraf on üç buçuk, yazıda boyut yok"]),
  d.paragraph({ size: "14" }, [{ text: "Boşluklu", size: " 12" }, { text: " on iki nokta sıfır", size: "12.0" }, { text: " artılı dokuz", size: "+9" }]),
  d.paragraph({}, [{ text: "Sekme", size: "16" }, { tab: true, size: "20.5" }, { text: "sonrası", size: "16" }]),
  d.paragraph({ Alignment: "3" }, [{ text: filler(2), size: "11.5" }]),
  d.table({ tableName: "T", columnCount: "2", columnSpans: "1,1", border: "borderCell" }, [
    d.row({ rowName: "r", rowType: "dataRow" }, [
      d.cell({}, [d.paragraph({ size: "16" }, [{ text: "hücre on altı", size: "8.5" }])]),
      d.cell({}, [d.paragraph({}, [{ text: "hücre on iki", size: "16.0" }])]),
    ]),
  ]),
  d.footer({}, [d.paragraph({ Alignment: "1" }, [{ text: "Altbilgi", size: "9.5" }])]),
]);
const caseOptions = {
  "08-ustalt-kenar": { page: { leftMargin: "56.7", rightMargin: "56.7", topMargin: "70.9", bottomMargin: "35.4", headerFOffset: "28.4", footerFOffset: "17.0" } }, "06-kenar": { page: { leftMargin: "70.86614", rightMargin: "28.346457", topMargin: "56.692913", bottomMargin: "30.0" } } };

mkdirSync(caseDir, { recursive: true });
const only = process.argv.slice(2);
for (const [name, build] of Object.entries(cases)) {
  if (only.length && !only.includes(name)) continue;
  writeFileSync(join(caseDir, `${name}.udf`), build(createDocument(caseOptions[name])));
  console.log(`${name}.udf`);
}
