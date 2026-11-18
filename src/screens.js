import { icon, escapeHtml, fileDetails, toolHeader } from "./ui.js";
import { udfFontPresets } from "./udf-font-presets.js";

const e = escapeHtml;

function uploadZone(id, label, detail, accept, multiple = false) {
  return `<label class="drop-zone" for="${id}" data-upload>
    <input id="${id}" class="visually-hidden" type="file" aria-label="${label}" accept="${accept}" ${multiple ? "multiple" : ""}>
    <span class="icon">${icon("upload", 19)}</span>
    <span class="drop-copy"><strong>${label}</strong><small>${detail}</small></span>
    <span class="drop-arrow">${icon("arrow", 17)}</span>
  </label>`;
}

function status(view) {
  if (view.busy) return '<p class="operation-status" role="status">İşlem sürüyor…</p>';
  if (view.loading) return '<p class="operation-status" role="status">Dosyalar okunuyor…</p>';
  return view.problem ? `<p class="problem" role="alert">${e(view.problem)}</p>` : "";
}

function actionButton(id, label, view) {
  return `<button class="button" type="button" id="${id}-action" data-operation ${view.loading || view.busy ? "disabled" : ""}>
    ${view.busy ? "Hazırlanıyor…" : label} ${icon("arrow", 16)}</button>`;
}

function rowButton(action, file, name, glyph, disabled = false) {
  return `<button type="button" class="icon-button" data-file="${file.id}" data-file-action="${action}"
    aria-label="${e(file.name)} ${name}" title="${name}" ${disabled ? "disabled" : ""}>${icon(glyph, 17)}</button>`;
}

function sortableRow(file, index, view, rangeOptions = false) {
  const tag = file.format === "JPEG" ? "JPG" : file.format;
  const color = rangeOptions ? "" : "teal";
  const range = rangeOptions ? `<div class="range-row">
    <label for="mode-${file.id}">Sayfalar</label>
    <select class="control" id="mode-${file.id}" data-merge-mode="${file.id}" aria-label="${e(file.name)} sayfa seçimi">
      <option value="all" ${file.mode === "all" ? "selected" : ""}>Tüm sayfalar</option>
      <option value="range" ${file.mode === "range" ? "selected" : ""}>Aralık seç</option>
    </select>
    <input class="control" data-merge-range="${file.id}" type="text" value="${e(file.range)}"
      aria-label="${e(file.name)} sayfa aralığı" aria-describedby="error-${file.id}" placeholder="2-4, 7" ${file.mode === "all" ? "hidden" : ""}>
    <span class="range-error" id="error-${file.id}" hidden></span>
  </div>` : "";
  return `<li class="file-row" data-file-row="${file.id}">
    <div class="row-top">
      <span class="grip" draggable="true" title="Sıralamak için sürükleyin" aria-hidden="true">${icon("grip", 17)}</span>
      ${fileDetails(file, tag, color)}
      <div class="row-controls">
        ${rowButton("up", file, "yukarı taşı", "up", index === 0)}
        ${rowButton("down", file, "aşağı taşı", "down", index === view.files.length - 1)}
        ${rowButton("remove", file, "listeden çıkar", "close")}
      </div>
    </div>
    ${range}
  </li>`;
}

function privacyNote() {
  return `<p class="context-note">${icon("lock", 15)}<span>Dosyalar cihazınızda işlenir.</span></p>`;
}

function signatureNote() {
  return `<p class="notice document-notice">${icon("info", 17)}<span>Dosyada dijital imza algılandı. Bu işlem yeni bir PDF üretir. İmzalı asıl dosyayı saklayın.</span></p>`;
}

function progressOrFiles(view, content) {
  const files = view.loading || view.busy ? ' disabled' : "";
  return `<fieldset class="input-area"${files}>${content}</fieldset>${status(view)}`;
}

