# UDF reference tools

These tools run only on a developer computer. They are not part of the published site.

UYAP Editör lays out a UDF with Java Swing and exports the pages to PDF with iText. To match that output, PDF Brennt needs two things from a local UYAP Editör installation:

- **Reference PDFs.** `UdfRef.java` calls the PDF export of the installed `editor-app.jar` for each synthetic UDF in `test/udf/cases`. The results go to `test/udf/reference`.
- **Font metrics.** Swing measures text with the integer, hinted glyph advances of the Java runtime. `JavaMetrics.java` records them for Times New Roman and Arial. `build-metrics.mjs` turns them into `src/udf/java-metrics.json`.

UYAP Editör on Windows runs on the Java 8 runtime it finds (`jre1.8.0_*`), which uses the T2K rasterizer. Use the same runtime for both tools, because newer runtimes return different glyph advances and line heights.

```powershell
npm run udf:cases        # writes test/udf/cases/*.udf
npm run udf:references   # needs UYAP Editör and Java 8
npm run udf:metrics      # needs Java 8 and the Windows fonts
npm run udf:compare      # compares PDF Brennt output with the references
```

Set `UYAP_EDITOR_JAR` and `JAVA8_HOME` when the defaults (`C:\UYAP\Uyap Kelime Islemci\editor-app.jar`, `C:\Program Files\Java\jre1.8.0_*`) do not apply. All test documents are synthetic.
