const icons = {
  brand: '<path d="M6 3h8l4 4v14H6V3Z"/><path d="M14 3v5h4M9 12h6m-6 4h6"/>',
  find: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 4 4"/>',
  arrow: '<path d="M4 12h15m-5-5 5 5-5 5"/>',
  back: '<path d="M20 12H5m5-5-5 5 5 5"/>',
  convert: '<path d="M5 3h8l4 4v4M5 3v18h6m2-18v5h4m-7 7h10m-4-4 4 4-4 4"/>',
  merge: '<path d="M13 8V3H4v12h5m5-6h6v12H9V9h5Z"/><path d="M12 14h5m-2.5-2.5v5"/>',
  split: '<path d="M4 9V4h16v5m0 6v5H4v-5M3 12h3m3 0h2m3 0h2m3 0h2"/>',
  compress: '<path d="m8 8-4-4m4 0v4H4m12 8 4 4m-4 0v-4h4M4 20l4-4m0 4v-4H4M20 4l-4 4m4 0h-4V4"/>',
  arrange: '<rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="3" y="15" width="7" height="5" rx="1"/><path d="M14 17.5h7m-3-2.5 3 2.5-3 2.5"/>',
  picture: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m3 17 5-4 3 2 4-5 6 7"/>',
  watermark: '<path d="M12 2C10 6 5 10 5 15a7 7 0 0 0 14 0c0-5-5-9-7-13Z"/><path d="M8 15a4 4 0 0 0 4 4"/>',
  numbers: '<path d="M9 3 7 21M17 3l-2 18M4 9h16M3 15h16"/>',
  ocr: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M7 9h10m-5 0v8"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4m-4 4v2"/>',
  upload: '<path d="M12 16V4m-4 4 4-4 4 4M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  grip: '<circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/>',
  up: '<path d="m6 14 6-6 6 6"/>',
  down: '<path d="m6 10 6 6 6-6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  cross: '<path d="M12 3v18M3 12h18m-3 0h5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  file: '<path d="M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6m-6 4h6"/>',
};

const catalog = [
  { id: "donustur", label: "PDF’ye Dönüştür", icon: "convert", color: "teal", group: "Dönüştür", detail: "PNG ve JPEG dosyalarından PDF oluşturun.", keywords: "word powerpoint excel docx pptx xlsx jpg udf uyap converter", status: "Office ve UDF desteği planlanıyor" },
  { id: "birlestir", label: "PDF Birleştir", icon: "merge", color: "blue", group: "Düzenle", detail: "PDF’leri sıralayın, her dosyadan istediğiniz sayfaları alın." },
  { id: "ayir", label: "PDF Ayır", icon: "split", color: "violet", group: "Düzenle", detail: "Bir PDF’yi parçalara ayırın veya seçtiğiniz sayfaları çıkarın." },
  { id: "sikistir", label: "PDF Sıkıştır", icon: "compress", color: "amber", group: "Düzenle", detail: "PDF boyutunu küçültün ve çıktı kalitesini seçin.", plan: "Çıktı kalitesini bir önizlemede değerlendirin. İndirmeden önce sayfa sayısını ve dosya boyutunu karşılaştırın." },
  { id: "sayfalar", label: "Sayfaları Düzenle", icon: "arrange", color: "teal", group: "Düzenle", detail: "Sayfaları döndürün, silin veya yeniden sıralayın.", plan: "Küçük sayfa önizlemelerini sürükleyin veya yön düğmelerini kullanın. Seçili sayfaları döndürün ya da silin." },
  { id: "gorsel", label: "PDF’den Görsel Al", icon: "picture", color: "blue", group: "Dönüştür", detail: "PDF sayfalarını PNG veya JPEG olarak dışa aktarın.", plan: "Sayfaları, görsel biçimini ve çözünürlüğü seçin. Birden çok görseli ZIP olarak indirin." },
  { id: "filigran", label: "Filigran Ekle", icon: "watermark", color: "violet", group: "Düzenle", detail: "Sayfaların üzerine metin veya görsel filigran ekleyin.", plan: "Filigranın konumunu ve saydamlığını ayarlayın, uygulanacağı sayfaları seçin." },
  { id: "numara", label: "Sayfa Numaralandır", icon: "numbers", color: "amber", group: "Düzenle", detail: "Sayfa numaralarının yerini ve başlangıcını belirleyin.", plan: "Numaranın yerini, başlangıç değerini ve sayfa aralığını seçin. Yerleşimi önizlemede kontrol edin." },
  { id: "ocr", label: "Metin Tanıma (OCR)", icon: "ocr", color: "rose", group: "Dönüştür", detail: "Taranmış PDF’lere aranabilir metin katmanı ekleyin.", plan: "Tarama dilini ve sayfaları seçin, tanınan metni ve çıktıdaki sayfaları kontrol edin." },
  { id: "sifrele", label: "PDF Şifrele", icon: "lock", color: "slate", group: "Güvenlik", detail: "PDF’yi açmak için bir parola belirleyin.", plan: "Açma parolasını belirleyin ve doğrulayın. Şifreli bir kopya oluşturun." },
];

