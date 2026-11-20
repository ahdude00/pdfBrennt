// Converts a UDF with the UYAP Editör installed on the user's computer, through the
// PDF Brennt köprüsü (bridge/PdfBrenntKopru.java) listening on the loopback address.
// Chrome asks the user for permission ("loopback-network") on the first request; the
// file goes only to this computer.

export const bridgePort = 47815;
export const bridgeFileSizeLimit = 16 * 1024 * 1024;
const bridgeOrigin = `http://127.0.0.1:${bridgePort}`;
export const bridgeDownloadUrl = `${import.meta.env.BASE_URL}kopru/pdfbrennt-kopru.jar`;

export class BridgeError extends Error {
  constructor(message, reason) {
    super(message);
    this.reason = reason;
  }
}

const unreachable = "UYAP köprüsüne bağlanılamadı. “Köprü hazır.” yazan pencere yoksa köprüyü İndirilenler klasöründen açın. UYAP’ın yeri sorulursa penceredeki adımları izleyin. Pencere açılmazsa “Köprü açılmıyorsa” bölümüne bakın. Köprü hazırsa sitede yeniden deneyin. Tarayıcı sorarsa “İzin ver”i seçin. Sorun sürerse “Erişim engellendiyse” bölümüne bakın.";
const denied = "Köprüye erişim engellenmiş görünüyor. Adres çubuğunun solundaki site simgesine tıklayın. Site ayarlarında bu bilgisayardaki uygulamalara veya yerel ağa erişime izin verin. Sayfayı yenileyin, belgeyi yeniden seçin ve “UYAP köprüsüyle dönüştür”e tıklayın.";
const conversionFailed = "UYAP Doküman Editörü bu belgeyi PDF’ye dönüştüremedi. Belgeyi UYAP Doküman Editörü’nde açmayı deneyin. Açılırsa editörde PDF olarak kaydedin. Açılmazsa belge büyük olasılıkla UYAP dışında bir programla hazırlanmıştır; belgeyi hazırlayan programla yeniden oluşturmayı deneyin.";
// The editor opens the document but the bridge could not run its PDF export: the cause
// is the bridge's setup on this computer, not the document.
const conversionFailedWithDetail = detail => `UYAP Doküman Editörü bu belgeyi köprüde PDF’ye dönüştüremedi. Köprünün bildirdiği hata: ${detail} Belgeyi UYAP Doküman Editörü’nde açabiliyorsanız sorun büyük olasılıkla belgede değil, köprünün bu bilgisayardaki UYAP sürümüyle çalışmasındadır. Köprü penceresinde yazan hata dosyasını (pdfbrennt-kopru-hata.txt) geliştiriciye gönderebilirsiniz. Bu sırada belgeyi editörde açıp PDF olarak kaydedebilirsiniz.`;

async function permissionState() {
  // Only "loopback-network" is queried: older Chrome versions crash on other names.
  try {
    return (await navigator.permissions?.query({ name: "loopback-network" }))?.state ?? "unknown";
  } catch {
    return "unknown";
  }
}

async function request(path, init = {}) {
  try {
    return await fetch(`${bridgeOrigin}${path}`, { ...init, mode: "cors", cache: "no-store", credentials: "omit", targetAddressSpace: "loopback" });
  } catch {
    // Permission state is a hint after a failed request, never a condition for sending it.
    const message = (await permissionState()) === "denied" ? denied : unreachable;
    throw new BridgeError(message, "unreachable");
  }
}

async function conversionFailure(response) {
  const { status } = response;
  if (status === 413) return new BridgeError("Bu belge 16 MB sınırını aşıyor. Daha küçük bir UDF dosyası seçip yeniden deneyin.", "failed");
  if (status === 400) return new BridgeError("Bu dosya UYAP belgesi olarak okunamadı. Belgeyi UYAP Doküman Editörü’nde açmayı deneyin. Açılmazsa belgenin yeni bir kopyasını edinin.", "failed");
  const detail = (await response.text().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 400);
  if (!detail) return new BridgeError(conversionFailed, "failed");
  return new BridgeError(conversionFailedWithDetail(/[.…]$/.test(detail) ? detail : `${detail}.`), "failed");
}

// Must run from a user action: Chrome shows its permission prompt for this request.
export async function bridgeUdfToPdf(file) {
  const status = await request("/status");
  if (!status.ok) throw new BridgeError(unreachable, "unreachable");
  const info = await status.json().catch(() => null);
  if (info?.app !== "pdfbrennt-kopru") throw new BridgeError(unreachable, "unreachable");
  const body = await file.arrayBuffer().catch(() => {
    throw new BridgeError("Belge okunamadı. Belgeyi sitede yeniden seçip dönüştürmeyi deneyin.", "failed");
  });
  const response = await request("/udf-to-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body,
  });
  if (!response.ok) throw await conversionFailure(response);
  const buffer = await response.arrayBuffer().catch(() => {
    throw new BridgeError("PDF alınamadı. Köprü penceresini açık tutun ve sitede yeniden deneyin.", "failed");
  });
  const bytes = new Uint8Array(buffer);
  if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") throw new BridgeError(conversionFailed, "failed");
  return bytes;
}
