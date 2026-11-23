import { editPdf, inspectPdf, inspectTiff, mergePdfs, splitPdf, imagesToPdf } from "./pdf-engine.js";

const operations = { editPdf, inspectPdf, inspectTiff, mergePdfs, splitPdf, imagesToPdf };
let queue = Promise.resolve();

self.addEventListener("message", ({ data: { id, operation, args } }) => {
  queue = queue.then(async () => {
    try {
      const result = await operations[operation](...args);
      const transfer = result.bytes ? [result.bytes.buffer] : [];
      self.postMessage({ id, result }, transfer);
    } catch (error) {
      self.postMessage({ id, error: error?.message || "PDF işlemi tamamlanamadı." });
    }
  });
});