const samplePdfs = [
  { id: 1, name: "proje-raporu.pdf", pages: 12, mode: "all", range: "" },
  { id: 2, name: "ekler.pdf", pages: 8, mode: "range", range: "2-4, 7" },
  { id: 3, name: "kapak.pdf", pages: 1, mode: "all", range: "" },
];
const sourceDocuments = {
  office: [
    { name: "proje-raporu.docx", format: "DOCX", color: "blue", kind: "Word belgesi", pages: "6" },
    { name: "proje-sunumu.pptx", format: "PPTX", color: "rose", kind: "PowerPoint sunumu", pages: "8" },
    { name: "butce.xlsx", format: "XLSX", color: "teal", kind: "Excel çalışma kitabı", pages: "3" },
  ],
  image: [
    { name: "kapak-gorseli.png", format: "PNG", color: "teal", kind: "2400 × 3200 piksel", pages: "1" },
    { name: "proje-fotografi.jpg", format: "JPG", color: "amber", kind: "3000 × 2000 piksel", pages: "1" },
  ],
};

const app = document.querySelector("#app");
const dialog = document.querySelector("#dialog");
const state = {
  group: "Tümü",
  search: "",
  merge: [structuredClone(samplePdfs[0]), structuredClone(samplePdfs[1])],
  mergeName: "birlesik-belge.pdf",
  convertKind: "image",
  convertIndex: 0,
  imageSize: "Görsel boyutu",
  splitFile: true,
  splitMode: "extract",
  splitRange: "1-3, 6",
};

function icon(name, size = 22) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
}

