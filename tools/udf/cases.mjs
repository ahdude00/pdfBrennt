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
const caseOptions = { "06-kenar": { page: { leftMargin: "70.86614", rightMargin: "28.346457", topMargin: "56.692913", bottomMargin: "30.0" } } };

mkdirSync(caseDir, { recursive: true });
const only = process.argv.slice(2);
for (const [name, build] of Object.entries(cases)) {
  if (only.length && !only.includes(name)) continue;
  writeFileSync(join(caseDir, `${name}.udf`), build(createDocument(caseOptions[name])));
  console.log(`${name}.udf`);
}
