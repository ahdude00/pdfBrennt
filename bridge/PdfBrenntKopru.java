import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.awt.BorderLayout;
import java.awt.FlowLayout;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.BindException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Properties;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JFileChooser;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.SwingUtilities;
import javax.swing.WindowConstants;
import javax.swing.filechooser.FileNameExtensionFilter;

/**
 * PDF Brennt köprüsü: converts UDF files with the UYAP Editör installed on this computer.
 *
 * It listens only on the loopback address and answers only the PDF Brennt site, so the
 * document never leaves the computer. UYAP Editör itself is not part of this program;
 * it is loaded from the user's own installation and called through its public
 * TrayUtils.udfToPdf method.
 */
public final class PdfBrenntKopru {
  static final String VERSION = "1";
  static final int DEFAULT_PORT = 47815;
  static final int MAX_BYTES = 16 * 1024 * 1024;
  static final long TIMEOUT_SECONDS = 120;
  static final String TRAY_CLASS = "tr.com.havelsan.uyap.system.editor.utils.tray.TrayUtils";
  static final String JAR_NAME = "editor-app.jar";
  static final File SETTINGS = new File(System.getProperty("user.home"), ".pdfbrennt-kopru.properties");

  static final Set<String> origins = new LinkedHashSet<String>(Arrays.asList(
      "https://ahdude00.github.io",
      "http://localhost:5173", "http://127.0.0.1:5173",
      "http://localhost:4173", "http://127.0.0.1:4173"));

  static int port = DEFAULT_PORT;
  static boolean console;
  static File editorJar;
  static Object tray;
  static Method udfToPdf;
  static ClassLoader uyapLoader;
  static final AtomicInteger converted = new AtomicInteger();
  static final ExecutorService worker = Executors.newSingleThreadExecutor(runnable -> {
    Thread thread = new Thread(runnable, "uyap-donusum");
    thread.setDaemon(true);
    return thread;
  });
  static JLabel countLabel;

  public static void main(String[] args) throws Exception {
    // UYAP Editör starts its JVM with these settings; they affect text measurement.
    System.setProperty("sun.java2d.dpiaware", "false");
    System.setProperty("sun.java2d.uiScale", "1");
    String jarArgument = System.getenv("UYAP_EDITOR_JAR");
    for (int index = 0; index < args.length; index++) {
      String arg = args[index];
      if ("--console".equals(arg)) console = true;
      else if ("--jar".equals(arg) && index + 1 < args.length) jarArgument = args[++index];
      else if ("--port".equals(arg) && index + 1 < args.length) port = Integer.parseInt(args[++index]);
      else if ("--origin".equals(arg) && index + 1 < args.length) origins.add(args[++index]);
      else {
        System.err.println("Kullanım: java -jar pdfbrennt-kopru.jar [--jar editor-app.jar] [--port " + DEFAULT_PORT + "] [--origin URL] [--console]");
        System.exit(2);
      }
    }
    final String jar = jarArgument;
    if (console) start(jar);
    else SwingUtilities.invokeLater(() -> {
      try {
        start(jar);
      } catch (Exception error) {
        fatal(error.getMessage());
      }
    });
  }

