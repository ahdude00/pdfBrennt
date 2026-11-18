// A small, strict XML reader for UDF content.xml. It runs without the DOM, so the
// converter also works in a Web Worker and in Node.

const entities = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

function decode(value, fail) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (match, name) => {
    if (name[0] === "#") {
      const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      if (!Number.isFinite(code) || code > 0x10ffff) fail();
      return String.fromCodePoint(code);
    }
    if (!(name in entities)) fail();
    return entities[name];
  });
}

const namePattern = /[A-Za-z_][\w.:-]*/y;
const attributePattern = /\s+([A-Za-z_][\w.:-]*)\s*=\s*("([^"]*)"|'([^']*)')/y;

export function parseXml(source, fail) {
  let index = 0;
  const root = { name: "#document", attributes: {}, children: [], text: "" };
  const stack = [root];
  if (source.charCodeAt(0) === 0xfeff) index = 1;
  while (index < source.length) {
    const open = source.indexOf("<", index);
    const parent = stack.at(-1);
    if (open < 0) {
      if (source.slice(index).trim()) fail();
      break;
    }
    if (open > index) {
      const text = source.slice(index, open);
      if (stack.length === 1) {
        if (text.trim()) fail();
      } else parent.text += decode(text, fail);
    }
    if (source.startsWith("<![CDATA[", open)) {
      const end = source.indexOf("]]>", open + 9);
      if (end < 0 || stack.length === 1) fail();
      parent.text += source.slice(open + 9, end);
      index = end + 3;
    } else if (source.startsWith("<!--", open)) {
      const end = source.indexOf("-->", open + 4);
      if (end < 0) fail();
      index = end + 3;
    } else if (source.startsWith("<?", open)) {
      const end = source.indexOf("?>", open + 2);
      if (end < 0) fail();
      index = end + 2;
    } else if (source.startsWith("<!", open)) {
      // DOCTYPE and entity declarations are not part of UDF.
      fail("UDF belgesinin XML tanımı desteklenmiyor.");
    } else if (source[open + 1] === "/") {
      namePattern.lastIndex = open + 2;
      const match = namePattern.exec(source);
      if (!match) fail();
      const end = source.indexOf(">", namePattern.lastIndex);
      if (end < 0 || source.slice(namePattern.lastIndex, end).trim()) fail();
      const element = stack.pop();
      if (!element || element === root || element.name !== match[0]) fail();
      index = end + 1;
    } else {
      namePattern.lastIndex = open + 1;
      const match = namePattern.exec(source);
      if (!match) fail();
      const element = { name: match[0], attributes: {}, children: [], text: "" };
      let cursor = namePattern.lastIndex;
      for (;;) {
        attributePattern.lastIndex = cursor;
        const attribute = attributePattern.exec(source);
        if (!attribute) break;
        if (Object.hasOwn(element.attributes, attribute[1])) fail();
        element.attributes[attribute[1]] = decode(attribute[3] ?? attribute[4], fail);
        cursor = attributePattern.lastIndex;
      }
      const rest = /\s*(\/?)>/y;
      rest.lastIndex = cursor;
      const close = rest.exec(source);
      if (!close) fail();
      if (stack.length === 1 && root.children.length) fail();
      parent.children.push(element);
      if (!close[1]) stack.push(element);
      index = rest.lastIndex;
    }
  }
  if (stack.length !== 1 || root.children.length !== 1) fail();
  return root.children[0];
}
