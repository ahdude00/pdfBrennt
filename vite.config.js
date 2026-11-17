import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  base: "./",
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
          src: "node_modules/{fflate,pdf-lib,@pdf-lib/standard-fonts,@pdf-lib/upng,pako,tslib}/LICENSE*",
          dest: "licenses",
          rename: { stripBase: 1 },
        },
      ],
    }),
  ],
});
