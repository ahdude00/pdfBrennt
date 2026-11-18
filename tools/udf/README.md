# UDF reference tools

These tools check the UDF converter against UYAP Editör. Only `compare.mjs` runs in CI; the others need a Windows computer with UYAP Editör installed. Nothing here is part of the published site.

UYAP Editör lays out a UDF with Java Swing and exports the pages to PDF with iText. `UdfRef.java` calls that PDF export in the installed `editor-app.jar`, so every reference PDF is UYAP Editör's own output. The exporter is the one UYAP's own tray converter uses.

UYAP Editör runs on the Java 8 runtime it finds (`jre1.8.0_*`, T2K rasterizer). Use the same runtime for the tools: newer runtimes report different line metrics.

| Command | What it does |
| --- | --- |
| `npm run udf:cases` | Writes the synthetic test documents in `tools/udf/cases.mjs` to `test/udf/cases`. |
| `npm run udf:references` | Exports each test document with UYAP Editör to `test/udf/reference`. |
| `npm run udf:metrics` | Records the Java 8 ascent, descent and leading of Times New Roman and Arial in `src/udf/java-metrics.js`. |
| `npm run udf:rows` | Checks the row model in `src/udf/metrics.js` for every family, face and size against UYAP Editör. |
| `npm run udf:compare` | Converts every test document with PDF Brennt and compares page sizes, words, images, strokes and filled shapes with the references. |

`probe.mjs` and `probe-set.mjs` render ad-hoc documents through UYAP Editör and print what it drew; that is how the layout rules in `src/udf/layout.js` were measured. `dump.mjs` prints the positioned content of any PDF.

Set `UYAP_EDITOR_JAR`, `JAVA8_HOME` or `JAVA_HOME` (for `javac`) when the defaults (`C:/UYAP/Uyap Kelime Islemci/editor-app.jar`, `C:/Program Files/Java`) do not apply. All test documents are synthetic. Do not add real case files.