function iconTile(tool) {
  return `<span class="icon ${tool.color}">${icon(tool.icon)}</span>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function paperArt() {
  return `<span class="art-paper-brand">PDF</span><div class="art-line title"></div>
    <div class="art-line"></div><div class="art-line short"></div>
    <div class="art-graph"><b style="--height:37%"></b><b style="--height:57%"></b><b style="--height:47%"></b><b style="--height:80%"></b><b style="--height:100%"></b></div>
    <div class="art-line"></div><div class="art-line short"></div>`;
}

function home() {
  return `<section class="hero" aria-labelledby="title">
      <div class="hero-copy">
        <h1 id="title">PDF araçları</h1>
        <p>Dosyalarınızı PDF’ye dönüştürün, birleştirin, ayırın ve dilediğiniz gibi düzenleyin.</p>
        <label class="hero-search">
          ${icon("find", 20)}<span class="visually-hidden">Araçlarda ara</span>
          <input id="search" type="search" placeholder="Araçlarda ara…" value="${escapeHtml(state.search)}">
        </label>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="art-file art-orange"><span>.PDF</span></div>
        <div class="art-file art-white">${paperArt()}</div>
        <span class="art-sticker">${icon("merge", 25)}</span>
        <span class="art-spark">${icon("cross", 22)}</span>
      </div>
    </section>
    <section class="tool-catalog" aria-labelledby="catalog-heading">
      <div class="catalog-heading">
        <h2 id="catalog-heading">Tüm araçlar</h2>
        <div class="filters" role="group" aria-label="Araç kategorisi">
          ${["Tümü", "Dönüştür", "Düzenle", "Güvenlik"].map(group => `<button class="filter" data-group="${group}" aria-pressed="${state.group === group}">${group}</button>`).join("")}
        </div>
      </div>
      <div class="tool-grid" id="tool-grid" aria-live="polite"></div>
    </section>`;
}

function normalized(value) {
  return value.toLocaleLowerCase("tr").normalize("NFD")
    .replace(/\p{Diacritic}/gu, "").replaceAll("ı", "i");
}

function updateCatalog() {
  const query = normalized(state.search.trim());
  const items = catalog.filter(tool => {
    const matchedGroup = state.group === "Tümü" || tool.group === state.group;
    const searchable = normalized(`${tool.label} ${tool.detail} ${tool.keywords ?? ""}`);
    return matchedGroup && query.split(/\s+/).every(word => searchable.includes(word));
  });
  document.querySelector("#tool-grid").innerHTML = items.map(tool => {
    const action = tool.plan ? `<button type="button" data-planned="${tool.id}"` : `<a href="#${tool.id}"`;
    return `${action} class="tool-card">
      ${iconTile(tool)}
      <div class="card-content"><h3>${tool.label}</h3><p>${tool.detail}</p>${tool.plan || tool.status ? `<small>${tool.status ?? "Planlanıyor"}</small>` : ""}</div>
      <span class="arrow">${icon("arrow", 16)}</span>
    </${tool.plan ? "button" : "a"}>`;
  }).join("") || '<p class="empty-catalog">Aramanıza uygun araç bulunamadı.</p>';
}

function toolHeader(id, description) {
  const tool = catalog.find(entry => entry.id === id);
  return `<div class="tool-heading">
    <a href="#araclar" class="back">${icon("back", 16)} Tüm araçlar</a>
    <div class="tool-title">${iconTile(tool)}<h1 id="title">${tool.label}</h1></div>
    <p>${description}</p>
  </div>`;
}

function fileDetails(file, format = "PDF", color = "") {
  return `<span class="file-tag ${color}" aria-hidden="true">${format}</span>
    <span class="file-name"><strong>${file.name}</strong><small>${file.kind ?? `${file.pages} sayfa`}</small></span>`;
}

function sampleZone(action, label, detail) {
  return `<button type="button" class="drop-zone" data-sample="${action}">
    <span class="icon">${icon("upload", 17)}</span>
    <span><strong>${label}</strong><small>${detail}</small></span>
    ${icon("arrow", 17)}
  </button>`;
}

function rowButton(action, file, name, glyph, disabled = false) {
  return `<button type="button" class="icon-button" data-file="${file.id}" data-file-action="${action}"
    aria-label="${file.name} ${name}" title="${name}" ${disabled ? "disabled" : ""}>${icon(glyph, 17)}</button>`;
}

function mergeRow(file, index) {
  return `<li class="file-row" data-file-row="${file.id}">
    <div class="row-top">
      <span class="grip" draggable="true" title="Sıralamak için sürükleyin" aria-hidden="true">${icon("grip", 17)}</span>
      ${fileDetails(file)}
      <div class="row-controls">
        ${rowButton("up", file, "yukarı taşı", "up", index === 0)}
        ${rowButton("down", file, "aşağı taşı", "down", index === state.merge.length - 1)}
        ${rowButton("remove", file, "listeden çıkar", "close")}
      </div>
    </div>
    <div class="range-row">
      <label for="mode-${file.id}">Sayfalar</label>
      <select class="control" id="mode-${file.id}" data-merge-mode="${file.id}" aria-label="${file.name} sayfa seçimi">
        <option value="all" ${file.mode === "all" ? "selected" : ""}>Tüm sayfalar</option>
        <option value="range" ${file.mode === "range" ? "selected" : ""}>Aralık seç</option>
      </select>
      <input class="control" data-merge-range="${file.id}" type="text" value="${escapeHtml(file.range)}"
        aria-label="${file.name} sayfa aralığı" aria-describedby="error-${file.id}" placeholder="2-4, 7" ${file.mode === "all" ? "hidden" : ""}>
      <span class="range-error" id="error-${file.id}" hidden></span>
    </div>
  </li>`;
}

function merge() {
  return `${toolHeader("birlestir", "İki veya daha fazla PDF’yi seçtiğiniz sırayla tek dosyada birleştirin.")}
    <div class="workspace">
      <section class="panel" aria-labelledby="files-heading">
        <div class="panel-title">
          <div><h2 id="files-heading">PDF dosyaları</h2><p class="panel-lead">Sürükleyin veya okları kullanın. Her dosya için sayfaları ayrı seçebilirsiniz.</p></div>
          <button type="button" class="text-button" data-reset="merge">Örnekleri sıfırla</button>
        </div>
        ${sampleZone("merge", "Örnek PDF ekle", "Eklenen dosyalarda başlangıçta tüm sayfalar seçilir.")}
        <ol class="file-list">${state.merge.map(mergeRow).join("")}</ol>
        ${state.merge.length === 0 ? '<p class="sample-empty">Başlamak için en az iki örnek PDF ekleyin.</p>' : ""}
      </section>
      <aside class="panel summary" aria-labelledby="summary-title">
        <h2 id="summary-title">Birleştirme özeti</h2>
        <dl aria-live="polite">
          <div><dt>Dosya sayısı</dt><dd>${state.merge.length} PDF</dd></div>
          <div><dt>Çıktıdaki sayfa sayısı</dt><dd id="merge-count"></dd></div>
        </dl>
        <label class="field-label">Çıktı dosyası
          <input class="control" id="merge-name" type="text" value="${escapeHtml(state.mergeName)}" maxlength="100">
        </label>
        <button class="button" type="button" id="merge-action" data-result="merge">PDF’leri birleştir ${icon("arrow", 16)}</button>
        <p class="context-note">${icon("lock", 15)}<span>Planlanan işlem cihazda çalışır.</span></p>
      </aside>
    </div>`;
}

function modeButton(mode, value, label, current) {
  return `<button type="button" class="mode-button" data-mode="${mode}" data-value="${value}" aria-pressed="${current === value}">${label}</button>`;
}

function convert() {
  const files = sourceDocuments[state.convertKind];
  const sample = files?.[state.convertIndex];
  const image = state.convertKind === "image";
  return `${toolHeader("donustur", "Görselleri cihazınızda PDF’ye aktarın. Çıktıyı indirmeden önce önizleyin.")}
    <div class="workspace">
      <section class="panel" aria-labelledby="source-heading">
        <div class="panel-title"><div><h2 id="source-heading">Kaynak dosya</h2><p class="panel-lead">Dosya türünü seçin.</p></div></div>
        <div class="mode-options" role="group" aria-label="Dosya türü">
          ${modeButton("convertKind", "image", "PNG / JPEG", state.convertKind)}
          ${modeButton("convertKind", "office", "Word / Excel / PowerPoint", state.convertKind)}
          ${modeButton("convertKind", "udf", "UYAP (UDF)", state.convertKind)}
        </div>
        ${sample ? `
          ${sampleZone("convert", "Başka örnek seç", files.map(file => file.format).join(" · "))}
          <div class="file-row row-top">${fileDetails(sample, sample.format, sample.color)}</div>
          <div class="setting-box">
            ${image ? `<label class="field-label">Sayfa boyutu
              <select class="control" id="image-size">
                ${["Görsel boyutu", "A4 · Sayfaya sığdır"].map(value => `<option ${value === state.imageSize ? "selected" : ""}>${value}</option>`).join("")}
              </select>
            </label>
            <p class="context-note">${icon("info", 16)} Orijinal en-boy oranı ve çözünürlük korunur.</p>`
              : `<div class="notice">${icon("info", 18)}<span><strong>Tarayıcıda Office dönüşümü araştırılıyor.</strong> Şimdilik belgenizi Office veya ücretsiz LibreOffice ile PDF olarak dışa aktarabilirsiniz. <a href="https://help.libreoffice.org/latest/en-US/text/shared/01/ref_pdf_export.html" target="_blank" rel="noreferrer">LibreOffice yardımını aç</a></span></div>`}
          </div>
          ${image ? `<p class="context-note">${icon("lock", 15)}<span>Görsel dönüşümü cihazda çalışacak.</span></p>` : ""}`
          : `<div class="notice">${icon("info", 18)}<span><strong>UDF desteği planlanıyor.</strong> Sayfa düzeni UYAP’ın PDF çıktısıyla karşılaştırılacak. <a href="https://uyap.gov.tr/Uyap-Editor-Yardim" target="_blank" rel="noreferrer">UYAP Editör yardımını aç</a></span></div>`}
      </section>
      <aside class="panel summary" aria-labelledby="preview-heading">
        <h2 id="preview-heading">Çıktı önizlemesi</h2>
        ${sample ? `<div class="preview-stage" aria-hidden="true"><div class="preview-paper">${paperArt()}</div></div>
          <p class="preview-caption">Temsili önizleme · 1 / ${sample.pages}</p>`
          : '<p class="sample-empty">UDF için önizleme henüz kullanılamıyor.</p>'}
        <button class="button" type="button" data-result="convert" ${image ? "" : "disabled"}>PDF’ye dönüştür ${icon("arrow", 16)}</button>
      </aside>
    </div>`;
}

function split() {
  return `${toolHeader("ayir", "Bir PDF’den istediğiniz sayfaları çıkarın veya belgeyi ayrı dosyalara bölün.")}
    <div class="workspace">
      <section class="panel" aria-labelledby="split-heading">
        <div class="panel-title">
          <div><h2 id="split-heading">Kaynak PDF</h2><p class="panel-lead">Ayırma yöntemini ve sayfaları seçin.</p></div>
          ${state.splitFile ? '<button type="button" class="text-button" data-reset="split">Dosyayı kaldır</button>' : ""}
        </div>
        ${!state.splitFile ? sampleZone("split", "Örnek PDF seç", "8 sayfalık bir örnek belgeyi inceleyin.") : `
          <div class="file-row row-top">${fileDetails({ name: "proje-notlari.pdf", pages: 8 })}</div>
          <div class="mode-options split-modes" role="group" aria-label="Ayırma yöntemi">
            ${modeButton("splitMode", "extract", "Seçili sayfaları çıkar", state.splitMode)}
            ${modeButton("splitMode", "ranges", "Aralıklara ayır", state.splitMode)}
            ${modeButton("splitMode", "each", "Her sayfayı ayır", state.splitMode)}
          </div>
          <label class="split-input field-label" ${state.splitMode === "each" ? "hidden" : ""}>Sayfa aralığı
            <input class="control" id="split-range" value="${escapeHtml(state.splitRange)}" placeholder="1-3, 6" aria-describedby="split-error">
            <span class="range-error" id="split-error" hidden></span>
          </label>
          <div class="page-strip" role="group" aria-label="Örnek sayfalar">
            ${Array.from({ length: 8 }, (_, index) => `<button class="page-thumb" type="button" data-page="${index + 1}"
              aria-label="${index + 1}. sayfa" aria-pressed="false" ${state.splitMode === "extract" ? "" : "disabled"}>${icon("file", 20)}<span>${index + 1}</span></button>`).join("")}
          </div>`}
      </section>
      <aside class="panel summary" aria-labelledby="split-summary">
        <h2 id="split-summary">Ayırma özeti</h2>
        <dl aria-live="polite">
          <div><dt>Seçilen sayfa</dt><dd id="split-pages"></dd></div>
          <div><dt>Çıktı</dt><dd id="split-count"></dd></div>
          <div><dt>İndirme biçimi</dt><dd id="split-format"></dd></div>
        </dl>
        <button class="button" type="button" id="split-action" data-result="split">Sayfaları ayır ${icon("arrow", 16)}</button>
        <p class="context-note">${icon("lock", 15)}<span>Planlanan işlem cihazda çalışır.</span></p>
      </aside>
    </div>`;
}

function parseRange(input, pageCount) {
  if (!input.trim()) return { error: "Bir sayfa aralığı girin." };
  const groups = [];
  for (const part of input.split(",")) {
    const match = part.trim().match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/u);
    if (!match) return { error: "Aralığı 2-4, 7 biçiminde girin." };
    const first = Number(match[1]);
    const last = Number(match[2] ?? match[1]);
    if (first < 1 || last > pageCount || first > last) {
      return { error: `1 ile ${pageCount} arasında artan sayfa aralıkları kullanın.` };
    }
    groups.push(Array.from({ length: last - first + 1 }, (_, index) => first + index));
  }
  const pages = groups.flat();
  if (new Set(pages).size !== pages.length) return { error: "Her sayfayı bir kez seçin." };
  return { pages, groups };
}

function updateMerge() {
  let total = 0;
  let invalid = false;
  for (const file of state.merge) {
    const input = document.querySelector(`#app [data-merge-range="${file.id}"]`);
    const error = document.querySelector(`#error-${file.id}`);
    const selection = file.mode === "range" ? parseRange(file.range, file.pages) : null;
    input.hidden = !selection;
    if (selection?.error) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
    error.hidden = !selection?.error;
    error.textContent = selection?.error ?? "";
    total += selection ? selection.pages?.length ?? 0 : file.pages;
    invalid ||= Boolean(selection?.error);
  }
  document.querySelector("#merge-count").textContent = invalid ? "—" : `${total} sayfa`;
  document.querySelector("#merge-action").disabled = invalid || state.merge.length < 2 || !state.mergeName.trim();
}

