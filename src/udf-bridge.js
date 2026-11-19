// Converts a UDF with the UYAP Editör installed on the user's computer, through the
// PDF Brennt köprüsü (bridge/PdfBrenntKopru.java) listening on the loopback address.
// Chrome asks the user for permission ("loopback-network") on the first request; the
// file goes only to this computer.

export const bridgePort = 47815;
const bridgeOrigin = `http://127.0.0.1:${bridgePort}`;
export const bridgeDownloadUrl = `${import.meta.env.BASE_URL}kopru/pdfbrennt-kopru.jar`;

export class BridgeError extends Error {
  constructor(message, reason) {
    super(message);
    this.reason = reason;
  }
}

const unreachable = "UYAP köprüsüne ulaşılamadı. Köprünün açık olduğundan emin olun, tarayıcı izin isterse “İzin ver”i seçin ve yeniden deneyin.";
const denied = " Bu sitenin cihazdaki uygulamalara erişimi engellenmiş görünüyor; adres çubuğundaki site ayarlarından bu izni açabilirsiniz.";

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
    // A failed request does not say whether the bridge is closed or the permission was
    // refused, so the permission state is only added as a hint.
    throw new BridgeError(unreachable + ((await permissionState()) === "denied" ? denied : ""), "unreachable");
  }
}

async function failure(response) {
  const text = (await response.text().catch(() => "")).trim();
  return new BridgeError(text.length && text.length < 400 ? text : "UYAP köprüsü dönüşümü tamamlayamadı.", "failed");
}

// Must run from a user action: Chrome shows its permission prompt for this request.
export async function bridgeUdfToPdf(file) {
  const status = await request("/status");
  if (!status.ok) throw await failure(status);
  const info = await status.json().catch(() => null);
  if (info?.app !== "pdfbrennt-kopru") throw new BridgeError(unreachable, "unreachable");
  const response = await request("/udf-to-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: await file.arrayBuffer(),
  });
  if (!response.ok) throw await failure(response);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") throw new BridgeError("UYAP köprüsü PDF döndürmedi.", "failed");
  return bytes;
}
