let worker;
let nextId = 0;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./pdf-worker.js", import.meta.url), { type: "module" });
  worker.addEventListener("message", ({ data: { id, result, error } }) => {
    const request = pending.get(id);
    if (!request) return;
    pending.delete(id);
    if (error) request.reject(new Error(error));
    else request.resolve(result);
  });
  worker.addEventListener("error", () => {
    for (const { reject } of pending.values()) {
      reject(new Error("İşlem başlatılamadı. Sayfayı yenileyip yeniden deneyin."));
    }
    pending.clear();
    worker.terminate();
    worker = null;
  });
  return worker;
}

export function runPdfOperation(operation, ...args) {
  return new Promise((resolve, reject) => {
    const processor = getWorker();
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    try {
      processor.postMessage({ id, operation, args });
    } catch (error) {
      pending.delete(id);
      reject(error);
    }
  });
}
