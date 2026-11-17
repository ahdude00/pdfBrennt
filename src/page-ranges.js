export function parseRange(input, pageCount) {
  if (!input.trim()) return { error: "Bir sayfa aralığı girin." };
  const groups = [];
  const selected = new Set();
  for (const part of input.split(",")) {
    const match = part.trim().match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/u);
    if (!match) return { error: "Aralığı 2-4, 7 biçiminde girin." };
    const first = Number(match[1]);
    const last = Number(match[2] ?? match[1]);
    if (first < 1 || last > pageCount || first > last) {
      return { error: `1 ile ${pageCount} arasında artan aralıklar kullanın.` };
    }
    const group = [];
    for (let page = first; page <= last; page++) {
      if (selected.has(page)) return { error: "Her sayfayı bir kez seçin." };
      selected.add(page);
      group.push(page);
    }
    groups.push(group);
  }
  return { groups, pages: [...selected] };
}

export function formatRange(pages) {
  const groups = [];
  for (const page of pages) {
    const group = groups.at(-1);
    if (group?.end + 1 === page) group.end = page;
    else groups.push({ start: page, end: page });
  }
  return groups.map(({ start, end }) => start === end ? start : `${start}-${end}`).join(", ");
}
