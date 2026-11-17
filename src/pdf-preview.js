import { getDocument, GlobalWorkerOptions, PasswordException } from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

function assetUrl(directory) {
  return new URL(`${import.meta.env.BASE_URL}pdfjs/${directory}/`, document.baseURI).href;
}

export async function openPdfPreview(source) {
  const data = source instanceof Uint8Array ? source.slice() : new Uint8Array(await source.arrayBuffer());
  const task = getDocument({
    data,
    cMapUrl: assetUrl("cmaps"),
    iccUrl: assetUrl("iccs"),
    standardFontDataUrl: assetUrl("standard_fonts"),
    wasmUrl: assetUrl("wasm"),
  });
  let pdf;
  try {
    pdf = await task.promise;
  } catch (error) {
    await task.destroy().catch(() => {});
    const message = error instanceof PasswordException
      ? "Şifreli PDF için önizleme kullanılamıyor."
      : "PDF önizlemesi açılamadı.";
    throw new Error(message, { cause: error });
  }

  const renders = new WeakMap();
  let closePromise;
  return {
    pageCount: pdf.numPages,
    async renderPage(pageNumber, canvas, { maxWidth = 360, maxHeight = 480 } = {}) {
      if (closePromise) return false;
      const previous = renders.get(canvas);
      const current = {};
      renders.set(canvas, current);
      previous?.task?.cancel();

      try {
        const page = await pdf.getPage(pageNumber);
        await previous?.task?.promise.catch(() => {});
        if (closePromise || renders.get(canvas) !== current) return false;

        const original = page.getViewport({ scale: 1 });
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const scale = pixelRatio * Math.min(maxWidth / original.width, maxHeight / original.height);
        const viewport = page.getViewport({ scale });
        canvas.width = Math.max(1, Math.ceil(viewport.width));
        canvas.height = Math.max(1, Math.ceil(viewport.height));
        current.task = page.render({ canvas, viewport });
        await current.task.promise;
        return true;
      } catch (error) {
        if (closePromise || renders.get(canvas) !== current) return false;
        throw new Error("Sayfa önizlemesi oluşturulamadı.", { cause: error });
      } finally {
        if (renders.get(canvas) === current) renders.delete(canvas);
      }
    },
    close() {
      closePromise ??= task.destroy();
      return closePromise;
    },
  };
}
