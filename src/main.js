import { catalog, escapeHtml, home, icon, iconTile, renderCatalog } from "./ui.js";
import { convertScreen, editScreen, imageScreen, imageSelectionSummary, mergeScreen, splitScreen, thumbnailSize } from "./screens.js";
import { formatRange, parseRange } from "./page-ranges.js";
import { runPdfOperation } from "./pdf-client.js";
import { applyPageEdit, hasPageEdits, moveEditedPage, resetPageEdits, toggleEditedPage } from "./page-editor.js";
import { bridgeFileSizeLimit, bridgeUdfToPdf } from "./udf-bridge.js";
import { defaultUdfFontFamily, udfFontPresets } from "./udf-font-presets.js";

const app = document.querySelector("#app");
const dialog = document.querySelector("#dialog");
const state = {
  home: { search: "", group: "Tümü" },
  merge: { files: [], name: "birlesik-belge.pdf" },
  split: { file: null, mode: "extract", range: "", thumbOffset: 0 },
  edit: { file: null },
  raster: { file: null, mode: "all", range: "", thumbOffset: 0, format: "png", dpi: 150 },
  convert: {
    files: [], kind: "image", size: "original",
    // output: "separate" gives one PDF per UDF (a ZIP when there are several), "merged" one PDF.
    udf: { files: [], output: "separate", fonts: new Map(), defaultFontFamily: defaultUdfFontFamily },
  },
};
resetPageEdits(state.edit);
const maxUdfFiles = 50;
const routes = {
  araclar: { key: "home", screen: home },
  birlestir: { key: "merge", screen: mergeScreen },
  ayir: { key: "split", screen: splitScreen },
  sayfalar: { key: "edit", screen: editScreen },
  donustur: { key: "convert", screen: convertScreen },
  gorsel: { key: "raster", screen: imageScreen },
};
let route;
let nextFileId = 0;
let previewRender;

function activeKey() {
  return routes[route].key;
}

function toolView(key) {
  return key === "convert" && state.convert.kind === "udf" ? state.convert.udf : state[key];
}

function updateCatalog() {
  app.querySelector("#tool-grid").innerHTML = renderCatalog(state.home);
}

function mergeSelection(view) {
  return view.files.map(file => file.mode === "all" ? { pages: null } : parseRange(file.range, file.pages));
}

function splitSelection(view) {
  if (!view.file) return { count: 0, groups: [] };
  if (view.mode === "each") return { count: view.file.pages, groups: null };
  const selected = parseRange(view.range, view.file.pages);
  if (selected.error) return { error: selected.error, groups: [], count: 0 };
  return { count: selected.pages.length, groups: view.mode === "extract" ? [selected.pages] : selected.groups };
}

function rasterSelection(view) {
  if (!view.file) return { count: 0, pages: [] };
  if (view.mode === "all") return { count: view.file.pages, pages: null };
  const { pages = [], error } = parseRange(view.range, view.file.pages);
  return { count: pages.length, pages, error };
}

function showRangeStatus(input, error, message) {
  error.hidden = !message;
  error.textContent = message ?? "";
  if (message) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
}

function updateMerge(view) {
  const selection = mergeSelection(view);
  let count = 0;
  let invalid = false;
  for (const [index, file] of view.files.entries()) {
    const selected = selection[index];
    const input = app.querySelector(`[data-merge-range="${file.id}"]`);
    input.hidden = file.mode === "all";
    showRangeStatus(input, app.querySelector(`#error-${file.id}`), selected.error);
    count += selected.pages === null ? file.pages : selected.pages?.length ?? 0;
    invalid ||= Boolean(selected.error);
  }
  app.querySelector("#merge-count").textContent = invalid || !count ? "—" : `${count} sayfa`;
  app.querySelector("#merge-action").disabled = Boolean(view.loading || view.busy || invalid || view.files.length < 2);
}

function updateSplit(view, markError = false) {
  const { count, groups, error } = splitSelection(view);
  const outputs = groups === null ? count : groups.length;
  app.querySelector("#split-pages").textContent = count ? `${count} sayfa` : "—";
  app.querySelector("#split-count").textContent = outputs ? `${outputs} PDF` : "—";
  app.querySelector("#split-format").textContent = outputs > 1 ? "ZIP" : outputs === 1 ? "PDF" : "—";
  app.querySelector("#split-action").disabled = Boolean(view.busy || view.loading || !outputs);
  const input = app.querySelector("#split-range");
  if (!input) return;
  showRangeStatus(input, app.querySelector("#split-error"), markError || view.range.trim() ? error : "");
  const selected = new Set(groups?.flat());
  for (const page of app.querySelectorAll("[data-page]")) {
    page.setAttribute("aria-pressed", String(groups === null || selected.has(Number(page.dataset.page))));
  }
}

