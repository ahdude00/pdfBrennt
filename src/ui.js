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
  download: '<path d="M12 4v12m-4-4 4 4 4-4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  grip: '<circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/>',
  up: '<path d="m6 14 6-6 6 6"/>',
  down: '<path d="m6 10 6 6 6-6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  cross: '<path d="M12 3v18M3 12h18m-3 0h5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  file: '<path d="M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6m-6 4h6"/>',
};

export const catalog = [
  { id: "donustur", label: "PDF’ye Dönüştür", icon: "convert", color: "teal", group: "Dönüştür", detail: "PNG, JPEG ve UYAP (UDF) belgelerinden PDF oluşturun.", keywords: "word powerpoint excel docx pptx xlsx jpg udf uyap converter", status: "Office · Yakında" },
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

export function icon(name, size = 22) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
}

export function iconTile(tool) {
  return `<span class="icon ${tool.color}">${icon(tool.icon)}</span>`;
}

export function escapeHtml(value) {
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

export function home(state) {
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

export function renderCatalog(state) {
  const query = normalized(state.search.trim());
  const items = catalog.filter(tool => {
    const matchedGroup = state.group === "Tümü" || tool.group === state.group;
    const searchable = normalized(`${tool.label} ${tool.detail} ${tool.keywords ?? ""}`);
    return matchedGroup && query.split(/\s+/).every(word => searchable.includes(word));
  });
  return items.map(tool => {
    const action = tool.plan ? `<button type="button" data-planned="${tool.id}"` : `<a href="#${tool.id}"`;
    return `${action} class="tool-card">
      ${iconTile(tool)}
      <div class="card-content"><h3>${tool.label}</h3><p>${tool.detail}</p>${tool.plan || tool.status ? `<small>${tool.status ?? "Yakında"}</small>` : ""}</div>
      <span class="arrow">${icon("arrow", 16)}</span>
    </${tool.plan ? "button" : "a"}>`;
  }).join("") || '<p class="empty-catalog">Aramanıza uygun araç bulunamadı.</p>';
}

export function toolHeader(id, description) {
  const tool = catalog.find(entry => entry.id === id);
  return `<div class="tool-heading">
    <a href="#araclar" class="back">${icon("back", 16)} Tüm araçlar</a>
    <div class="tool-title">${iconTile(tool)}<h1 id="title">${tool.label}</h1></div>
    <p>${description}</p>
  </div>`;
}

export function fileDetails(file, format = "PDF", color = "") {
  return `<span class="file-tag ${color}" aria-hidden="true">${format}</span>
    <span class="file-name"><strong>${escapeHtml(file.name)}</strong><small>${escapeHtml(file.kind ?? `${file.pages} sayfa`)}</small></span>`;
}
