import java.io.*;
import java.lang.reflect.Method;
import java.nio.file.*;

public class UdfRef {
  public static void main(String[] args) throws Exception {
    Class<?> exporter = Class.forName("tr.com.havelsan.uyap.system.editor.b.b");
    Object instance = exporter.getConstructor().newInstance();
    Method export = exporter.getMethod("a", OutputStream.class, ByteArrayInputStream.class);
    int failures = 0;
    for (int i = 0; i + 1 < args.length; i += 2) {
      byte[] input = Files.readAllBytes(Paths.get(args[i]));
      ByteArrayOutputStream out = new ByteArrayOutputStream();
      try {
        export.invoke(instance, out, new ByteArrayInputStream(input));
        Files.write(Paths.get(args[i + 1]), out.toByteArray());
        System.out.println("OK " + args[i] + " -> " + args[i + 1] + " (" + out.size() + " bytes)");
      } catch (Throwable error) {
        failures++;
        Throwable cause = error.getCause() != null ? error.getCause() : error;
        System.out.println("FAIL " + args[i] + ": " + cause);
        cause.printStackTrace(System.out);
      }
    }
    System.exit(failures == 0 ? 0 : 1);
  }
}
