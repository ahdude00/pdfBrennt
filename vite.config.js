import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  base: "./",
  // The TIFF decoder is only reached through a dynamic import in the worker. Pre-bundle it so the
  // dev server does not reload the page the first time a TIFF is opened.
  optimizeDeps: { include: ["utif"] },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: [
            "node_modules/pdfjs-dist/{cmaps,iccs,standard_fonts,wasm}/**/*",
            "node_modules/pdfjs-dist/LICENSE",
          ],
          dest: "pdfjs",
          rename: { stripBase: 2 },
        },
        {
          src: "node_modules/{fflate,pdf-lib,@pdf-lib/standard-fonts,@pdf-lib/upng,pako,tslib,utif}/LICENSE*",
          dest: "licenses",
          rename: { stripBase: 1 },
        },
      ],
    }),
  ],
});