function splitSelection() {
  if (!state.splitFile) return { pages: [], outputs: 0 };
  if (state.splitMode === "each") {
    return { pages: Array.from({ length: 8 }, (_, index) => index + 1), outputs: 8 };
  }
  const parsed = parseRange(state.splitRange, 8);
  if (parsed.error) return { pages: [], outputs: 0, error: parsed.error };
  return { pages: parsed.pages, outputs: state.splitMode === "extract" ? 1 : parsed.groups.length };
}

function updateSplit() {
  const { pages, outputs, error } = splitSelection();
  document.querySelector("#split-pages").textContent = error ? "—" : `${pages.length} sayfa`;
  document.querySelector("#split-count").textContent = error ? "—" : `${outputs} PDF`;
  document.querySelector("#split-format").textContent = outputs > 1 ? "ZIP" : outputs === 1 ? "PDF" : "—";
  document.querySelector("#split-action").disabled = outputs === 0;
  const range = document.querySelector("#split-range");
  if (!range) return;
  const warning = document.querySelector("#split-error");
  warning.hidden = !error;
  warning.textContent = error ?? "";
  if (error) range.setAttribute("aria-invalid", "true");
  else range.removeAttribute("aria-invalid");
  for (const page of app.querySelectorAll("[data-page]")) {
    page.setAttribute("aria-pressed", String(pages.includes(Number(page.dataset.page))));
  }
}