export function mergeScreen(view) {
  const source = `${uploadZone("merge-input", "PDF dosyalarını seç", "Bir veya daha fazla PDF seçin ya da buraya sürükleyin.", ".pdf,application/pdf", true)}
    ${view.files.length ? `<ol class="file-list">${view.files.map((file, index) => sortableRow(file, index, view, true)).join("")}</ol>` : ""}`;
  return `${toolHeader("birlestir", "İki veya daha fazla PDF’yi istediğiniz sırayla tek dosyada birleştirin.")}
    <div class="workspace">
      <section class="panel" aria-labelledby="files-heading">
        <div class="panel-title">
          <div><h2 id="files-heading">PDF dosyaları</h2><p class="panel-lead">Dosyaları sürükleyerek veya oklarla sıralayın. Her dosya için ayrı sayfa seçebilirsiniz.</p></div>
          ${view.files.length ? `<button type="button" class="text-button" data-clear ${view.loading || view.busy ? "disabled" : ""}>Tümünü kaldır</button>` : ""}
        </div>
        ${progressOrFiles(view, source)}
      </section>
      <aside class="panel summary" aria-labelledby="summary-title">
        <h2 id="summary-title">Birleştirme özeti</h2>
        <dl aria-live="polite">
          <div><dt>Dosya sayısı</dt><dd>${view.files.length} PDF</dd></div>
          <div><dt>Çıktıdaki sayfa sayısı</dt><dd id="merge-count">—</dd></div>
        </dl>
        <label class="field-label">Çıktı dosyası
          <input class="control" id="merge-name" type="text" value="${e(view.name)}" maxlength="100" ${view.busy ? "disabled" : ""}>
        </label>
        ${view.files.some(file => file.hasDigitalSignature) ? signatureNote() : ""}
        ${actionButton("merge", "PDF’leri birleştir", view)}
        ${privacyNote()}
      </aside>
    </div>${resultPanel(view.result)}`;
}

function modeButton(mode, value, label, current) {
  return `<button type="button" class="mode-button" data-mode="${mode}" data-value="${value}" aria-pressed="${current === value}">${label}</button>`;
}

function convertHelp() {
  return `<div class="notice">${icon("info", 18)}<span><strong>Office dönüşümü · Yakında</strong><br>
    Belgenizi Office veya ücretsiz LibreOffice ile PDF olarak dışa aktarabilirsiniz.
    <a href="https://help.libreoffice.org/latest/en-US/text/shared/01/ref_pdf_export.html" target="_blank" rel="noreferrer">LibreOffice yardımı</a></span></div>`;
}

const udfFaceLabels = { regular: "Normal", bold: "Kalın", italic: "İtalik", boldItalic: "Kalın italik" };

function udfFontSettings(view) {
  const required = view.file?.fontRequirements ?? [];
  const supplied = Array.from(view.fonts.values());
  return `<div class="setting-box udf-font-settings">
    <div class="udf-font-heading">
      <h3>Yazı tipleri</h3>
      ${supplied.length ? '<button type="button" class="text-button" data-clear-fonts>Kaldır</button>' : ""}
    </div>
    <label class="field-label udf-font-default" for="udf-font-default">
      Varsayılan yazı tipi
      <select class="control" id="udf-font-default" aria-describedby="udf-font-default-help">
        ${udfFontPresets.map(({ family }) => `<option value="${e(family)}" ${family === view.defaultFontFamily ? "selected" : ""}>${e(family)}</option>`).join("")}
      </select>
    </label>
    <p id="udf-font-default-help">Belgede yazı tipi belirtilmediğinde kullanılır.</p>
    ${required.length ? `<ul class="udf-font-list" aria-label="Belgede kullanılan yazı tipleri">${required.map(({ family, faces }) =>
      `<li><strong>${e(family)}</strong><span>${faces.map(face => udfFaceLabels[face]).join(", ")}</span></li>`).join("")}</ul>` : ""}
    <p>Kaynak belgede kullanılan yazı tiplerinin TTF dosyalarını ekleyin. Kalın ve italik biçimler ayrı dosyalar olabilir.</p>
    <label class="drop-zone udf-font-picker" for="udf-font-input">
      <input id="udf-font-input" class="visually-hidden" type="file" accept=".ttf,font/ttf" multiple>
      <span class="icon">${icon("upload", 19)}</span>
      <span class="drop-copy"><strong>Yazı tipi ekle</strong><small>TTF dosyaları cihazınızda kalır.</small></span>
    </label>
    ${supplied.length ? `<ul class="udf-font-list" aria-label="Eklenen yazı tipleri">${supplied.map(({ family, faces }) =>
      `<li><strong>${e(family)}</strong><span>${Object.keys(faces).map(face => udfFaceLabels[face]).join(", ")} eklendi</span></li>`).join("")}</ul>` :
      '<p>Orijinal TTF eklenmediğinde Times New Roman için Liberation Serif, Arial için Liberation Sans kullanılır.</p>'}
  </div>`;
}

