import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.awt.BorderLayout;
import java.awt.Desktop;
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
import java.net.InetSocketAddress;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Enumeration;
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
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import javax.swing.BorderFactory;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JFileChooser;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JTextField;
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
  static final String TRAY_ENTRY = TRAY_CLASS.replace('.', '/') + ".class";
  // The usual name of the jar that holds TrayUtils. Some installations name it
  // differently, so the bridge finds the jar by its content and this name only goes first.
  static final String JAR_NAME = "editor-app.jar";
  static final String WINDOWS_EDITOR_DIR = "C:\\UYAP\\Uyap Kelime Islemci";
  // The product code of UYAP Kelime İşlemci's installer, the key of its uninstall entry.
  static final String PRODUCT_CODE = "6E100DF3-EFB2-449A-9334-1B9CAB8CBCBF";
  static final String WINDOW_TITLE = "PDF Brennt köprüsü";
  static final File SETTINGS = new File(System.getProperty("user.home"), ".pdfbrennt-kopru.properties");

  static final Set<String> origins = new LinkedHashSet<String>(Arrays.asList(
      "https://ahdude00.github.io",
      "http://localhost:5173", "http://127.0.0.1:5173",
      "http://localhost:4173", "http://127.0.0.1:4173"));

  static int port = DEFAULT_PORT;
  static boolean console;
  static String trayClass = TRAY_CLASS;
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
  // The folders the bridge looked in, shown when UYAP Editör is not found.
  static final Set<String> searched = new LinkedHashSet<String>();

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
        System.err.println("Kullanım: java -jar pdfbrennt-kopru.jar [--jar editor-app.jar|UYAP-klasörü] [--port " + DEFAULT_PORT + "] [--origin URL] [--console]");
        System.exit(2);
      }
    }
    final String jar = jarArgument;
    if (console) start(jar);
    else SwingUtilities.invokeLater(() -> {
      try {
        start(jar);
      } catch (Exception error) {
        error.printStackTrace();
        fatal("Köprü açılamadı.\nUYAP Doküman Editörü'nü açıp çalıştığını kontrol edin.\nSonra köprüyü yeniden açın.");
      }
    });
  }

  static void start(String jarArgument) throws Exception {
    File editorJar = locateJar(jarArgument);
    if (console) {
      if (editorJar == null) {
        fatal("UYAP Editör bulunamadı. UYAP klasörünü ya da editor-app.jar dosyasının yerini --jar ile belirtin.");
        return;
      }
      loadUyap(editorJar);
    } else {
      editorJar = prepareEditor(editorJar);
      if (editorJar == null) {
        System.exit(0);
        return;
      }
    }
    HttpServer server;
    try {
      server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 16);
    } catch (BindException error) {
      fatal(console ? "Köprü zaten çalışıyor olabilir: " + port + " numaralı bağlantı noktası kullanımda."
          : "Köprü zaten açık olabilir.\nGörev çubuğunda “PDF Brennt köprüsü” penceresini arayın.\n"
              + "Pencereyi bulursanız onu kullanın. Bulamazsanız bilgisayarı yeniden başlatıp köprüyü açın.");
      return;
    }
    server.createContext("/", PdfBrenntKopru::handle);
    server.setExecutor(Executors.newFixedThreadPool(2));
    server.start();
    remember(editorJar);
    String message = "PDF Brennt köprüsü çalışıyor: http://127.0.0.1:" + port + "  UYAP Editör: " + editorJar;
    if (console) System.out.println(message);
    else showWindow(folderOf(editorJar));
  }

  static File folderOf(File jar) {
    File folder = jar.getAbsoluteFile().getParentFile();
    return folder == null ? jar.getAbsoluteFile() : folder;
  }

  // ---- UYAP Editör ----------------------------------------------------------------

  static File locateJar(String argument) {
    List<File> candidates = new ArrayList<File>();
    if (argument != null && !argument.trim().isEmpty()) candidates.add(new File(argument.trim()));
    String saved = savedJar();
    if (saved != null) candidates.add(new File(saved));
    candidates.addAll(installedFolders());
    candidates.add(new File(WINDOWS_EDITOR_DIR));
    for (File candidate : candidates) {
      searched.add((candidate.isDirectory() ? candidate : folderOf(candidate)).getPath());
      File found = editorIn(candidate, 3);
      if (found != null) return found;
    }
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
        File found = editorIn(child, 4);
        if (found != null) return found;
      }
    }
    return null;
  }

  // The jar in this place that holds UYAP Editör's converter. A jar without it stands
  // for its folder, so choosing any jar of the installation is enough.
  static File editorIn(File place, int depth) {
    if (place.isFile()) {
      if (trayClassIn(place) != null) return place;
      place = folderOf(place);
    }
    File[] children = place.listFiles();
    if (children == null) return null;
    Arrays.sort(children);
    File usual = new File(place, JAR_NAME);
    if (trayClassIn(usual) != null) return usual;
    for (File child : children) if (trayClassIn(child) != null) return child;
    if (depth == 0) return null;
    for (File child : children) {
      if (!child.isDirectory() || isJavaRuntime(child)) continue;
      File found = editorIn(child, depth - 1);
      if (found != null) return found;
    }
    return null;
  }

  // The name of UYAP Editör's TrayUtils class if this jar holds it. Versions that moved
  // the class keep its name and an "uyap" package.
  static String trayClassIn(File jar) {
    if (!jar.isFile() || !jar.getName().toLowerCase(Locale.ROOT).endsWith(".jar")) return null;
    try (ZipFile zip = new ZipFile(jar)) {
      if (zip.getEntry(TRAY_ENTRY) != null) return TRAY_CLASS;
      Enumeration<? extends ZipEntry> entries = zip.entries();
      while (entries.hasMoreElements()) {
        String name = entries.nextElement().getName();
        if (name.endsWith("/TrayUtils.class") && name.toLowerCase(Locale.ROOT).contains("uyap")) {
          return name.substring(0, name.length() - ".class".length()).replace('/', '.');
        }
      }
    } catch (IOException | RuntimeException error) {
      // Not a readable jar.
    }
    return null;
  }

  static boolean isJavaRuntime(File folder) {
    String name = folder.getName().toLowerCase(Locale.ROOT);
    return name.startsWith("jre") || name.startsWith("jdk") || name.equals("runtime") || name.equals("java");
  }

  // UYAP Editör's jar and the libraries next to it. Some installations keep the libraries
  // as separate jars that the jar's manifest does not list, so every jar of the folder
  // (and of a lib folder beside it) is put after the editor's own jar.
  static URL[] classPath(File jar) throws IOException {
    Set<File> jars = new LinkedHashSet<File>();
    jars.add(jar.getAbsoluteFile());
    File folder = folderOf(jar);
    collectJars(folder, 2, jars);
    String name = folder.getName().toLowerCase(Locale.ROOT);
    if (folder.getParentFile() != null && (name.equals("lib") || name.equals("libs") || name.equals("app"))) {
      collectJars(folder.getParentFile(), 2, jars);
    }
    List<URL> urls = new ArrayList<URL>();
    for (File file : jars) urls.add(file.toURI().toURL());
    return urls.toArray(new URL[0]);
  }

  static void collectJars(File folder, int depth, Set<File> jars) {
    File[] children = folder.listFiles();
    if (children == null) return;
    Arrays.sort(children);
    for (File child : children) {
      String name = child.getName().toLowerCase(Locale.ROOT);
      if (child.isFile() && name.endsWith(".jar") && !name.startsWith("pdfbrennt-kopru")) jars.add(child.getAbsoluteFile());
    }
    if (depth == 0) return;
    for (File child : children) if (child.isDirectory() && !isJavaRuntime(child)) collectJars(child, depth - 1, jars);
  }

  // Lists the jars of an installation the bridge cannot use, with their manifests and the
  // class names that may hold a PDF export, so support for that version can be added.
  // It holds no document content.
  static File writeReport(File place) {
    File folder = place.isDirectory() ? place : folderOf(place);
    Set<File> jars = new LinkedHashSet<File>();
    collectJars(folder, 2, jars);
    StringBuilder text = new StringBuilder("PDF Brennt köprüsü " + VERSION + " tanı raporu\n");
    text.append("Java: ").append(System.getProperty("java.version")).append(' ').append(System.getProperty("java.vendor"))
        .append(" (").append(System.getProperty("os.arch")).append(")\n");
    text.append("Sistem: ").append(System.getProperty("os.name")).append(' ').append(System.getProperty("os.version")).append('\n');
    text.append("Klasör: ").append(folder.getAbsolutePath()).append("\n\n");
    File[] children = folder.listFiles();
    if (children != null) {
      Arrays.sort(children);
      text.append("Klasördeki dosyalar:\n");
      for (File child : children) text.append("  ").append(child.getName()).append(child.isDirectory() ? "\\" : "  " + child.length()).append('\n');
      text.append('\n');
    }
    for (File jar : jars) {
      text.append("== ").append(folder.toPath().relativize(jar.toPath())).append("  ").append(jar.length()).append('\n');
      try (ZipFile zip = new ZipFile(jar)) {
        ZipEntry manifest = zip.getEntry("META-INF/MANIFEST.MF");
        if (manifest != null) {
          for (String line : new String(readAll(zip.getInputStream(manifest)), StandardCharsets.UTF_8).split("\r?\n")) {
            if (line.startsWith("Main-Class") || line.startsWith("Class-Path") || line.startsWith(" ")
                || line.startsWith("Implementation") || line.startsWith("Specification")) text.append("  ").append(line).append('\n');
          }
        }
        int classes = 0;
        List<String> interesting = new ArrayList<String>();
        Enumeration<? extends ZipEntry> entries = zip.entries();
        while (entries.hasMoreElements()) {
          String name = entries.nextElement().getName();
          if (!name.endsWith(".class")) continue;
          classes++;
          String lower = name.toLowerCase(Locale.ROOT);
          if (name.contains("$") || !(lower.contains("havelsan") || lower.contains("uyap"))) continue;
          if (lower.contains("pdf") || lower.contains("tray") || lower.contains("udf") || lower.contains("export")
              || lower.contains("print") || lower.endsWith("main.class") || lower.contains("convert")) interesting.add(name);
        }
        text.append("  ").append(classes).append(" sınıf\n");
        Collections.sort(interesting);
        for (int index = 0; index < interesting.size() && index < 300; index++) text.append("  ").append(interesting.get(index)).append('\n');
      } catch (IOException | RuntimeException error) {
        text.append("  okunamadı: ").append(error).append('\n');
      }
      text.append('\n');
    }
    for (File target : new File[] {new File(System.getProperty("user.home"), "Desktop"), new File(System.getProperty("user.home"))}) {
      if (!target.isDirectory()) continue;
      File report = new File(target, "pdfbrennt-kopru-rapor.txt");
      try (OutputStream output = new FileOutputStream(report)) {
        output.write(text.toString().getBytes(StandardCharsets.UTF_8));
        return report;
      } catch (IOException error) {
        // Try the next folder.
      }
    }
    return null;
  }

  // Names the jars of a place, so a person can tell which installation was chosen.
  static String jarsIn(File place) {
    File folder = place.isDirectory() ? place : folderOf(place);
    File[] children = folder.listFiles();
    List<String> names = new ArrayList<String>();
    if (children != null) {
      Arrays.sort(children);
      for (File child : children) if (child.isFile() && child.getName().toLowerCase(Locale.ROOT).endsWith(".jar")) names.add(child.getName());
    }
    if (names.isEmpty()) return "Bu klasörde .jar dosyası yok.";
    int shown = Math.min(names.size(), 12);
    StringBuilder text = new StringBuilder("Bu klasördeki .jar dosyaları: ");
    for (int index = 0; index < shown; index++) text.append(index == 0 ? "" : ", ").append(names.get(index));
    if (names.size() > shown) text.append(" ve ").append(names.size() - shown).append(" dosya daha");
    return text.append('.').toString();
  }

  // UYAP Kelime İşlemci's installer records its folder as the InstallLocation of its
  // uninstall entry ("Uyap Kelime İşlemci …" or its product code). reg.exe prints in the
  // console code page, so the output is read in the code pages a Turkish Windows may use;
  // only folders that exist are kept.
  static List<File> installedFolders() {
    Set<File> folders = new LinkedHashSet<File>();
    if (!System.getProperty("os.name", "").toLowerCase(Locale.ROOT).startsWith("windows")) return new ArrayList<File>(folders);
    for (String key : new String[] {"HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
        "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
        "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall"}) {
      byte[] output;
      try {
        Process process = new ProcessBuilder("reg", "query", key, "/s", "/v", "InstallLocation").redirectErrorStream(true).start();
        process.getOutputStream().close();
        output = readAll(process.getInputStream());
        process.waitFor(10, TimeUnit.SECONDS);
      } catch (Exception error) {
        continue;
      }
      for (String name : new String[] {"IBM857", "windows-1254", "UTF-8"}) {
        if (!Charset.isSupported(name)) continue;
        String entry = "";
        for (String line : new String(output, Charset.forName(name)).split("\r?\n")) {
          if (line.startsWith("HKEY_")) entry = line;
          int type = line.indexOf("REG_SZ");
          if (type < 0 || !line.trim().startsWith("InstallLocation")) continue;
          String value = line.substring(type + "REG_SZ".length()).trim();
          String about = (entry + " " + value).toLowerCase(new Locale("tr"));
          if (value.isEmpty() || !(about.contains("uyap") || about.contains(PRODUCT_CODE.toLowerCase(Locale.ROOT)))) continue;
          File folder = new File(value);
          if (folder.isDirectory()) folders.add(folder);
        }
      }
    }
    return new ArrayList<File>(folders);
  }

  static byte[] readAll(InputStream input) throws IOException {
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    byte[] buffer = new byte[8192];
    int read;
    while ((read = input.read(buffer)) > 0) output.write(buffer, 0, read);
    return output.toByteArray();
  }

  static File prepareEditor(File jar) {
    String problem = notFoundMessage();
    while (true) {
      if (jar != null) {
        try {
          loadUyap(jar);
          return jar;
        } catch (Exception | LinkageError error) {
          error.printStackTrace();
          problem = "Seçilen dosya açılamadı:\n    " + jar.getAbsolutePath() + "\n"
              + "Bu sürüm desteklenmiyor olabilir.\n"
              + "UYAP Doküman Editörü'nü açıp çalıştığını da kontrol edin.\n";
        }
      }
      File chosen = chooseJar(problem);
      if (chosen == null) return null;
      jar = editorIn(chosen, 3);
      if (jar == null) {
        problem = "Seçilen klasörde PDF Brennt'in kullandığı UYAP dönüştürücüsü bulunamadı:\n    "
            + (chosen.isDirectory() ? chosen : folderOf(chosen)).getAbsolutePath() + "\n"
            + jarsIn(chosen) + "\n";
        File report = writeReport(chosen);
        if (report != null) {
          problem += "\nBu UYAP sürümü köprüyle henüz çalışmıyor olabilir. Klasörün içeriği şu dosyaya yazıldı:\n    "
              + report.getAbsolutePath() + "\nBu dosyayı PDF Brennt geliştiricisine gönderirseniz bu sürüm de desteklenebilir.\n"
              + "Dosyada belge içeriği yoktur; yalnızca UYAP programının dosya ve sınıf adları vardır.\n";
        }
      }
    }
  }

  // Says where the bridge looked and how to find the editor's folder by hand.
  static String notFoundMessage() {
    StringBuilder text = new StringBuilder("UYAP Doküman Editörü bu bilgisayarda bulunamadı.\n\nKöprü şu klasörlere baktı:\n");
    for (String folder : searched) text.append("    • ").append(folder).append('\n');
    text.append("    • Program Files, Program Files (x86), AppData\\Local ve disklerin kökünde adında “UYAP” geçen klasörler\n");
    return text.toString();
  }

  static File chooseJar(String problem) {
    Object[] options = {"Dosya seç", "Vazgeç"};
    if (JOptionPane.showOptionDialog(null, findHelp(problem), WINDOW_TITLE, JOptionPane.DEFAULT_OPTION,
        JOptionPane.INFORMATION_MESSAGE, null, options, options[0]) != 0) return null;

    File start = new File(WINDOWS_EDITOR_DIR);
    for (File folder : installedFolders()) if (!start.isDirectory()) start = folder;
    JFileChooser chooser = new JFileChooser(start.isDirectory() ? start : null);
    chooser.setDialogTitle("UYAP klasörünü ya da içindeki bir .jar dosyasını seçin");
    chooser.setFileSelectionMode(JFileChooser.FILES_AND_DIRECTORIES);
    chooser.setFileFilter(new FileNameExtensionFilter("UYAP dosyası (*.jar)", "jar"));
    return chooser.showDialog(null, "Seç") == JFileChooser.APPROVE_OPTION ? chooser.getSelectedFile() : null;
  }

  static String findHelp(String problem) {
    return problem + "\n"
        + "UYAP Doküman Editörü genellikle şu klasöre kurulur:\n"
        + "    " + WINDOWS_EDITOR_DIR + "\n"
        + "Bu klasörde editor-app.jar ya da adı farklı .jar dosyaları bulunur.\n\n"
        + "Başka bir yere kurulduysa yerini şöyle bulabilirsiniz:\n"
        + "  1. Klavyede Windows + E tuşlarına basın. Soldan “Bu bilgisayar”ı seçin.\n"
        + "  2. Sağ üstteki arama kutusuna Uyap Kelime yazıp Enter'a basın.\n"
        + "  3. Bulunan klasörün yolunu not edin. Bu klasör UYAP'ın klasörüdür.\n"
        + "Sonra aşağıdaki Dosya seç düğmesine basın. O klasördeki herhangi bir .jar dosyasını seçip Seç'e basın.\n"
        + "Doğru dosyayı köprü kendisi bulur.\n\n"
        + "Arama hiçbir şey bulmazsa UYAP Doküman Editörü bu bilgisayarda kurulu değildir.\n"
        + "Önce UYAP Doküman Editörü'nü kurun (uyap.gov.tr), sonra köprüyü yeniden açın.";
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
    String className = trayClassIn(jar);
    if (className == null) className = TRAY_CLASS;
    URLClassLoader loader = new URLClassLoader(classPath(jar), PdfBrenntKopru.class.getClassLoader());
    Thread thread = Thread.currentThread();
    ClassLoader previousLoader = thread.getContextClassLoader();
    thread.setContextClassLoader(loader);
    try {
      Class<?> type = Class.forName(className, true, loader);
      Method converter = converterOf(type);
      if (converter == null) throw new Exception("Bu UYAP sürümünde udfToPdf bulunamadı: " + className);
      tray = java.lang.reflect.Modifier.isStatic(converter.getModifiers()) ? null : instanceOf(type);
      udfToPdf = converter;
      uyapLoader = loader;
      trayClass = className;
    } catch (Exception | LinkageError error) {
      thread.setContextClassLoader(previousLoader);
      try {
        loader.close();
      } catch (IOException closeError) {
        error.addSuppressed(closeError);
      }
      if (error instanceof ClassNotFoundException) {
        throw new Exception("Seçilen dosya UYAP Editör değil ya da bu sürüm desteklenmiyor: " + jar, error);
      }
      throw error;
    }
  }

  // TrayUtils.udfToPdf(OutputStream, ByteArrayInputStream); older versions may declare
  // the stream parameters more broadly or the other way round.
  static Method converterOf(Class<?> type) {
    try {
      return type.getMethod("udfToPdf", OutputStream.class, ByteArrayInputStream.class);
    } catch (NoSuchMethodException error) {
      // Look for a compatible signature below.
    }
    for (Method method : type.getMethods()) {
      Class<?>[] parameters = method.getParameterTypes();
      if (!"udfToPdf".equals(method.getName()) || parameters.length != 2) continue;
      if (parameters[0].isAssignableFrom(ByteArrayOutputStream.class) && parameters[1].isAssignableFrom(ByteArrayInputStream.class)) return method;
      if (parameters[1].isAssignableFrom(ByteArrayOutputStream.class) && parameters[0].isAssignableFrom(ByteArrayInputStream.class)) return method;
    }
    return null;
  }

  static Object instanceOf(Class<?> type) throws Exception {
    try {
      return type.getMethod("getInstance").invoke(null);
    } catch (NoSuchMethodException error) {
      return type.getConstructor().newInstance();
    }
  }

  static byte[] convert(final byte[] udf) throws Exception {
    Future<byte[]> task = worker.submit(() -> {
      Thread.currentThread().setContextClassLoader(uyapLoader);
      ByteArrayOutputStream output = new ByteArrayOutputStream();
      try {
        ByteArrayInputStream input = new ByteArrayInputStream(udf);
        if (udfToPdf.getParameterTypes()[0].isAssignableFrom(ByteArrayOutputStream.class)) udfToPdf.invoke(tray, output, input);
        else udfToPdf.invoke(tray, input, output);
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
        if (countLabel != null) SwingUtilities.invokeLater(() -> countLabel.setText(count + " dosya dönüştürüldü."));
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

  static void showWindow(final File folder) {
    JFrame frame = new JFrame(WINDOW_TITLE);
    frame.setDefaultCloseOperation(WindowConstants.EXIT_ON_CLOSE);
    JPanel content = new JPanel(new BorderLayout(0, 10));
    content.setBorder(BorderFactory.createEmptyBorder(14, 16, 14, 16));

    // Where UYAP Doküman Editörü was found; the path can be selected and copied.
    JPanel found = new JPanel();
    found.setLayout(new BoxLayout(found, BoxLayout.Y_AXIS));
    JLabel ready = new JLabel("<html><b>Köprü hazır.</b> UYAP Doküman Editörü bu klasörde bulundu:</html>");
    ready.setAlignmentX(0f);
    found.add(ready);
    JPanel pathRow = new JPanel(new BorderLayout(8, 0));
    pathRow.setAlignmentX(0f);
    pathRow.setBorder(BorderFactory.createEmptyBorder(6, 0, 0, 0));
    JTextField path = new JTextField(folder.getPath());
    path.setEditable(false);
    path.setColumns(Math.min(48, Math.max(28, folder.getPath().length() + 2)));
    pathRow.add(path, BorderLayout.CENTER);
    if (Desktop.isDesktopSupported() && Desktop.getDesktop().isSupported(Desktop.Action.OPEN)) {
      JButton open = new JButton("Klasörü aç");
      open.addActionListener(event -> {
        try {
          Desktop.getDesktop().open(folder);
        } catch (Exception error) {
          JOptionPane.showMessageDialog(frame, "Klasör açılamadı. Yolu yukarıdaki kutudan kopyalayıp Dosya Gezgini'ne yapıştırabilirsiniz.",
              WINDOW_TITLE, JOptionPane.INFORMATION_MESSAGE);
        }
      });
      pathRow.add(open, BorderLayout.EAST);
    }
    found.add(pathRow);
    content.add(found, BorderLayout.NORTH);

    content.add(new JLabel("<html>"
        + "1. PDF Brennt sitesine dönün ve belgenizi seçin.<br>"
        + "2. <b>UYAP köprüsüyle dönüştür</b> düğmesine basın.<br>"
        + "3. PDF hazır olana kadar bu pencereyi açık tutun.<br>"
        + "4. İşiniz bitince <b>Köprüyü kapat</b> düğmesine basın.<br><br>"
        + "Dönüşüm başlamazsa sitedeki uyarıyı izleyin.<br>"
        + "Dosyalar bilgisayarınızdan çıkmaz.</html>"), BorderLayout.CENTER);
    JPanel bottom = new JPanel(new FlowLayout(FlowLayout.RIGHT, 0, 0));
    countLabel = new JLabel("0 dosya dönüştürüldü.");
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

  static void fatal(String message) {
    if (console) {
      System.err.println(message);
      System.exit(1);
    }
    JOptionPane.showMessageDialog(null, message, WINDOW_TITLE, JOptionPane.ERROR_MESSAGE);
    System.exit(1);
  }
}