function render() {
  const pages = { araclar: home, donustur: convert, birlestir: merge, ayir: split };
  const hash = location.hash.slice(1);
  const current = Object.hasOwn(pages, hash) ? hash : "araclar";
  app.innerHTML = pages[current]();
  for (const item of document.querySelectorAll("[data-nav]")) {
    if (item.dataset.nav === current) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  }
  if (current === "araclar") updateCatalog();
  if (current === "birlestir") updateMerge();
  if (current === "ayir") updateSplit();
}

function showDialog(tool, label, description) {
  document.querySelector("#dialog-content").innerHTML = `${iconTile(tool)}
    <h2 id="dialog-title">${label}</h2><p>${description}</p>`;
  dialog.showModal();
}

function addSample(action) {
  if (action === "merge") {
    const sample = samplePdfs.find(file => !state.merge.some(current => current.id === file.id));
    if (!sample) {
      showDialog(catalog[1], "Tüm örnekler eklendi", "Dosyaları sıralayabilir veya sayfa aralıklarını değiştirebilirsiniz.");
      return;
    }
    state.merge.push({ ...sample, mode: "all", range: "" });
  }
  if (action === "convert") {
    state.convertIndex = (state.convertIndex + 1) % sourceDocuments[state.convertKind].length;
  }
  if (action === "split") state.splitFile = true;
  render();
  app.querySelector("[data-sample]")?.focus({ preventScroll: true });
}