function updateRaster(view, markError = false) {
  const selection = rasterSelection(view);
  const summary = imageSelectionSummary(selection, view.format);
  app.querySelector("#image-pages").textContent = summary.pages;
  app.querySelector("#image-output").textContent = summary.output;
  app.querySelector("#image-action").disabled = Boolean(view.busy || view.loading || !selection.count);
  const input = app.querySelector("#image-range");
  if (!input) return;
  showRangeStatus(input, app.querySelector("#image-range-error"), markError || view.range.trim() ? selection.error : "");
  const selected = new Set(selection.pages);
  for (const page of app.querySelectorAll("[data-page]")) {
    page.setAttribute("aria-pressed", String(selection.pages === null || selected.has(Number(page.dataset.page))));
  }
}

function previewFor(attachment, source) {
  attachment.preview ??= import("./pdf-preview.js")
    .then(({ openPdfPreview }) => openPdfPreview(source))
    .catch(() => null);
  return attachment.preview;
}

function disposePreview(attachment) {
  attachment?.preview?.then(preview => preview?.close()).catch(() => {});
}

async function paintThumbnails(attachment, canvases, signal) {
  if (!attachment || !canvases.length) return;
  const preview = await previewFor(attachment, attachment.file);
  if (!preview || signal.aborted) return;
  async function paintLane(lane) {
    for (let index = lane; index < canvases.length; index += 2) {
      const canvas = canvases[index];
      if (signal.aborted || !canvas.isConnected) return;
      try {
        const rotation = canvas.dataset.previewRotation;
        const size = rotation === undefined
          ? { maxWidth: 65, maxHeight: 70 }
          : { maxWidth: canvas.parentElement.clientWidth, maxHeight: canvas.parentElement.clientHeight };
        const options = { ...size, rotationDelta: Number(rotation ?? 0), signal };
        if (await preview.renderPage(Number(canvas.dataset.thumb), canvas, options) && canvas.isConnected && !signal.aborted) {
          canvas.hidden = false;
          canvas.nextElementSibling.hidden = true;
        }
      } catch {
        // The page number remains available when rendering fails.
      }
    }
  }
  await Promise.all([paintLane(0), paintLane(1)]);
}

async function paintResult(result, canvas, message, signal) {
  const preview = await previewFor(result, result.blob);
  if (signal.aborted || !canvas.isConnected) return;
  try {
    const maxWidth = Math.min(canvas.parentElement.clientWidth - 28, 640);
    const rendered = preview && await preview.renderPage(result.page, canvas, { maxWidth, maxHeight: 640, signal });
    if (rendered && canvas.isConnected && !signal.aborted) {
      canvas.style.width = `${Math.min(maxWidth, canvas.width / Math.min(window.devicePixelRatio || 1, 2))}px`;
      message.hidden = true;
      canvas.hidden = false;
      return;
    }
  } catch {
    // Keep the download link available if rendering fails.
  }
  if (!signal.aborted) message.textContent = "Önizleme açılamadı. Dosyayı indirebilirsiniz.";
}

function render() {
  const { key, screen } = routes[route];
  const view = state[key];
  previewRender?.abort();
  previewRender = new AbortController();
  const { signal } = previewRender;
  let screenView = view;
  if (key === "edit") screenView = { ...view, changed: hasPageEdits(view) };
  if (key === "raster") screenView = { ...view, selection: rasterSelection(view) };
  app.innerHTML = screen(screenView);
  if (key === "home") updateCatalog();
  if (key === "merge") updateMerge(view);
  if (key === "split") updateSplit(view);
  if (key === "split" || key === "edit" || key === "raster") {
    void paintThumbnails(view.file, [...app.querySelectorAll("[data-thumb]")], signal);
  }
  if (key === "convert" && view.kind === "image") {
    app.querySelector("#convert-action").disabled = Boolean(view.busy || view.loading || !view.files.length);
  }
  if (key === "convert" && view.kind === "udf") {
    const { files, busy, loading } = view.udf;
    app.querySelector("#udf-action").disabled = Boolean(busy || loading || !files.length || files.some(file => file.bridgeOnly));
    const fontDefault = app.querySelector("#udf-font-default");
    if (fontDefault) fontDefault.disabled = Boolean(busy || loading);
  }
  const canvas = app.querySelector("#result-canvas");
  if (canvas) void paintResult(toolView(key).result, canvas, app.querySelector("#preview-message"), signal);
}