  static void start(String jarArgument) throws Exception {
    editorJar = locateJar(jarArgument);
    if (editorJar == null && !console) editorJar = chooseJar();
    if (editorJar == null) {
      fatal("UYAP Editör bulunamadı. editor-app.jar dosyasının yerini --jar ile belirtin.");
      return;
    }
    loadUyap(editorJar);
    HttpServer server;
    try {
      server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), port), 16);
    } catch (BindException error) {
      fatal("Köprü zaten çalışıyor olabilir: " + port + " numaralı bağlantı noktası kullanımda.");
      return;
    }
    server.createContext("/", PdfBrenntKopru::handle);
    server.setExecutor(Executors.newFixedThreadPool(2));
    server.start();
    remember(editorJar);
    String message = "PDF Brennt köprüsü çalışıyor: http://127.0.0.1:" + port + "  UYAP Editör: " + editorJar;
    if (console) System.out.println(message);
    else showWindow();
  }

  // ---- UYAP Editör ----------------------------------------------------------------

  static File locateJar(String argument) {
    List<File> candidates = new ArrayList<File>();
    if (argument != null && !argument.trim().isEmpty()) candidates.add(new File(argument.trim()));
    String saved = savedJar();
    if (saved != null) candidates.add(new File(saved));
    candidates.add(new File("C:\\UYAP\\Uyap Kelime Islemci\\" + JAR_NAME));
    for (File candidate : candidates) if (candidate.isFile()) return candidate;
    List<File> roots = new ArrayList<File>();
    for (String variable : new String[] {"ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"}) {
      String value = System.getenv(variable);
      if (value != null) roots.add(new File(value));
    }
    for (File drive : File.listRoots()) roots.add(drive);
    roots.add(new File("/Applications"));
    roots.add(new File("/opt"));
    roots.add(new File(System.getProperty("user.home")));
    for (File root : roots) {
      File[] children = root.listFiles();
      if (children == null) continue;
      for (File child : children) {
        if (!child.isDirectory() || !child.getName().toLowerCase(Locale.ROOT).contains("uyap")) continue;
        File found = search(child, 4);
        if (found != null) return found;
      }
    }
    return null;
  }

  static File search(File directory, int depth) {
    File direct = new File(directory, JAR_NAME);
    if (direct.isFile()) return direct;
    if (depth == 0) return null;
    File[] children = directory.listFiles();
    if (children == null) return null;
    for (File child : children) {
      if (!child.isDirectory()) continue;
      File found = search(child, depth - 1);
      if (found != null) return found;
    }
    return null;
  }

  static File chooseJar() {
    JOptionPane.showMessageDialog(null, "UYAP Editör otomatik bulunamadı.\nUYAP Editör klasöründeki editor-app.jar dosyasını seçin.",
        "PDF Brennt köprüsü", JOptionPane.INFORMATION_MESSAGE);
    JFileChooser chooser = new JFileChooser();
    chooser.setDialogTitle("editor-app.jar dosyasını seçin");
    chooser.setFileFilter(new FileNameExtensionFilter("Java arşivi (*.jar)", "jar"));
    return chooser.showOpenDialog(null) == JFileChooser.APPROVE_OPTION ? chooser.getSelectedFile() : null;
  }

  static String savedJar() {
    Properties properties = new Properties();
    try (InputStream input = new FileInputStream(SETTINGS)) {
      properties.load(input);
      return properties.getProperty("editorJar");
    } catch (IOException error) {
      return null;
    }
  }

  static void remember(File jar) {
    Properties properties = new Properties();
    properties.setProperty("editorJar", jar.getAbsolutePath());
    try (OutputStream output = new FileOutputStream(SETTINGS)) {
      properties.store(output, "PDF Brennt köprüsü");
    } catch (IOException ignored) {
      // Remembering the location is only a convenience.
    }
  }

  static void loadUyap(File jar) throws Exception {
    uyapLoader = new URLClassLoader(new URL[] {jar.toURI().toURL()}, PdfBrenntKopru.class.getClassLoader());
    Thread.currentThread().setContextClassLoader(uyapLoader);
    Class<?> type;
    try {
      type = Class.forName(TRAY_CLASS, true, uyapLoader);
    } catch (ClassNotFoundException error) {
      throw new Exception("Seçilen dosya UYAP Editör değil ya da bu sürüm desteklenmiyor: " + jar);
    }
    tray = type.getMethod("getInstance").invoke(null);
    udfToPdf = type.getMethod("udfToPdf", OutputStream.class, ByteArrayInputStream.class);
  }

  static byte[] convert(final byte[] udf) throws Exception {
    Future<byte[]> task = worker.submit(() -> {
      Thread.currentThread().setContextClassLoader(uyapLoader);
      ByteArrayOutputStream output = new ByteArrayOutputStream();
      try {
        udfToPdf.invoke(tray, output, new ByteArrayInputStream(udf));
      } catch (InvocationTargetException error) {
        throw error.getCause() instanceof Exception ? (Exception) error.getCause() : error;
      }
      return output.toByteArray();
    });
    try {
      return task.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
    } catch (TimeoutException error) {
      task.cancel(true);
      throw new Exception("UYAP Editör dönüşümü " + TIMEOUT_SECONDS + " saniyede bitiremedi.");
    }
  }

  // ---- HTTP -------------------------------------------------------------------------

  static void handle(HttpExchange exchange) throws IOException {
    try {
      String host = exchange.getRequestHeaders().getFirst("Host");
      String origin = exchange.getRequestHeaders().getFirst("Origin");
      // Only the PDF Brennt site may use the bridge, and only through the loopback name,
      // which also defeats DNS rebinding.
      if (host == null || !(host.equals("127.0.0.1:" + port) || host.equals("localhost:" + port))) {
        send(exchange, 403, "text/plain", "Geçersiz adres.");
        return;
      }
      if (origin == null || !origins.contains(origin)) {
        send(exchange, 403, "text/plain", "Bu köprü yalnızca PDF Brennt sitesinden kullanılabilir.");
        return;
      }
      exchange.getResponseHeaders().set("Access-Control-Allow-Origin", origin);
      exchange.getResponseHeaders().set("Vary", "Origin");
      exchange.getResponseHeaders().set("Cache-Control", "no-store");
      String method = exchange.getRequestMethod();
      String path = exchange.getRequestURI().getPath();
      if ("OPTIONS".equals(method)) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
        exchange.getResponseHeaders().set("Access-Control-Max-Age", "600");
        exchange.sendResponseHeaders(204, -1);
        return;
      }
      if ("GET".equals(method) && "/status".equals(path)) {
        send(exchange, 200, "application/json", "{\"app\":\"pdfbrennt-kopru\",\"version\":" + VERSION + ",\"uyap\":true}");
        return;
      }
      if ("POST".equals(method) && "/udf-to-pdf".equals(path)) {
        byte[] udf = readBody(exchange.getRequestBody());
        if (udf == null) {
          send(exchange, 413, "text/plain", "16 MB veya daha küçük bir UDF seçin.");
          return;
        }
        if (udf.length < 4 || udf[0] != 'P' || udf[1] != 'K' || udf[2] != 3 || udf[3] != 4) {
          send(exchange, 400, "text/plain", "Dosya bir UDF paketi değil.");
          return;
        }
        byte[] pdf;
        try {
          pdf = convert(udf);
        } catch (Exception error) {
          String detail = error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage();
          send(exchange, 500, "text/plain", "UYAP Editör bu belgeyi dönüştüremedi: " + detail);
          return;
        }
        if (pdf.length < 5 || pdf[0] != '%' || pdf[1] != 'P' || pdf[2] != 'D' || pdf[3] != 'F') {
          send(exchange, 500, "text/plain", "UYAP Editör PDF üretmedi.");
          return;
        }
        exchange.getResponseHeaders().set("Content-Type", "application/pdf");
        exchange.sendResponseHeaders(200, pdf.length);
        try (OutputStream output = exchange.getResponseBody()) {
          output.write(pdf);
        }
        int count = converted.incrementAndGet();
        if (countLabel != null) SwingUtilities.invokeLater(() -> countLabel.setText("Dönüştürülen belge: " + count));
        return;
      }
      send(exchange, 404, "text/plain", "Bulunamadı.");
    } finally {
      exchange.close();
    }
  }

  static byte[] readBody(InputStream input) throws IOException {
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    byte[] buffer = new byte[65536];
    int read;
    while ((read = input.read(buffer)) > 0) {
      output.write(buffer, 0, read);
      if (output.size() > MAX_BYTES) return null;
    }
    return output.toByteArray();
  }

  static void send(HttpExchange exchange, int status, String type, String text) throws IOException {
    byte[] body = text.getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().set("Content-Type", type + "; charset=utf-8");
    exchange.sendResponseHeaders(status, body.length);
    try (OutputStream output = exchange.getResponseBody()) {
      output.write(body);
    }
  }

  // ---- Window -----------------------------------------------------------------------

  static void showWindow() {
    JFrame frame = new JFrame("PDF Brennt köprüsü");
    frame.setDefaultCloseOperation(WindowConstants.EXIT_ON_CLOSE);
    JPanel content = new JPanel(new BorderLayout(0, 8));
    content.setBorder(BorderFactory.createEmptyBorder(14, 16, 14, 16));
    content.add(new JLabel("<html><b>Köprü çalışıyor.</b><br>PDF Brennt sitesi UDF dosyalarını bu bilgisayardaki UYAP Editör ile dönüştürebilir."
        + "<br>Dosyalar bilgisayarınızdan çıkmaz. Kapatınca köprü durur.<br><br>UYAP Editör: " + escape(editorJar.getAbsolutePath()) + "</html>"), BorderLayout.CENTER);
    JPanel bottom = new JPanel(new FlowLayout(FlowLayout.RIGHT, 0, 0));
    countLabel = new JLabel("Dönüştürülen belge: 0");
    countLabel.setBorder(BorderFactory.createEmptyBorder(0, 0, 0, 12));
    JButton stop = new JButton("Köprüyü kapat");
    stop.addActionListener(event -> System.exit(0));
    bottom.add(countLabel);
    bottom.add(stop);
    content.add(bottom, BorderLayout.SOUTH);
    frame.setContentPane(content);
    frame.pack();
    frame.setLocationRelativeTo(null);
    frame.setVisible(true);
  }

  static String escape(String text) {
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
  }

  static void fatal(String message) {
    if (console) {
      System.err.println(message);
      System.exit(1);
    }
    JOptionPane.showMessageDialog(null, message, "PDF Brennt köprüsü", JOptionPane.ERROR_MESSAGE);
    System.exit(1);
  }
}
