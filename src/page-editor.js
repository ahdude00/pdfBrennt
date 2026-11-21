export function resetPageEdits(view, pageCount = 0) {
  view.pages = Array.from({ length: pageCount }, (_, index) => ({ pageNumber: index + 1, rotation: 0 }));
  view.selected = new Set();
  view.undo = [];
  view.redo = [];
  view.offset = 0;
}

export function hasPageEdits(view) {
  return Boolean(view.file && (view.pages.length !== view.file.pages
    || view.pages.some(({ pageNumber, rotation }, index) => pageNumber !== index + 1 || rotation !== 0)));
}

function snapshot(view) {
  return { pages: view.pages, selected: view.selected };
}

function recordEdit(view, pages, selected = view.selected) {
  if (pages.length === view.pages.length && pages.every((page, index) => page === view.pages[index])) {
    return false;
  }
  view.undo.push(snapshot(view));
  view.redo = [];
  view.pages = pages;
  view.selected = selected;
  return true;
}

function restoreEdit(view, from, to) {
  const previous = from.pop();
  if (!previous) return false;
  to.push(snapshot(view));
  view.pages = previous.pages;
  view.selected = previous.selected;
  return true;
}

export function toggleEditedPage(view, pageNumber) {
  if (!view.pages.some(page => page.pageNumber === pageNumber)) return false;
  const selected = new Set(view.selected);
  if (selected.has(pageNumber)) selected.delete(pageNumber);
  else selected.add(pageNumber);
  view.selected = selected;
  return true;
}

function shiftSelection(pages, selected, direction) {
  const ordered = [...pages];
  const start = direction < 0 ? 1 : pages.length - 2;
  for (let index = start; index >= 0 && index < pages.length; index -= direction) {
    const neighbor = index + direction;
    if (selected.has(ordered[index].pageNumber) && !selected.has(ordered[neighbor].pageNumber)) {
      [ordered[index], ordered[neighbor]] = [ordered[neighbor], ordered[index]];
    }
  }
  return ordered;
}

export function applyPageEdit(view, command) {
  switch (command) {
    case "select-all":
      if (view.selected.size === view.pages.length) return null;
      view.selected = new Set(view.pages.map(page => page.pageNumber));
      return "selection";
    case "clear-selection":
      if (!view.selected.size) return null;
      view.selected = new Set();
      return "selection";
    case "undo":
      return restoreEdit(view, view.undo, view.redo) ? "pages" : null;
    case "redo":
      return restoreEdit(view, view.redo, view.undo) ? "pages" : null;
    case "remove": {
      const remaining = view.pages.filter(page => !view.selected.has(page.pageNumber));
      return remaining.length && recordEdit(view, remaining, new Set()) ? "pages" : null;
    }
    case "rotate-left":
    case "rotate-right": {
      const delta = command === "rotate-left" ? 270 : 90;
      const rotated = view.pages.map(page => view.selected.has(page.pageNumber)
        ? { ...page, rotation: (page.rotation + delta) % 360 }
        : page);
      return recordEdit(view, rotated) ? "pages" : null;
    }
    case "up":
    case "down": {
      const ordered = shiftSelection(view.pages, view.selected, command === "up" ? -1 : 1);
      return recordEdit(view, ordered) ? "pages" : null;
    }
    default:
      return null;
  }
}

export function moveEditedPage(view, pageNumber, targetPageNumber) {
  const origin = view.pages.findIndex(page => page.pageNumber === pageNumber);
  const target = view.pages.findIndex(page => page.pageNumber === targetPageNumber);
  if (origin < 0 || target < 0 || origin === target) return false;
  const ordered = [...view.pages];
  const [page] = ordered.splice(origin, 1);
  ordered.splice(target, 0, page);
  return recordEdit(view, ordered);
}