function navigate(focus = false) {
  const fragment = location.hash.slice(1);
  route = Object.hasOwn(routes, fragment) ? fragment : "araclar";
  for (const link of document.querySelectorAll("[data-nav]")) {
    if (link.dataset.nav === route) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  const title = catalog.find(tool => tool.id === route)?.label ?? "PDF araçları";
  document.title = `${title} · PDF Brennt`;
  render();
  if (focus) {
    window.scrollTo({ top: 0, behavior: "instant" });
    focusHeading(app.querySelector("h1"));
  }
}

function focusHeading(heading) {
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}

function renderActive(key) {
  if (activeKey() === key) render();
}

function discardResult(view) {
  if (!view.result) return;
  disposePreview(view.result);
  URL.revokeObjectURL(view.result.url);
  view.result = null;
  if (toolView(activeKey()) === view) app.querySelector("#result")?.remove();
}

function fileFormat(file, key) {
  if (key === "udf") return /\.udf$/i.test(file.name) ? "UDF" : "";
  if (key !== "convert") return /\.pdf$/i.test(file.name) || file.type === "application/pdf" ? "PDF" : "";
  if (/\.png$/i.test(file.name) || file.type === "image/png") return "PNG";
  if (/\.jpe?g$/i.test(file.name) || file.type === "image/jpeg") return "JPEG";
  return "";
}

function fileSizeLabel(bytes) {
  const megabytes = bytes / 1024 / 1024;
  const value = megabytes >= 1 ? megabytes : Math.max(1, Math.round(bytes / 1024));
  return `${value.toLocaleString("tr", { maximumFractionDigits: 1 })} ${megabytes >= 1 ? "MB" : "KB"}`;
}

async function loadFiles(key, files) {
  const view = toolView(key);
  if (!files.length || view.loading || view.busy || (key === "convert" && state.convert.kind === "office")) return;
  const udf = view === state.convert.udf;
  const single = key === "split" || key === "edit" || key === "raster";
  if (udf) discardResult(view);
  view.loading = true;
  view.problem = "";
  renderActive(key);
  const errors = [];
  const sources = single ? files.slice(0, 1) : files;
  try {
    for (const file of sources) {
      const format = fileFormat(file, udf ? "udf" : key);
      try {
        if (!format) {
          const supported = udf ? "UDF" : key === "convert" ? "PNG veya JPEG" : "PDF";
          throw new Error(`${supported} dosyası seçin.`);
        }
        if (!file.size) throw new Error("Dosya boş.");
        const attachment = { id: ++nextFileId, name: file.name, file, format };
        if (key === "convert") {
          attachment.kind = fileSizeLabel(file.size);
          if (udf) {
            if (view.files.length >= maxUdfFiles) throw new Error(`En fazla ${maxUdfFiles} UDF birlikte dönüştürülebilir.`);
            if (!file.size || file.size > bridgeFileSizeLimit) throw new Error("16 MB veya daha küçük, geçerli bir UDF seçin.");
            try {
              const { inspectUdfFonts } = await import("./udf-engine.js");
              attachment.fontRequirements = await inspectUdfFonts(file, view.defaultFontFamily);
            } catch (error) {
              // UYAP Editör cannot open this document either, so the bridge is not offered.
              if (error?.uyapCannotOpen) throw error;
              attachment.bridgeOnly = true;
              attachment.kind = `${attachment.kind} · yalnızca UYAP köprüsüyle`;
              errors.push(`${file.name} · ${error?.message || "Tarayıcı bu belgeyi açamadı."} “UYAP köprüsüyle dönüştür”ü deneyin.`);
            }
          }
          view.files.push(attachment);
        } else {
          const { pageCount, ...features } = await runPdfOperation("inspectPdf", file);
          Object.assign(attachment, { pages: pageCount, ...features, mode: "all", range: "" });
          if (key === "merge") view.files.push(attachment);
          else {
            disposePreview(view.file);
            view.file = attachment;
            if (key === "edit") resetPageEdits(view, pageCount);
            else {
              view.range = "";
              view.thumbOffset = 0;
              if (key === "raster") view.mode = "all";
            }
          }
        }
        discardResult(view);
      } catch (error) {
        const message = error?.message || "Dosya okunamadı.";
        errors.push(message.startsWith(`${file.name} `) ? message : `${file.name} · ${message}`);
      }
    }
    if (single && files.length > 1) errors.push("Bu araçta bir PDF seçebilirsiniz.");
    view.problem = errors.slice(0, 3).join(" ") + (errors.length > 3 ? ` Diğer ${errors.length - 3} dosya da eklenemedi.` : "");
  } finally {
    view.loading = false;
    const restoreFocus = activeKey() === key && document.activeElement === document.body;
    renderActive(key);
    if (restoreFocus) app.querySelector("input[type=file]")?.focus({ preventScroll: true });
  }
}

async function selectUdfDefaultFont(select) {
  const view = state.convert.udf;
  const family = select.value;
  if (view.loading || view.busy || !udfFontPresets.some(preset => preset.family === family)) {
    select.value = view.defaultFontFamily;
    return;
  }
  if (family === view.defaultFontFamily) return;
  const readable = view.files.filter(file => !file.bridgeOnly);
  if (!readable.length) {
    view.defaultFontFamily = family;
    return;
  }

  view.loading = true;
  view.problem = "";
  try {
    const { inspectUdfFonts } = await import("./udf-engine.js");
    const requirements = await Promise.all(readable.map(file => inspectUdfFonts(file.file, family)));
    readable.forEach((file, index) => { file.fontRequirements = requirements[index]; });
    view.defaultFontFamily = family;
    discardResult(view);
  } catch (error) {
    view.problem = error?.message || "Yazı tipi ayarı güncellenemedi.";
  } finally {
    view.loading = false;
    renderActive("convert");
    app.querySelector("#udf-font-default")?.focus({ preventScroll: true });
  }
}

async function addUdfFonts(files) {
  const view = state.convert.udf;
  if (!files.length || view.loading || view.busy) return;
  view.loading = true;
  view.problem = "";
  renderActive("convert");
  try {
    const { loadUdfCustomFonts } = await import("./udf-custom-fonts.js");
    const added = await loadUdfCustomFonts(files);
    for (const [key, { family, faces }] of added) {
      view.fonts.set(key, { family, faces: { ...view.fonts.get(key)?.faces, ...faces } });
    }
    discardResult(view);
  } catch (error) {
    view.problem = error?.message || "Yazı tipi dosyaları okunamadı.";
  } finally {
    view.loading = false;
    const restoreFocus = toolView(activeKey()) === view && document.activeElement === document.body;
    renderActive("convert");
    if (restoreFocus) app.querySelector("#udf-font-input")?.focus({ preventScroll: true });
  }
}

function outputName(name, extension, fallback) {
  const safeName = name.trim().replace(/[<>:"/\\|?*\p{Cc}]/gu, "_").replace(/[. ]+$/u, "");
  const base = safeName || fallback;
  return base.toLowerCase().endsWith(`.${extension}`) ? base : `${base}.${extension}`;
}

async function bridgeToPdf(file) {
  const bytes = await bridgeUdfToPdf(file);
  const { pageCount } = await runPdfOperation("inspectPdf", new File([bytes], "uyap.pdf", { type: "application/pdf" })).catch(() => {
    throw new Error("PDF sitede açılamadı. Belgeyi UYAP Doküman Editörü’nde açıp PDF olarak kaydetmeyi deneyin.");
  });
  return {
    bytes, mimeType: "application/pdf", pageCount, fileCount: 1,
    warnings: ["Bu PDF bilgisayarınızdaki UYAP Doküman Editörü ile hazırlandı. PDF’yi başka bir bilgisayarda açtığınızda yazılar farklı görünebilir."],
  };
}

// Warnings of several documents: one that only some of them have names them.
function batchWarnings(outputs) {
  const byMessage = new Map();
  for (const { name, warnings = [] } of outputs) {
    for (const message of warnings) byMessage.set(message, [...(byMessage.get(message) ?? []), name]);
  }
  return [...byMessage].map(([message, names]) =>
    outputs.length > 1 && names.length < outputs.length ? `${names.join(", ")}: ${message}` : message);
}

// Converts the UDF files one after another, in the browser or through the UYAP bridge,
// and returns one PDF, a merged PDF or a ZIP of PDFs.
async function convertUdfFiles({ files, bridge, merged, fonts, family }, progress) {
  // Loaded only when needed, so that a bridge request still follows the click directly
  // (Chrome asks its permission for that request).
  let engine;
  const loadEngine = async () => (engine ??= await import("./udf-engine.js"));
  const outputs = [];
  for (const [index, attachment] of files.entries()) {
    progress(index + 1, files.length);
    try {
      const result = bridge ? await bridgeToPdf(attachment.file) : await (await loadEngine()).udfToPdf(attachment.file, fonts, family);
      outputs.push({ ...result, name: attachment.name });
    } catch (error) {
      // A closed bridge or a refused permission is not about this file.
      if (files.length === 1 || error?.reason === "unreachable") throw error;
      throw new Error(`${attachment.name} · ${error?.message || "Dosya dönüştürülemedi."} Bu dosyayı listeden çıkarıp yeniden deneyebilirsiniz.`);
    }
  }
  if (outputs.length === 1) return outputs[0];
  const warnings = batchWarnings(outputs);
  if (merged) {
    progress(files.length, files.length, "PDF’ler birleştiriliyor");
    const parts = outputs.map(({ bytes, name }) => ({ file: new File([bytes], name, { type: "application/pdf" }), pages: null }));
    return { ...await runPdfOperation("mergePdfs", parts), warnings };
  }
  const used = new Set();
  const entries = {};
  for (const { bytes, name } of outputs) {
    const base = outputName(name.replace(/\.udf$/i, ""), "pdf", "uyap-belgesi").replace(/\.pdf$/i, "");
    let entry = `${base}.pdf`;
    for (let copy = 2; used.has(entry.toLowerCase()); copy++) entry = `${base} (${copy}).pdf`;
    used.add(entry.toLowerCase());
    entries[entry] = bytes;
  }
  return {
    bytes: (await loadEngine()).zipFiles(entries), mimeType: "application/zip",
    pageCount: outputs.reduce((sum, output) => sum + output.pageCount, 0), fileCount: outputs.length, warnings,
  };
}

function actionRequest(key, view, bridge = false) {
  if (key === "edit") {
    if (!hasPageEdits(view)) return null;
    const name = view.file.name.replace(/\.pdf$/i, "") + "-duzenlenmis";
    return { operation: "editPdf", args: [view.file.file, view.pages], name: outputName(name, "pdf", "duzenlenmis-belge") };
  }
  if (key === "merge") {
    const selection = mergeSelection(view);
    if (selection.length < 2 || selection.some(part => part.error)) return null;
    return {
      operation: "mergePdfs",
      args: [view.files.map(({ file }, index) => ({ file, pages: selection[index].pages }))],
      name: outputName(view.name, "pdf", "birlesik-belge"),
    };
  }
  if (key === "split") {
    const { count, groups } = splitSelection(view);
    if (!count) return null;
    const pages = groups ?? Array.from({ length: count }, (_, index) => [index + 1]);
    const name = view.file.name.replace(/\.pdf$/i, "") + "-ayrilmis";
    return { operation: "splitPdf", args: [view.file.file, pages], name: outputName(name, pages.length > 1 ? "zip" : "pdf", "ayrilmis-belge") };
  }
  if (key === "raster") {
    const { count, pages } = rasterSelection(view);
    if (!count) return null;
    const source = view.file.name.replace(/\.pdf$/i, "") || "belge";
    const format = view.format;
    const extension = count > 1 ? "zip" : format === "jpeg" ? "jpg" : "png";
    const name = count > 1 ? `${source}-gorseller` : `${source}-sayfa-${pages?.[0] ?? 1}`;
    return {
      operation: "pdfToImages",
      args: [view.file.file, { pages: pages ?? Array.from({ length: count }, (_, index) => index + 1), format, dpi: view.dpi }],
      name: outputName(name, extension, "gorseller"),
    };
  }
  if (view === state.convert.udf) {
    if (!view.files.length || (!bridge && view.files.some(file => file.bridgeOnly))) return null;
    const several = view.files.length > 1;
    const merged = several && view.output === "merged";
    const name = several
      ? outputName("uyap-belgeleri", merged ? "pdf" : "zip", "uyap-belgeleri")
      : outputName(view.files[0].name.replace(/\.udf$/i, ""), "pdf", "uyap-belgesi");
    return { operation: "udf", args: [{ files: [...view.files], bridge, merged, fonts: view.fonts, family: view.defaultFontFamily }], name };
  }
  if (key === "convert" && view.files.length) {
    const name = view.files.length === 1 ? view.files[0].name.replace(/\.[^.]+$/, "") : "gorseller";
    return { operation: "imagesToPdf", args: [view.files.map(({ file }) => file), { size: view.size }], name: outputName(name, "pdf", "gorseller") };
  }
  return null;
}

async function processFiles(key, { bridge = false } = {}) {
  const view = toolView(key);
  if (view.loading || view.busy) return;
  const request = actionRequest(key, view, bridge);
  if (!request) return;
  discardResult(view);
  view.busy = true;
  view.problem = "";
  renderActive(key);
  try {
    let result;
    if (request.operation === "udf") {
      result = await convertUdfFiles(...request.args, (done, total, message) => showProgress(key, view, message ?? (total > 1 ? `${done} / ${total} belge` : "")));
    } else if (request.operation === "pdfToImages") {
      const { pdfToImages } = await import("./pdf-images.js");
      result = await pdfToImages(...request.args, (done, total) => showProgress(key, view, `${done} / ${total} sayfa`));
    } else {
      result = await runPdfOperation(request.operation, ...request.args);
    }
    const { bytes, ...details } = result;
    const blob = new Blob([bytes], { type: details.mimeType });
    view.result = { ...details, blob, name: request.name, url: URL.createObjectURL(blob), page: 1 };
  } catch (error) {
    view.problem = error.message || "Dosya hazırlanamadı. Yeniden deneyin.";
  } finally {
    view.busy = false;
    view.progress = "";
    renderActive(key);
  }
  if (activeKey() === key) {
    if (view.result) {
      app.querySelector("#result")?.scrollIntoView({ block: "start" });
      focusHeading(app.querySelector("#result-title"));
    } else {
      const error = app.querySelector(".problem");
      error?.scrollIntoView({ block: "nearest" });
      focusHeading(error);
    }
  }
}

// Updates the status line while a batch runs, without redrawing the page.
function showProgress(key, view, text) {
  view.progress = text;
  const line = toolView(activeKey()) === view ? app.querySelector(".operation-status") : null;
  if (line) line.textContent = text ? `İşlem sürüyor… ${text}` : "İşlem sürüyor…";
}

function moveFile(view, id, index, action) {
  const current = view.files.findIndex(file => file.id === id);
  if (current < 0 || index < 0 || index >= view.files.length || current === index) return;
  const [file] = view.files.splice(current, 1);
  view.files.splice(index, 0, file);
  view.problem = "";
  discardResult(view);
  render();
  if (action) {
    const row = app.querySelector(`[data-file-row="${id}"]`);
    const preferred = row.querySelector(`[data-file-action="${action}"]:not(:disabled)`);
    (preferred ?? row.querySelector("[data-file-action]:not(:disabled)")).focus({ preventScroll: true });
  }
}

function clearFiles(view) {
  discardResult(view);
  disposePreview(view.file);
  if (view.files) view.files = [];
  if (view.file) {
    view.file = null;
    if (view === state.edit) resetPageEdits(view);
    if (view === state.split || view === state.raster) {
      view.range = "";
      view.thumbOffset = 0;
    }
    if (view === state.raster) view.mode = "all";
  }
  view.problem = "";
  render();
  app.querySelector("input[type=file]")?.focus({ preventScroll: true });
}

function clickPage(view, number) {
  const pages = splitSelection(view).groups?.[0] ?? [];
  const index = pages.indexOf(number);
  if (index < 0) pages.push(number);
  else pages.splice(index, 1);
  view.range = formatRange(pages);
  app.querySelector("#split-range").value = view.range;
  discardResult(view);
  updateSplit(view);
}

function discardRasterResult(view) {
  discardResult(view);
  view.problem = "";
  app.querySelector(".problem")?.remove();
}

function selectRasterPage(view, pageNumber) {
  const wasAll = view.mode === "all";
  const pages = rasterSelection(view).pages ?? [];
  const index = pages.indexOf(pageNumber);
  if (index < 0) pages.push(pageNumber);
  else pages.splice(index, 1);
  view.mode = "range";
  view.range = formatRange(pages);
  discardRasterResult(view);
  if (wasAll) {
    render();
    app.querySelector(`[data-page="${pageNumber}"]`)?.focus({ preventScroll: true });
  } else {
    app.querySelector("#image-range").value = view.range;
    updateRaster(view);
  }
}

const dragType = "application/x-pdfbrennt-order";
const pageDragType = "application/x-pdfbrennt-page-order";

app.addEventListener("input", ({ target }) => {
  if (target.id === "search") {
    state.home.search = target.value;
    updateCatalog();
  }
  if (target.id === "merge-name") {
    state.merge.name = target.value;
    discardResult(state.merge);
  }
  if (target.dataset.mergeRange) {
    state.merge.files.find(file => file.id === Number(target.dataset.mergeRange)).range = target.value;
    discardResult(state.merge);
    updateMerge(state.merge);
  }
  if (target.id === "split-range") {
    state.split.range = target.value;
    discardResult(state.split);
    updateSplit(state.split, true);
  }
  if (target.id === "image-range") {
    state.raster.range = target.value;
    discardRasterResult(state.raster);
    updateRaster(state.raster, true);
  }
});

app.addEventListener("change", ({ target }) => {
  if (target.id === "udf-font-input") void addUdfFonts([...target.files]);
  else if (target.id === "udf-font-default") void selectUdfDefaultFont(target);
  else if (target.type === "file") void loadFiles(activeKey(), [...target.files]);
  if (target.dataset.mergeMode) {
    state.merge.files.find(file => file.id === Number(target.dataset.mergeMode)).mode = target.value;
    discardResult(state.merge);
    updateMerge(state.merge);
  }
  if (target.id === "image-size") {
    state.convert.size = target.value;
    discardResult(state.convert);
  }
  if (target.id === "image-format" || target.id === "image-dpi") {
    const view = state.raster;
    if (target.id === "image-format") view.format = target.value;
    else view.dpi = Number(target.value);
    discardRasterResult(view);
    updateRaster(view);
  }
});

function restorePaginationFocus(button, attribute) {
  const value = button.getAttribute(`data-${attribute}`);
  (app.querySelector(`[data-${attribute}="${value}"]:not(:disabled)`)
    ?? app.querySelector(`[data-${attribute}]:not(:disabled)`))?.focus({ preventScroll: true });
}

function clampEditOffset(view, offset) {
  const lastOffset = Math.floor((view.pages.length - 1) / thumbnailSize) * thumbnailSize;
  view.offset = Math.max(0, Math.min(lastOffset, offset));
}

function renderPageEdits(view) {
  view.problem = "";
  discardResult(view);
  render();
}

function handlePageEditorButton(button, view) {
  const { editSelect, editCommand, editStep } = button.dataset;
  if (!editSelect && !editCommand && !editStep) return false;
  if (!view.file || view.loading || view.busy) return true;

  if (editSelect && toggleEditedPage(view, Number(editSelect))) {
    render();
    app.querySelector(`[data-edit-select="${editSelect}"]`)?.focus({ preventScroll: true });
  }
  if (editStep) {
    clampEditOffset(view, view.offset + Number(editStep) * thumbnailSize);
    render();
    restorePaginationFocus(button, "edit-step");
  }
  if (editCommand) {
    const moving = editCommand === "up" || editCommand === "down";
    const anchor = moving && view.pages.slice(view.offset, view.offset + thumbnailSize)
      .find(page => view.selected.has(page.pageNumber));
    const change = applyPageEdit(view, editCommand);
    if (!change) return true;
    if (change === "pages") {
      const position = anchor ? view.pages.indexOf(anchor) : view.offset;
      clampEditOffset(view, Math.floor(position / thumbnailSize) * thumbnailSize);
      renderPageEdits(view);
    } else {
      render();
    }
    (app.querySelector(`[data-edit-command="${editCommand}"]:not(:disabled)`)
      ?? app.querySelector('[data-edit-select][aria-pressed="true"]')
      ?? app.querySelector("[data-edit-select]"))?.focus({ preventScroll: true });
  }
  return true;
}

app.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  const key = activeKey();
  const view = toolView(key);
  if (key === "edit" && handlePageEditorButton(button, view)) return;
  const { group, planned, mode, value, file, fileAction, page, thumbStep, previewStep } = button.dataset;
  if (group) {
    view.group = group;
    for (const filter of app.querySelectorAll("[data-group]")) filter.setAttribute("aria-pressed", String(filter === button));
    updateCatalog();
  }
  if (planned) {
    const tool = catalog.find(item => item.id === planned);
    document.querySelector("#dialog-content").innerHTML = `${iconTile(tool)}<h2 id="dialog-title">${escapeHtml(tool.label)}</h2><p>${escapeHtml(tool.plan)}</p>`;
    dialog.showModal();
  }
  if (button.hasAttribute("data-operation")) void processFiles(key);
  if (button.hasAttribute("data-bridge")) void processFiles(key, { bridge: true });
  if (button.hasAttribute("data-clear")) clearFiles(view);
  if (button.hasAttribute("data-clear-fonts") && view === state.convert.udf) {
    view.fonts.clear();
    view.problem = "";
    discardResult(view);
    render();
    app.querySelector("#udf-font-input")?.focus({ preventScroll: true });
  }
  if (mode) {
    if (mode === "split" && view.mode !== value) {
      view.mode = value;
      discardResult(view);
    }
    if (mode === "convert") state.convert.kind = value;
    if (mode === "image-pages" && view.mode !== value) {
      view.mode = value;
      discardRasterResult(view);
    }
    if (mode === "udf-output" && view.output !== value) {
      view.output = value;
      discardResult(view);
    }
    render();
    app.querySelector(`[data-mode="${mode}"][data-value="${value}"]`)?.focus({ preventScroll: true });
  }
  if (fileAction) {
    const id = Number(file);
    const index = view.files.findIndex(item => item.id === id);
    if (fileAction === "remove" && index >= 0) {
      view.files.splice(index, 1);
      view.problem = "";
      discardResult(view);
      render();
      const buttons = app.querySelectorAll('[data-file-action="remove"]');
      (buttons[Math.min(index, buttons.length - 1)] ?? app.querySelector("input[type=file]"))?.focus({ preventScroll: true });
    } else {
      moveFile(view, id, index + (fileAction === "up" ? -1 : 1), fileAction);
    }
  }
  if (page) {
    if (key === "raster") selectRasterPage(view, Number(page));
    else clickPage(view, Number(page));
  }
  if (thumbStep) {
    view.thumbOffset += Number(thumbStep) * thumbnailSize;
    render();
    restorePaginationFocus(button, "thumb-step");
  }
  if (previewStep) {
    view.result.page += Number(previewStep);
    render();
    restorePaginationFocus(button, "preview-step");
  }
});

app.addEventListener("dragstart", event => {
  const handle = event.target.closest(".grip, .edit-grip");
  if (!handle) return;
  const view = toolView(activeKey());
  if (view.loading || view.busy) {
    event.preventDefault();
    return;
  }
  event.dataTransfer.effectAllowed = "move";
  const page = handle.closest("[data-edit-page]");
  if (page) event.dataTransfer.setData(pageDragType, page.dataset.editPage);
  else event.dataTransfer.setData(dragType, handle.closest("[data-file-row]").dataset.fileRow);
});

app.addEventListener("dragover", event => {
  const row = event.target.closest("[data-file-row]");
  const page = event.target.closest("[data-edit-page]");
  const zone = event.target.closest("[data-upload]");
  const view = toolView(activeKey());
  if (view.loading || view.busy) return;
  if (row && event.dataTransfer.types.includes(dragType)) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    app.querySelector(".is-target")?.classList.remove("is-target");
    row.classList.add("is-target");
  }
  if (page && event.dataTransfer.types.includes(pageDragType)) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    app.querySelector(".edit-drop-target")?.classList.remove("edit-drop-target");
    page.classList.add("edit-drop-target");
  }
  if (zone && event.dataTransfer.types.includes("Files")) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    zone.classList.add("over");
  }
});