function moveFile(id, index, focusAction) {
  const current = state.merge.findIndex(file => file.id === id);
  if (current < 0 || index < 0 || index >= state.merge.length || current === index) return;
  const [file] = state.merge.splice(current, 1);
  state.merge.splice(index, 0, file);
  render();
  if (focusAction) {
    const row = app.querySelector(`[data-file-row="${id}"]`);
    const sameButton = row.querySelector(`[data-file-action="${focusAction}"]:not(:disabled)`);
    (sameButton ?? row.querySelector("[data-file-action]:not(:disabled)")).focus({ preventScroll: true });
  }
}

app.addEventListener("input", event => {
  const input = event.target;
  if (input.id === "search") {
    state.search = input.value;
    updateCatalog();
  }
  if (input.dataset.mergeRange) {
    state.merge.find(file => file.id === Number(input.dataset.mergeRange)).range = input.value;
    updateMerge();
  }
  if (input.id === "merge-name") {
    state.mergeName = input.value;
    updateMerge();
  }
  if (input.id === "split-range") {
    state.splitRange = input.value;
    updateSplit();
  }
});

app.addEventListener("change", event => {
  const select = event.target;
  if (select.dataset.mergeMode) {
    state.merge.find(file => file.id === Number(select.dataset.mergeMode)).mode = select.value;
    updateMerge();
  }
  if (select.id === "image-size") state.imageSize = select.value;
});