export function convertScreen(view) {
  const image = view.kind === "image";
  const udf = view.kind === "udf";
  const active = udf ? view.udf : view;
  const source = `<div class="mode-options" role="group" aria-label="Dosya türü">
      ${modeButton("convert", "image", "PNG / JPEG", view.kind)}
      ${modeButton("convert", "office", "Word / Excel / PowerPoint", view.kind)}
      ${modeButton("convert", "udf", "UYAP (UDF) · Beta", view.kind)}
    </div>
    ${image ? `
      ${uploadZone("convert-input", "Görselleri seç", "PNG veya JPEG dosyalarını seçin ya da buraya sürükleyin.", ".png,.jpg,.jpeg,image/png,image/jpeg", true)}
      ${view.files.length ? `<ol class="file-list">${view.files.map((file, index) => sortableRow(file, index, view)).join("")}</ol>` : ""}
      ` : udf ? `
        <p class="notice udf-notice">${icon("info", 18)}<span>Beta sürüm imzasız A4 dikey metin belgelerini destekler. Tablo, görsel veya doğrulama kodu içeren belgeler bu kapsama girmiyor.</span></p>
        ${uploadZone("udf-input", view.udf.file ? "Başka UDF seç" : "UDF seç", "8 MB’a kadar bir UDF seçin ya da buraya sürükleyin.", ".udf")}
        ${view.udf.file ? `<div class="file-row row-top">${fileDetails(view.udf.file, "UDF", "amber")}</div>` : ""}
        ${udfFontSettings(view.udf)}
      ` : convertHelp()}`;
  const description = image
    ? "Görselleri cihazınızda PDF’ye dönüştürün. Her görsel bir PDF sayfası olur."
    : udf ? "Bir UYAP belgesini cihazınızda PDF’ye dönüştürün." : "Office belgelerini PDF olarak dışa aktarma seçeneklerini görün.";
  return `${toolHeader("donustur", description)}
    <div class="workspace">
      <section class="panel" aria-labelledby="source-heading">
        <div class="panel-title">
          <div><h2 id="source-heading">Kaynak dosyalar</h2><p class="panel-lead">${image ? "Dosya türünü seçin. Birden çok görseli sıralayabilirsiniz." : "Dosya türünü seçin."}</p></div>
          ${image && view.files.length ? `<button type="button" class="text-button" data-clear ${view.loading || view.busy ? "disabled" : ""}>Tümünü kaldır</button>` : ""}
          ${udf && view.udf.file ? `<button type="button" class="text-button" data-clear ${active.loading || active.busy ? "disabled" : ""}>Dosyayı kaldır</button>` : ""}
        </div>
        ${progressOrFiles(active, source)}
      </section>
      ${image ? `<aside class="panel summary" aria-labelledby="preview-heading">
        <h2 id="preview-heading">PDF ayarları</h2>
        <dl><div><dt>Çıktıdaki sayfa sayısı</dt><dd>${view.files.length} sayfa</dd></div></dl>
        <label class="field-label" for="image-size">Sayfa boyutu</label>
        <select class="control image-size" id="image-size" ${view.busy ? "disabled" : ""}>
          <option value="original" ${view.size === "original" ? "selected" : ""}>Görsel boyutu</option>
          <option value="a4" ${view.size === "a4" ? "selected" : ""}>A4 · Sayfaya sığdır</option>
        </select>
        <p class="context-note">${icon("info", 15)} Görselin oranı korunur. Boyut seçimi piksel sayısını değiştirmez.</p>
        ${actionButton("convert", "PDF’ye dönüştür", view)}
        ${privacyNote()}
      </aside>` : udf ? `<aside class="panel summary" aria-labelledby="preview-heading">
        <h2 id="preview-heading">UDF’den PDF’ye</h2>
        <p class="panel-lead">Çıktıyı indirmeden önce inceleyebilirsiniz.</p>
        ${actionButton("udf", "PDF’ye dönüştür", active)}
        ${privacyNote()}
      </aside>` : ""}
    </div>${image || udf ? resultPanel(active.result) : ""}`;
}

const thumbnailSize = 8;

function pagination(current, total, action, subject) {
  return `<div class="pagination">
    <button type="button" class="icon-button" data-${action}="-1" aria-label="Önceki ${subject}" ${current <= 1 ? "disabled" : ""}>${icon("back", 18)}</button>
    <span aria-live="polite">${current} / ${total}</span>
    <button type="button" class="icon-button" data-${action}="1" aria-label="Sonraki ${subject}" ${current >= total ? "disabled" : ""}>${icon("arrow", 18)}</button>
  </div>`;
}

