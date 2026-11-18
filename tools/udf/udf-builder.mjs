// Builds synthetic UDF 1.8 documents in the layout UYAP Editör writes.
import { strToU8, zipSync } from "fflate";

const defaultStyles = '<style name="default" description="Geçerli" family="Dialog" size="12" bold="false" italic="false" ' +
  'FONT_ATTRIBUTE_KEY="javax.swing.plaf.FontUIResource[family=Dialog,name=Dialog,style=plain,size=12]" foreground="-13421773" />' +
  '<style name="hvl-default" family="Times New Roman" size="12" description="Gövde" />';
const imagePlaceholder = "¸";

function escape(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function attributes(values = {}) {
  return Object.entries(values)
    .filter(([, value]) => value != null)
    .map(([name, value]) => ` ${name}="${escape(value)}"`)
    .join("");
}

export function createDocument({ page = {}, styles = defaultStyles, resolver = "hvl-default" } = {}) {
  let text = "";

  function segment(tag, value, values) {
    const start = text.length;
    text += value;
    return `<${tag}${attributes(values)} startOffset="${start}" length="${value.length}" />`;
  }

  function run(item, isLast) {
    if (typeof item === "string") item = { text: item };
    const { text: value, tab, image, width, height, ...values } = item;
    if (tab) return segment("tab", "\t", values) + (isLast ? segment("content", "\n", {}) : "");
    if (image) {
      const data = Buffer.from(image).toString("base64");
      return segment("image", imagePlaceholder, { imageData: data, width: width.toFixed(1), height: height.toFixed(1), ...values }) +
        (isLast ? segment("content", "\n", {}) : "");
    }
    return segment("content", isLast ? `${value}\n` : value, values);
  }

  const api = {
    paragraph(values, runs = []) {
      const items = runs.length ? runs : [""];
      return `<paragraph${attributes(values)}>${items.map((item, index) => run(item, index === items.length - 1)).join("")}</paragraph>\n`;
    },
    pageBreak() {
      return `<page-break>${api.paragraph({}, [""])}</page-break>\n`;
    },
    table(values, rows) {
      return `<table${attributes(values)}>${rows.join("")}</table>\n`;
    },
    row(values, cells) {
      return `<row${attributes(values)}>${cells.join("")}</row>`;
    },
    cell(values, blocks) {
      return `<cell${attributes(values)}>${blocks.join("")}</cell>`;
    },
    header(values, blocks) {
      return `<header${attributes(values)}>${blocks.join("")}</header>\n`;
    },
    footer(values, blocks) {
      return `<footer${attributes(values)}>${blocks.join("")}</footer>\n`;
    },
    build(elements) {
      const pageFormat = {
        mediaSizeName: "1", leftMargin: "42.525000000000006", rightMargin: "42.525000000000006",
        topMargin: "42.525000000000006", bottomMargin: "42.52500000000006", paperOrientation: "1",
        headerFOffset: "20.0", footerFOffset: "20.0", ...page,
      };
      if (text.includes("]]>")) throw new Error("CDATA terminator in text");
      // UYAP Editör ends the text pool with one newline that no element covers.
      const xml = '<?xml version="1.0" encoding="UTF-8" ?> \n\n<template format_id="1.8" >\n' +
        `<content><![CDATA[${text}\n]]></content><properties><pageFormat${attributes(pageFormat)} /></properties>\n` +
        `<elements resolver="${resolver}" >\n${elements.join("")}</elements>\n<styles>${styles}</styles>\n</template>\n`;
      return zipSync({ "content.xml": strToU8(xml) });
    },
  };
  return api;
}

const sentences = [
  "Davacı vekili dilekçesinde, müvekkilinin taraf olduğu sözleşmeden doğan alacağın ödenmediğini ileri sürmüştür.",
  "Davalı taraf, süresi içinde sunduğu cevap dilekçesinde zamanaşımı itirazında bulunarak davanın reddini istemiştir.",
  "Mahkemece yapılan yargılama sonunda, bilirkişi raporu ve tanık beyanları birlikte değerlendirilmiştir.",
  "Dosyadaki belgelerin incelenmesinden, ödeme tarihinin taraflarca açıkça kararlaştırıldığı anlaşılmaktadır.",
  "Bu nedenle, faiz başlangıcının temerrüt tarihi olarak belirlenmesi gerektiği sonucuna varılmıştır.",
  "Çığırtkan, şüpheli ve öğüt kelimeleri Türkçe karakter düzenini sınamak için metne eklenmiştir.",
  "İstanbul, Ankara ve İzmir adliyelerinde görülen benzer dosyalarda da aynı yöntem izlenmiştir.",
  "Gerekçeli kararın tebliğinden itibaren iki hafta içinde istinaf yoluna başvurulabileceği bildirilmiştir.",
];

export function filler(count, offset = 0) {
  return Array.from({ length: count }, (_, index) => sentences[(index + offset) % sentences.length]).join(" ");
}