app.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  const { group, planned, sample, reset, mode, value, file, fileAction, result, page } = button.dataset;
  if (group) {
    state.group = group;
    for (const filter of app.querySelectorAll("[data-group]")) {
      filter.setAttribute("aria-pressed", String(filter === button));
    }
    updateCatalog();
  }
  if (planned) {
    const tool = catalog.find(entry => entry.id === planned);
    showDialog(tool, tool.label, tool.plan);
  }
  if (sample) addSample(sample);
  if (reset) {
    if (reset === "split") state.splitFile = false;
    if (reset === "merge") {
      state.merge = structuredClone(samplePdfs.slice(0, 2));
      state.mergeName = "birlesik-belge.pdf";
    }
    render();
    app.querySelector(`[data-reset="${reset}"], [data-sample="${reset}"]`)?.focus({ preventScroll: true });
  }
  if (mode) {
    if (mode === "convertKind" && state.convertKind !== value) state.convertIndex = 0;
    state[mode] = value;
    render();
    app.querySelector(`[data-mode="${mode}"][data-value="${value}"]`).focus({ preventScroll: true });
  }
  if (fileAction) {
    const id = Number(file);
    const index = state.merge.findIndex(entry => entry.id === id);
    if (fileAction === "remove") {
      state.merge.splice(index, 1);
      render();
      const removalButtons = app.querySelectorAll('[data-file-action="remove"]');
      (removalButtons[Math.min(index, removalButtons.length - 1)] ?? app.querySelector("[data-sample]")).focus({ preventScroll: true });
    } else {
      moveFile(id, index + (fileAction === "up" ? -1 : 1), fileAction);
    }
  }
  if (page) {
    const current = new Set(splitSelection().pages);
    const number = Number(page);
    if (current.has(number)) current.delete(number);
    else current.add(number);
    state.splitRange = [...current].sort((a, b) => a - b).join(", ");
    document.querySelector("#split-range").value = state.splitRange;
    updateSplit();
  }
  if (result === "merge") {
    const count = document.querySelector("#merge-count").textContent;
    showDialog(catalog[1], "Birleştirme sonucu", `${escapeHtml(state.mergeName)} · ${count}. Bu ekran örnek indirme adımını gösterir.`);
  }
  if (result === "convert") {
    const file = sourceDocuments[state.convertKind][state.convertIndex];
    showDialog(catalog[0], "Dönüştürme sonucu", `${file.name.replace(/\.[^.]+$/, ".pdf")} · ${file.pages} sayfa. Bu ekran örnek indirme adımını gösterir.`);
  }
  if (result === "split") {
    const { pages, outputs } = splitSelection();
    const download = outputs > 1 ? "proje-notlari.zip" : "proje-notlari-secili.pdf";
    showDialog(catalog[2], "Ayırma sonucu", `${download} · ${outputs} PDF · ${pages.length} sayfa. Bu ekran örnek indirme adımını gösterir.`);
  }
});

