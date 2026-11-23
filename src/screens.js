import { icon, escapeHtml, fileDetails, toolHeader } from "./ui.js";
import { udfFontPresets } from "./udf-font-presets.js";
import { bridgeDownloadUrl } from "./udf-bridge.js";

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
  if (view.busy) return `<p class="operation-status" role="status">İşlem sürüyor…${view.progress ? ` ${e(view.progress)}` : ""}</p>`;
  if (view.loading) return '<p class="operation-status" role="status">Dosyalar okunuyor…</p>';
  return view.problem ? `<p class="problem" role="alert">${e(view.problem)}</p>` : "";
}

function actionButton(id, label, view, unavailable = false) {
  return `<button class="button" type="button" id="${id}-action" data-operation ${view.loading || view.busy || unavailable ? "disabled" : ""}>
    ${view.busy ? "Hazırlanıyor…" : label} ${icon("arrow", 16)}</button>`;
}

function rowButton(action, file, name, glyph, disabled = false) {
  return `<button type="button" class="icon-button" data-file="${file.id}" data-file-action="${action}"
    aria-label="${e(file.name)} ${name}" title="${name}" ${disabled ? "disabled" : ""}>${icon(glyph, 17)}</button>`;
}

function sortableRow(file, index, view, rangeOptions = false) {
  const tag = file.format === "JPEG" ? "JPG" : file.format;
  const color = rangeOptions ? "" : file.format === "UDF" ? "amber" : "teal";
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

// The font families and faces that all selected documents use, each family once.
function udfFontRequirements(files) {
  const merged = new Map();
  for (const { family, faces } of files.flatMap(file => file.fontRequirements ?? [])) {
    const key = family.normalize("NFC").trim().replace(/\s+/gu, " ").toLowerCase();
    const entry = merged.get(key) ?? { family, faces: [] };
    for (const face of faces) if (!entry.faces.includes(face)) entry.faces.push(face);
    merged.set(key, entry);
  }
  return [...merged.values()];
}

function udfFontSettings(view) {
  const required = udfFontRequirements(view.files);
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
    ${required.length ? `<ul class="udf-font-list" aria-label="${view.files.length > 1 ? "Belgelerde" : "Belgede"} kullanılan yazı tipleri">${required.map(({ family, faces }) =>
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

function udfBridgeBox(view) {
  return `<section class="udf-bridge" aria-labelledby="udf-bridge-heading">
    <h3 id="udf-bridge-heading">UYAP köprüsü</h3>
    <p>Site belgenizi dönüştüremezse, köprü dönüşümü bu bilgisayardaki <strong>UYAP Doküman Editörü</strong> ile yapar. Belgeniz bilgisayarınızda kalır.</p>
    <p>Başlamadan önce Windows bilgisayarınızda UYAP Doküman Editörü’nün açıldığını kontrol edin. Bu sayfayı <strong>Chrome</strong> veya <strong>Edge</strong>’de açın. Köprü telefonda çalışmaz.</p>
    <ol class="udf-bridge-steps">
      <li>
        <a href="${e(bridgeDownloadUrl)}" download>Köprüyü indirin</a>
        <p><kbd>Windows</kbd> + <kbd>E</kbd> tuşlarına basın. Açılan pencerede soldaki <strong>İndirilenler</strong> klasörüne tıklayın. <code>pdfbrennt-kopru.jar</code> dosyasını arayın.</p>
        <details>
          <summary>İndirdiğiniz dosyayı bulamıyorsanız</summary>
          <p>Chrome veya Edge’de <kbd>Ctrl</kbd> + <kbd>J</kbd> tuşlarına basın. İndirme listesinde dosyayı bulun ve dosyanın bulunduğu klasörü açan seçeneği kullanın. Dosya listede yoksa <strong>Köprüyü indirin</strong> bağlantısına yeniden tıklayın.</p>
        </details>
      </li>
      <li>
        <strong>Köprüyü açın</strong>
        <p>İndirdiğiniz dosyaya çift tıklayın. <strong>PDF Brennt köprüsü</strong> penceresinde <strong>“Köprü hazır.”</strong> yazısını bekleyin. Pencerede UYAP Doküman Editörü’nün bulunduğu klasör de yazar.</p>
        <details>
          <summary>Köprü açılmıyorsa</summary>
          <p>Windows dosyayı hangi programla açacağınızı sorarsa, listede Java varsa onu seçin. Java, UYAP Doküman Editörü’nü çalıştıran programdır.</p>
          <p>SmartScreen veya bilinmeyen yayımcı uyarısı görürseniz dosyayı <strong>ahdude00.github.io/pdfBrennt/</strong> adresinden indirdiğinizi kontrol edin. Kaynaktan eminseniz ve Windows bu dosyayı açma seçeneği sunuyorsa o seçeneği kullanabilirsiniz. Windows bir tehdit bildirirse veya açmaya izin vermezse uyarıyı kapatın.</p>
          <p>Çift tıklayınca hiçbir şey olmuyorsa şu adımları izleyin.</p>
          <ol>
            <li>Dosya Gezgini’nde indirdiğiniz dosyanın bulunduğu klasörü açın. Dosya adının <code>pdfbrennt-kopru.jar</code> olduğuna bakın.</li>
            <li>Pencerenin üstündeki adres çubuğuna tıklayın. <code>cmd</code> yazıp <kbd>Enter</kbd>’a basın. Siyah bir pencere açılır.</li>
            <li>Bu pencereye <code>java -jar pdfbrennt-kopru.jar</code> yazıp <kbd>Enter</kbd>’a basın. Köprü penceresinde <strong>“Köprü hazır.”</strong> yazısını bekleyin. Siyah pencereyi de dönüşüm bitene kadar açık tutun.</li>
          </ol>
          <p>Siyah pencerede dosyanın bulunamadığı yazıyorsa klasörü ve dosya adını kontrol edin. Java bulunamadıysa Başlat menüsünden UYAP Doküman Editörü’nü açmayı deneyin. Editör de açılmazsa UYAP kurulumunu tamamlayıp tekrar deneyin.</p>
        </details>
        <details>
          <summary>Köprü UYAP’ı bulamazsa</summary>
          <p>Köprü UYAP Doküman Editörü’nü kendisi arar. Bulamazsa hangi klasörlere baktığını yazar. Editör genellikle <code>C:\\UYAP\\Uyap Kelime Islemci</code> klasörüne kurulur. Bu klasörde <code>editor-app.jar</code> ya da sürüme göre <code>editor_lib.jar</code> gibi adı farklı <code>.jar</code> dosyaları bulunur.</p>
          <ol>
            <li>Klavyede <kbd>Windows</kbd> + <kbd>E</kbd> tuşlarına basın. Soldan <strong>Bu bilgisayar</strong>’ı seçin.</li>
            <li>Sağ üstteki arama kutusuna <code>Uyap Kelime</code> yazıp <kbd>Enter</kbd>’a basın. Bulunan klasör UYAP’ın klasörüdür.</li>
            <li>Köprü penceresinde <strong>Dosya seç</strong> düğmesine basın. O klasördeki herhangi bir <code>.jar</code> dosyasını seçip <strong>Seç</strong>’e basın. Doğru dosyayı köprü kendisi bulur. <strong>“Köprü hazır.”</strong> yazısını bekleyin.</li>
          </ol>
          <p>Köprü seçilen klasörde dönüştürücüyü bulamazsa bu UYAP sürümü henüz desteklenmiyor olabilir. Köprü o zaman Masaüstü’ne <code>pdfbrennt-kopru-rapor.txt</code> adlı bir dosya yazar. Bu dosyada belge içeriği yoktur, yalnızca UYAP programının dosya adları vardır. Dosyayı geliştiriciye gönderirseniz bu sürüm de desteklenebilir.</p>
          <p>Arama hiçbir şey bulmazsa UYAP Doküman Editörü bu bilgisayarda kurulu değildir. Önce editörü kurun, sonra köprüyü yeniden açın.</p>
        </details>
      </li>
      <li>
        <strong>Belgenizi dönüştürün</strong>
        <p>Bu sayfada UYAP belgenizi seçin. Köprü penceresi açıkken <strong>UYAP köprüsüyle dönüştür</strong> düğmesine basın. Tarayıcı erişim sorarsa <strong>İzin ver</strong>’i seçin.</p>
        <details>
          <summary>Erişim engellendiyse</summary>
          <ol>
            <li>Adres çubuğunun solundaki site bilgisi simgesine tıklayın. Açılan menüde bu sitenin ayarlarına bakın.</li>
            <li>Bu bilgisayardaki uygulamalara veya yerel ağa erişim iznini bulun ve izin verin. Ayarı göremezseniz Chrome ya da Edge’i güncelleyip yeniden deneyin.</li>
            <li>Sayfayı yenileyin. Belgenizi yeniden seçin ve <strong>UYAP köprüsüyle dönüştür</strong> düğmesine tekrar basın.</li>
          </ol>
        </details>
        <p><strong>Dosyanız hazır</strong> yazısını gördüğünüzde <strong>PDF’yi indir</strong> düğmesine basın. Bir hata görürseniz ekrandaki adımı izleyin. İşiniz bitince köprü penceresindeki <strong>Köprüyü kapat</strong> düğmesine basın.</p>
      </li>
    </ol>
    <button class="button secondary" type="button" data-bridge ${!view.files.length || view.loading || view.busy ? "disabled" : ""}>UYAP köprüsüyle dönüştür</button>
    <p class="udf-bridge-repeat"><strong>Sonraki kullanımda</strong> İndirilenler’deki köprüyü yeniden açın, sitede belgenizi seçin ve dönüştürün. Aynı dosyayı tekrar indirmeniz gerekmez.</p>
  </section>`;
}

// Output choice and summary for the selected UDF files.
function udfOutputSettings(view) {
  const count = view.files.length;
  const merged = count > 1 && view.output === "merged";
  const bridgeOnly = view.files.filter(file => file.bridgeOnly).length;
  const output = !count ? "—" : count === 1 ? "PDF" : merged ? "Tek PDF" : `${count} PDF · ZIP`;
  const bridgeNote = bridgeOnly === count
    ? `${count > 1 ? "Bu belgeler" : "Bu belge"} tarayıcıda dönüştürülemiyor. Aşağıdaki UYAP köprüsünü kullanın.`
    : `${bridgeOnly} belge tarayıcıda dönüştürülemiyor. ${bridgeOnly > 1 ? "Bu belgeleri" : "Bu belgeyi"} listeden çıkarın ya da tümünü aşağıdaki UYAP köprüsüyle dönüştürün.`;
  return `${count > 1 ? `<div class="mode-options udf-output" role="group" aria-label="Çıktı biçimi">
      ${modeButton("udf-output", "separate", "Ayrı PDF’ler (ZIP)", view.output)}
      ${modeButton("udf-output", "merged", "Tek PDF’de birleştir", view.output)}
    </div>` : ""}
    <dl aria-live="polite">
      <div><dt>Belge sayısı</dt><dd>${count ? `${count} UDF` : "—"}</dd></div>
      <div><dt>Çıktı</dt><dd>${output}</dd></div>
    </dl>
    ${merged ? '<p class="panel-lead">Belgeler listedeki sırayla tek PDF’de birleştirilir.</p>' : ""}
    ${count > 1 && !merged ? '<p class="panel-lead">Her belge kendi adıyla ayrı bir PDF olur ve hepsi tek ZIP dosyasında iner.</p>' : ""}
    ${count <= 1 || merged ? '<p class="panel-lead">Çıktıyı indirmeden önce inceleyebilirsiniz.</p>' : ""}
    ${bridgeOnly ? `<p class="notice udf-bridge-only">${icon("info", 17)}<span>${bridgeNote}</span></p>` : ""}`;
}

export function convertScreen(view) {
  const image = view.kind === "image";
  const udf = view.kind === "udf";
  const active = udf ? view.udf : view;
  const source = `<div class="mode-options" role="group" aria-label="Dosya türü">
      ${modeButton("convert", "image", "PNG / JPEG / TIFF", view.kind)}
      ${modeButton("convert", "office", "Word / Excel / PowerPoint", view.kind)}
      ${modeButton("convert", "udf", "UYAP (UDF)", view.kind)}
    </div>
    ${image ? `
      ${uploadZone("convert-input", "Görselleri seç", "PNG, JPEG veya TIFF dosyalarını seçin ya da buraya sürükleyin.", ".png,.jpg,.jpeg,.tif,.tiff,image/png,image/jpeg,image/tiff", true)}
      ${view.files.length ? `<ol class="file-list">${view.files.map((file, index) => sortableRow(file, index, view)).join("")}</ol>` : ""}
      ` : udf ? `
        <p class="notice udf-notice">${icon("info", 18)}<span>Satır ve sayfa düzeni UYAP Editör’ün PDF çıktısıyla aynı kalır. Tablo, görsel, üstbilgi, altbilgi, sayfa numarası, liste, sekme, vurgu ve yatay sayfa desteklenir. Henüz birebir çizilemeyen öğeler içeren belgeler, eksik çıktı vermek yerine nedeni belirtilerek reddedilir; bu belgeler için aşağıdaki UYAP köprüsünü kullanabilirsiniz.</span></p>
        ${uploadZone("udf-input", view.udf.files.length ? "UDF ekle" : "UDF seç", "Bir veya daha fazla UDF seçin ya da buraya sürükleyin. Her biri en çok 16 MB olabilir.", ".udf", true)}
        ${view.udf.files.length ? `<ol class="file-list">${view.udf.files.map((file, index) => sortableRow(file, index, view.udf)).join("")}</ol>` : ""}
        ${view.udf.files.length && view.udf.files.every(file => file.bridgeOnly) ? "" : udfFontSettings(view.udf)}
      ` : convertHelp()}`;
  const description = image
    ? "Görselleri cihazınızda PDF’ye dönüştürün. Her görsel, çok sayfalı TIFF’lerde her sayfa bir PDF sayfası olur."
    : udf ? "UYAP belgelerini cihazınızda PDF’ye dönüştürün. Birden çok belgeyi ayrı PDF’lere ya da tek PDF’ye çevirebilirsiniz."
    : "Office belgelerini PDF olarak dışa aktarma seçeneklerini görün.";
  return `${toolHeader("donustur", description)}
    <div class="workspace">
      <section class="panel" aria-labelledby="source-heading">
        <div class="panel-title">
          <div><h2 id="source-heading">Kaynak dosyalar</h2><p class="panel-lead">${image ? "Dosya türünü seçin. Birden çok görseli sıralayabilirsiniz."
            : udf ? "Dosya türünü seçin. Birden çok belgeyi sürükleyerek veya oklarla sıralayabilirsiniz." : "Dosya türünü seçin."}</p></div>
          ${(image || udf) && active.files.length ? `<button type="button" class="text-button" data-clear ${active.loading || active.busy ? "disabled" : ""}>Tümünü kaldır</button>` : ""}
        </div>
        ${progressOrFiles(active, source)}
      </section>
      ${image ? `<aside class="panel summary" aria-labelledby="preview-heading">
        <h2 id="preview-heading">PDF ayarları</h2>
        <dl><div><dt>Çıktıdaki sayfa sayısı</dt><dd>${view.files.reduce((count, file) => count + (file.pages ?? 1), 0)} sayfa</dd></div></dl>
        <label class="field-label" for="image-size">Sayfa boyutu</label>
        <select class="control image-size" id="image-size" ${view.busy ? "disabled" : ""}>
          <option value="original" ${view.size === "original" ? "selected" : ""}>Görsel boyutu</option>
          <option value="a4" ${view.size === "a4" ? "selected" : ""}>A4 · Sayfaya sığdır</option>
        </select>
        <p class="context-note">${icon("info", 15)} Görselin oranı korunur. Boyut seçimi piksel sayısını değiştirmez. TIFF’ler taranma çözünürlüğüne (DPI) göre boyutlanır.</p>
        ${actionButton("convert", "PDF’ye dönüştür", view)}
        ${privacyNote()}
      </aside>` : udf ? `<aside class="panel summary" aria-labelledby="preview-heading">
        <h2 id="preview-heading">UDF’den PDF’ye</h2>
        ${udfOutputSettings(active)}
        ${actionButton("udf", "PDF’ye dönüştür", active)}
        ${privacyNote()}
        ${udfBridgeBox(active)}
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

function thumbnailPicker(view, interactive, selected = []) {
  const count = Math.min(view.file.pages - view.thumbOffset, thumbnailSize);
  const thumbnails = Array.from({ length: count }, (_, index) => {
    const number = view.thumbOffset + index + 1;
    return `<button type="button" class="page-thumb" data-page="${number}"
      aria-label="${number}. sayfa" aria-pressed="${selected === null || selected.includes(number)}" ${interactive ? "" : "disabled"}>
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
    ${thumbnailPicker(view, view.mode === "extract")}` : "";
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

export function imageSelectionSummary({ count }, format) {
  if (!count) return { pages: "—", output: "—" };
  const imageFormat = format.toUpperCase();
  return { pages: `${count} sayfa`, output: count > 1 ? `${count} ${imageFormat} · ZIP` : imageFormat };
}

export function imageScreen(view) {
  const { file, mode, range, format, dpi, selection } = view;
  const summary = imageSelectionSummary(selection, format);
  const rangeError = mode === "range" && range.trim() ? selection.error : "";
  const source = uploadZone("image-input", file ? "Başka PDF seç" : "PDF seç", "Bir PDF dosyası seçin ya da buraya sürükleyin.", ".pdf,application/pdf");
  const pageControls = file ? `
    <div class="file-row row-top">${fileDetails(file)}</div>
    <div class="mode-options split-modes" role="group" aria-label="Sayfa seçimi">
      ${modeButton("image-pages", "all", "Tüm sayfalar", mode)}
      ${modeButton("image-pages", "range", "Sayfaları seç", mode)}
    </div>
    <label class="split-input field-label" ${mode === "all" ? "hidden" : ""}>Sayfa aralığı
      <input class="control" id="image-range" value="${e(range)}" placeholder="1-3, 6" aria-describedby="image-range-help image-range-error" ${rangeError ? 'aria-invalid="true"' : ""}>
      <span class="panel-lead" id="image-range-help">Aralık girin veya aşağıdan sayfaları seçin.</span>
      <span class="range-error" id="image-range-error" ${rangeError ? "" : "hidden"}>${e(rangeError ?? "")}</span>
    </label>
    ${thumbnailPicker(view, true, selection.pages)}` : "";
  return `${toolHeader("gorsel", "PDF sayfalarını PNG veya JPEG olarak kaydedin. Birden fazla sayfa ZIP olarak iner.")}
    <div class="workspace">
      <section class="panel" aria-labelledby="image-heading">
        <div class="panel-title">
          <div><h2 id="image-heading">Kaynak PDF</h2><p class="panel-lead">Bir PDF açıp tüm sayfaları veya küçük resimlerden istediğiniz sayfaları seçin.</p></div>
          ${file ? `<button type="button" class="text-button" data-clear ${view.loading || view.busy ? "disabled" : ""}>Dosyayı kaldır</button>` : ""}
        </div>
        ${progressOrFiles(view, source + pageControls)}
      </section>
      <aside class="panel summary" aria-labelledby="image-summary">
        <h2 id="image-summary">Görsel ayarları</h2>
        <fieldset class="input-area" ${view.loading || view.busy ? "disabled" : ""}>
          <label class="field-label">Görsel biçimi
            <select class="control" id="image-format">
              <option value="png" ${format === "png" ? "selected" : ""}>PNG</option>
              <option value="jpeg" ${format === "jpeg" ? "selected" : ""}>JPEG</option>
            </select>
          </label>
          <label class="field-label">Çözünürlük
            <select class="control" id="image-dpi">
              ${[72, 150, 300].map(value => `<option value="${value}" ${dpi === value ? "selected" : ""}>${value} DPI</option>`).join("")}
            </select>
          </label>
        </fieldset>
        <dl aria-live="polite">
          <div><dt>Seçilen sayfa</dt><dd id="image-pages">${summary.pages}</dd></div>
          <div><dt>Çıktı</dt><dd id="image-output">${summary.output}</dd></div>
        </dl>
        ${actionButton("image", "Görselleri hazırla", view, !selection.count)}
        ${privacyNote()}
      </aside>
    </div>${resultPanel(view.result, "görsel")}`;
}

function editCommand(command, label, disabled, glyph) {
  return `<button type="button" class="mode-button edit-command" data-edit-command="${command}" ${disabled ? "disabled" : ""}>
    ${glyph ? icon(glyph, 15) : ""}${label}</button>`;
}

function editPageTile({ pageNumber, rotation }, position, selected, locked) {
  const pageLabel = pageNumber === position ? `${position}. sayfa` : `${position}. sırada, kaynak sayfa ${pageNumber}`;
  const label = rotation ? `${pageLabel}, ${rotation} derece döndürüldü` : pageLabel;
  return `<li class="edit-page" data-edit-page="${pageNumber}">
    <button type="button" class="page-thumb edit-thumb" data-edit-select="${pageNumber}"
      aria-label="${label}" aria-pressed="${selected}">
      <span class="thumb-art">
        <canvas data-thumb="${pageNumber}" data-preview-rotation="${rotation}" aria-hidden="true" hidden></canvas>
        <span class="thumb-fallback">${icon("file", 23)}</span>
      </span>
      <span class="edit-page-caption"><strong>Sayfa ${position}</strong>${pageNumber !== position ? `<span>Kaynak ${pageNumber}</span>` : ""}</span>
      ${selected ? `<span class="edit-selected-mark">${icon("check", 14)}</span>` : ""}
    </button>
    <span class="edit-grip" draggable="${!locked}" title="Sıralamak için sürükleyin" aria-hidden="true">${icon("grip", 17)}</span>
  </li>`;
}

function editPages(view) {
  const { pages, selected, undo, redo, offset } = view;
  const count = selected.size;
  const canMove = direction => pages.some(({ pageNumber }, index) => {
    const neighbor = pages[index + direction];
    return selected.has(pageNumber) && neighbor && !selected.has(neighbor.pageNumber);
  });
  const total = Math.ceil(pages.length / thumbnailSize);
  return `<div class="file-row row-top">${fileDetails(view.file)}</div>
    <div class="edit-toolbar">
      <div class="edit-selection">
        <span role="status">${count ? `${count} sayfa seçili` : "Bir veya daha fazla sayfa seçin."}</span>
        <div class="edit-controls" role="group" aria-label="Sayfa seçimi">
          ${editCommand("select-all", "Tümünü seç", count === pages.length)}
          ${editCommand("clear-selection", "Seçimi kaldır", !count)}
        </div>
      </div>
      <div class="edit-controls" role="group" aria-label="Seçili sayfaları düzenle">
        ${editCommand("up", "Yukarı taşı", !canMove(-1), "up")}
        ${editCommand("down", "Aşağı taşı", !canMove(1), "down")}
        ${editCommand("rotate-left", "Sola döndür", !count)}
        ${editCommand("rotate-right", "Sağa döndür", !count)}
        ${editCommand("remove", "Seçilenleri sil", !count || count === pages.length)}
      </div>
      <div class="edit-controls" role="group" aria-label="Düzenleme geçmişi">
        ${editCommand("undo", "Geri al", !undo.length, "back")}
        ${editCommand("redo", "Yinele", !redo.length, "arrow")}
      </div>
      ${count === pages.length ? '<p class="panel-lead">Belgede en az bir sayfa kalmalıdır.</p>' : ""}
    </div>
    <ol class="edit-grid" role="list" aria-label="Çıktı sayfalarının sırası">
      ${pages.slice(offset, offset + thumbnailSize).map((page, index) =>
        editPageTile(page, offset + index + 1, selected.has(page.pageNumber), view.busy || view.loading)).join("")}
    </ol>
    ${total > 1 ? pagination(offset / thumbnailSize + 1, total, "edit-step", "sayfa grubu") : ""}`;
}

function editDocumentNote(file) {
  const notes = [
    file?.hasFormFields && "Form alanları çıktıda sayfanın parçası olur ve düzenlenebilirliğini kaybeder.",
    file?.hasOutlines && "Yer imleri kaynak belgede kalır.",
    file?.hasInternalLinks && "Sayfalar arası bağlantılar kaynak belgede kalır.",
  ].filter(Boolean);
  return notes.length ? `<p class="notice document-notice">${icon("info", 17)}<span>${notes.join(" ")}</span></p>` : "";
}

export function editScreen(view) {
  const file = view.file;
  const source = uploadZone("edit-input", file ? "Başka PDF seç" : "PDF seç", "Bir PDF dosyası seçin ya da buraya sürükleyin.", ".pdf,application/pdf");
  return `${toolHeader("sayfalar", "PDF sayfalarını sıralayın, döndürün veya çıkarın. Sonucu yeni bir PDF olarak indirin.")}
    <div class="workspace">
      <section class="panel" aria-labelledby="edit-heading">
        <div class="panel-title">
          <div>
            <h2 id="edit-heading">PDF sayfaları</h2>
            <p class="panel-lead">Sayfaları seçip yön düğmeleriyle veya sürükleyerek sıralayın.</p>
          </div>
          ${file ? `<button type="button" class="text-button" data-clear ${view.loading || view.busy ? "disabled" : ""}>Dosyayı kaldır</button>` : ""}
        </div>
        ${progressOrFiles(view, source + (file ? editPages(view) : ""))}
      </section>
      <aside class="panel summary" aria-labelledby="edit-summary">
        <h2 id="edit-summary">Düzenleme özeti</h2>
        <dl aria-live="polite">
          <div><dt>Kaynak belge</dt><dd>${file ? `${file.pages} sayfa` : "—"}</dd></div>
          <div><dt>Çıktı</dt><dd>${file ? `${view.pages.length} sayfa` : "—"}</dd></div>
        </dl>
        ${file?.hasDigitalSignature ? signatureNote() : ""}
        ${editDocumentNote(file)}
        ${actionButton("edit", "PDF’yi hazırla", view, !file || !view.changed)}
        ${privacyNote()}
      </aside>
    </div>${resultPanel(view.result)}`;
}

function resultPanel(result, archiveItem = "PDF") {
  if (!result) return "";
  const pdf = result.mimeType === "application/pdf";
  const image = { "image/png": "PNG", "image/jpeg": "JPEG" }[result.mimeType];
  const dimensions = Number.isFinite(result.width) && Number.isFinite(result.height) ? ` · ${result.width} × ${result.height} px` : "";
  const description = pdf ? `${result.pageCount} sayfa · PDF` : image ? `${image}${dimensions}` : `${result.fileCount} ${archiveItem} · ZIP`;
  const downloadLabel = pdf ? "PDF’yi indir" : image ? "Görseli indir" : "ZIP’i indir";
  return `<section class="panel result" id="result" aria-labelledby="result-title">
    <div class="result-header">
      <div class="result-heading">
        <span class="icon teal">${icon("check")}</span>
        <div><h2 id="result-title">Dosyanız hazır</h2><p class="panel-lead"><strong>${e(result.name)}</strong> · ${description}</p></div>
      </div>
      <a class="button" data-download href="${e(result.url)}" download="${e(result.name)}">${icon("download", 17)} ${downloadLabel}</a>
    </div>
    ${result.warnings?.map(message => `<p class="notice">${e(message)}</p>`).join("") ?? ""}
    ${pdf ? `<div class="preview-stage">
      <p class="preview-message" id="preview-message" role="status">Önizleme hazırlanıyor…</p>
      <canvas id="result-canvas" role="img" aria-label="Çıktı önizlemesi, sayfa ${result.page}" hidden></canvas>
    </div>
    ${result.pageCount > 1 ? pagination(result.page, result.pageCount, "preview-step", "sayfa") : ""}` : image ? `<div class="preview-stage">
      <img id="image-result" src="${e(result.url)}" alt="Dışa aktarılan PDF sayfası">
    </div>` : ""}
  </section>`;
}

export { thumbnailSize };