function thumbnailPicker(view) {
  const count = Math.min(view.file.pages - view.thumbOffset, thumbnailSize);
  const thumbnails = Array.from({ length: count }, (_, index) => {
    const number = view.thumbOffset + index + 1;
    return `<button type="button" class="page-thumb" data-page="${number}"
      aria-label="${number}. sayfa" aria-pressed="false" ${view.mode === "extract" ? "" : "disabled"}>
      <span class="thumb-art"><canvas data-thumb="${number}" aria-hidden="true" hidden></canvas><span class="thumb-fallback">${icon("file", 23)}</span></span>
      <span>${number}</span>
    </button>`;
  }).join("");
  const total = Math.ceil(view.file.pages / thumbnailSize);
  return `<div class="page-strip" role="group" aria-label="Belge sayfaları">${thumbnails}</div>
    ${total > 1 ? pagination(view.thumbOffset / thumbnailSize + 1, total, "thumb-step", "sayfa grubu") : ""}`;
}

export function splitScreen(view) {
  const selection = view.file ? `
    <div class="file-row row-top">${fileDetails(view.file)}</div>
    <div class="mode-options split-modes" role="group" aria-label="Ayırma yöntemi">
      ${modeButton("split", "extract", "Seçili sayfaları çıkar", view.mode)}
      ${modeButton("split", "ranges", "Aralıklara ayır", view.mode)}
      ${modeButton("split", "each", "Her sayfayı ayır", view.mode)}
    </div>
    <label class="split-input field-label" ${view.mode === "each" ? "hidden" : ""}>Sayfa aralığı
      <input class="control" id="split-range" value="${e(view.range)}" placeholder="1-3, 6" aria-describedby="split-help split-error">
      <span class="panel-lead" id="split-help">${view.mode === "ranges" ? "Her virgülle ayrılan aralıktan ayrı bir PDF oluşturulur." : "Aralık girin veya aşağıdan sayfaları seçin."}</span>
      <span class="range-error" id="split-error" hidden></span>
    </label>
    ${thumbnailPicker(view)}` : "";
  return `${toolHeader("ayir", "Seçtiğiniz sayfaları çıkarın veya bir PDF’yi ayrı dosyalara bölün.")}
    <div class="workspace">
      <section class="panel" aria-labelledby="split-heading">
        <div class="panel-title">
          <div><h2 id="split-heading">Kaynak PDF</h2><p class="panel-lead">Bir dosya seçip ayırma yöntemini belirleyin.</p></div>
          ${view.file ? `<button type="button" class="text-button" data-clear ${view.loading || view.busy ? "disabled" : ""}>Dosyayı kaldır</button>` : ""}
        </div>
        ${progressOrFiles(view, `${uploadZone("split-input", view.file ? "Başka PDF seç" : "PDF seç", "Bir PDF dosyası seçin ya da buraya sürükleyin.", ".pdf,application/pdf")}${selection}`)}
      </section>
      <aside class="panel summary" aria-labelledby="split-summary">
        <h2 id="split-summary">Ayırma özeti</h2>
        <dl aria-live="polite">
          <div><dt>Seçilen sayfa</dt><dd id="split-pages">—</dd></div>
          <div><dt>Çıktı</dt><dd id="split-count">—</dd></div>
          <div><dt>İndirme biçimi</dt><dd id="split-format">—</dd></div>
        </dl>
        ${view.file?.hasDigitalSignature ? signatureNote() : ""}
        ${actionButton("split", "Sayfaları ayır", view)}
        ${privacyNote()}
      </aside>
    </div>${resultPanel(view.result)}`;
}

function resultPanel(result) {
  if (!result) return "";
  const pdf = result.mimeType === "application/pdf";
  const description = pdf ? `${result.pageCount} sayfa · PDF` : `${result.fileCount} PDF · ZIP`;
  return `<section class="panel result" id="result" aria-labelledby="result-title">
    <div class="result-header">
      <div class="result-heading">
        <span class="icon teal">${icon("check")}</span>
        <div><h2 id="result-title">Dosyanız hazır</h2><p class="panel-lead"><strong>${e(result.name)}</strong> · ${description}</p></div>
      </div>
      <a class="button" data-download href="${e(result.url)}" download="${e(result.name)}">${icon("download", 17)} ${pdf ? "PDF’yi indir" : "ZIP’i indir"}</a>
    </div>
    ${result.warnings?.map(message => `<p class="notice">${e(message)}</p>`).join("") ?? ""}
    ${pdf ? `<div class="preview-stage">
      <p class="preview-message" id="preview-message" role="status">Önizleme hazırlanıyor…</p>
      <canvas id="result-canvas" role="img" aria-label="Çıktı önizlemesi, sayfa ${result.page}" hidden></canvas>
    </div>
    ${result.pageCount > 1 ? pagination(result.page, result.pageCount, "preview-step", "sayfa") : ""}` : ""}
  </section>`;
}

export { thumbnailSize };