app.addEventListener("dragstart", event => {
  const handle = event.target.closest(".grip");
  if (!handle) return;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("application/x-brennt-sample", handle.closest("[data-file-row]").dataset.fileRow);
});

app.addEventListener("dragover", event => {
  const row = event.target.closest("[data-file-row]");
  const zone = event.target.closest(".drop-zone");
  if (row && event.dataTransfer.types.includes("application/x-brennt-sample")) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    app.querySelector(".is-target")?.classList.remove("is-target");
    row.classList.add("is-target");
  }
  if (zone && event.dataTransfer.types.includes("Files")) {
    event.preventDefault();
    zone.classList.add("over");
  }
});

app.addEventListener("dragleave", event => {
  const target = event.target.closest(".is-target, .over");
  if (target && !target.contains(event.relatedTarget)) target.classList.remove("is-target", "over");
});

app.addEventListener("dragend", () => app.querySelector(".is-target")?.classList.remove("is-target"));

app.addEventListener("drop", event => {
  const row = event.target.closest("[data-file-row]");
  const zone = event.target.closest(".drop-zone");
  if (row && event.dataTransfer.types.includes("application/x-brennt-sample")) {
    event.preventDefault();
    row.classList.remove("is-target");
    moveFile(Number(event.dataTransfer.getData("application/x-brennt-sample")),
      state.merge.findIndex(file => file.id === Number(row.dataset.fileRow)));
  }
  if (event.dataTransfer.types.includes("Files")) {
    event.preventDefault();
    zone?.classList.remove("over");
    if (zone) showDialog(catalog[0], "Örnek dosyayla deneyin", "Tasarım önizlemesinde hazır örneklerden birini seçebilirsiniz.");
  }
});

app.addEventListener("dragover", event => {
  if (event.dataTransfer.types.includes("Files")) event.preventDefault();
});

document.querySelector(".brand-mark").innerHTML = icon("brand", 21);
window.addEventListener("hashchange", () => {
  if (location.hash === "#app") return;
  render();
  window.scrollTo(0, 0);
  const title = app.querySelector("h1");
  title.tabIndex = -1;
  title.focus({ preventScroll: true });
});
render();
