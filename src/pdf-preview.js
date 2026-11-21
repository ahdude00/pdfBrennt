import { getDocument, GlobalWorkerOptions, PasswordException } from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

function assetUrl(directory) {
  return new URL(`${import.meta.env.BASE_URL}pdfjs/${directory}/`, document.baseURI).href;
}

export async function openPdfDocument(source, { stopAtErrors = false } = {}) {
  const data = source instanceof Uint8Array ? source.slice() : new Uint8Array(await source.arrayBuffer());
  const task = getDocument({
    data,
    cMapUrl: assetUrl("cmaps"),
    iccUrl: assetUrl("iccs"),
    standardFontDataUrl: assetUrl("standard_fonts"),
    wasmUrl: assetUrl("wasm"),
    stopAtErrors,
  });
  try {
    return { pdf: await task.promise, close: () => task.destroy() };
  } catch (error) {
    await task.destroy().catch(() => {});
    const message = error instanceof PasswordException
      ? "Şifreli PDF açılamadı. Önce PDF’nin kilidini açın."
      : "PDF açılamadı. Geçerli ve okunabilir bir PDF seçin.";
    throw new Error(message, { cause: error });
  }
}

export async function openPdfPreview(source) {
  const { pdf, close } = await openPdfDocument(source);
  const renders = new WeakMap();
  let closePromise;
  return {
    pageCount: pdf.numPages,
    async renderPage(pageNumber, canvas, { maxWidth = 360, maxHeight = 480, rotationDelta = 0, signal } = {}) {
      if (closePromise || signal?.aborted) return false;
      const previous = renders.get(canvas);
      const current = {};
      renders.set(canvas, current);
      previous?.task?.cancel();
      const cancel = () => current.task?.cancel();
      signal?.addEventListener("abort", cancel, { once: true });

      try {
        const page = await pdf.getPage(pageNumber);
        await previous?.task?.promise.catch(() => {});
        if (closePromise || signal?.aborted || renders.get(canvas) !== current) return false;

        const rotation = (page.rotate + rotationDelta + 360) % 360;
        const original = page.getViewport({ scale: 1, rotation });
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const scale = pixelRatio * Math.min(maxWidth / original.width, maxHeight / original.height);
        const viewport = page.getViewport({ scale, rotation });
        canvas.width = Math.max(1, Math.ceil(viewport.width));
        canvas.height = Math.max(1, Math.ceil(viewport.height));
        current.task = page.render({ canvas, viewport });
        await current.task.promise;
        return true;
      } catch (error) {
        if (closePromise || signal?.aborted || renders.get(canvas) !== current) return false;
        throw new Error("Sayfa önizlemesi oluşturulamadı.", { cause: error });
      } finally {
        signal?.removeEventListener("abort", cancel);
        if (renders.get(canvas) === current) renders.delete(canvas);
      }
    },
    close() {
      closePromise ??= close();
      return closePromise;
    },
  };
}