app.addEventListener("dragleave", event => {
  const target = event.target.closest(".is-target, .edit-drop-target, .over");
  if (target && !target.contains(event.relatedTarget)) target.classList.remove("is-target", "edit-drop-target", "over");
});

app.addEventListener("dragend", () => {
  app.querySelector(".is-target, .edit-drop-target")?.classList.remove("is-target", "edit-drop-target");
});

document.addEventListener("dragover", event => {
  if (event.dataTransfer.types.includes("Files")) event.preventDefault();
});

document.addEventListener("drop", event => {
  const row = event.target.closest("[data-file-row]");
  const page = event.target.closest("[data-edit-page]");
  const zone = event.target.closest("[data-upload]");
  const key = activeKey();
  const view = toolView(key);
  if (event.dataTransfer.types.includes("Files")) {
    event.preventDefault();
    zone?.classList.remove("over");
    if (zone) void loadFiles(key, [...event.dataTransfer.files]);
  }
  if (row && event.dataTransfer.types.includes(dragType)) {
    event.preventDefault();
    row.classList.remove("is-target");
    if (!view.loading && !view.busy) {
      moveFile(view, Number(event.dataTransfer.getData(dragType)), view.files.findIndex(file => file.id === Number(row.dataset.fileRow)));
    }
  }
  if (key === "edit" && page && event.dataTransfer.types.includes(pageDragType)) {
    event.preventDefault();
    page.classList.remove("edit-drop-target");
    if (!view.loading && !view.busy && moveEditedPage(view,
      Number(event.dataTransfer.getData(pageDragType)), Number(page.dataset.editPage))) {
      renderPageEdits(view);
    }
  }
});

document.querySelector(".brand-mark").innerHTML = icon("brand", 21);
document.querySelector("#privacy-label").insertAdjacentHTML("afterbegin", icon("lock", 15));
window.addEventListener("hashchange", () => {
  if (location.hash !== "#app") navigate(true);
});
navigate();
