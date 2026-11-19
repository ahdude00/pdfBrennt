import java.awt.Component;
import java.awt.Container;
import java.awt.Rectangle;
import java.awt.Shape;
import java.awt.geom.Rectangle2D;
import java.io.ByteArrayInputStream;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Arrays;
import javax.swing.text.JTextComponent;
import javax.swing.text.View;

/**
 * Loads a UDF the way UYAP Editör's PDF converter does (WPDocumentPanel, then k())
 * and prints the laid-out view tree: class, model range, text and allocation of every
 * view. A measuring aid for porting UYAP's layout; it writes nothing.
 * Usage: java -cp build;editor-app.jar ViewDump file.udf [maxDepth]
 */
public class ViewDump {
  public static void main(String[] args) throws Exception {
    byte[] udf = Files.readAllBytes(Paths.get(args[0]));
    int maxDepth = args.length > 1 ? Integer.parseInt(args[1]) : 99;
    Class<?> panelType = Class.forName("tr.com.havelsan.uyap.system.editor.common.gui.WPDocumentPanel");
    Object panel = panelType.getConstructor().newInstance();
    // The obfuscated class overloads by return type, so methods are picked by signature.
    int result = (Integer) method(panelType, "a", int.class, java.io.InputStream.class).invoke(panel, new ByteArrayInputStream(udf));
    method(panelType, "a", void.class, int.class).invoke(panel, result);
    method(panelType, "k", void.class).invoke(panel);
    JTextComponent text = findText((Component) panel);
    if (text == null) throw new IllegalStateException("no text component");
    // The converter prints through this Pageable; its outer instance is the paged view.
    Object pageable = method(panelType, "a", java.awt.print.Pageable.class).invoke(panel);
    System.out.println("pages " + ((java.awt.print.Pageable) pageable).getNumberOfPages());
    Object pages = null;
    for (Field field : pageable.getClass().getDeclaredFields()) {
      field.setAccessible(true);
      if (field.getType().getName().endsWith("wp.b.ar")) pages = field.get(pageable);
    }
    if (pages == null) throw new IllegalStateException("no page set");
    java.util.Set<View> seen = new java.util.HashSet<View>();
    for (Class<?> type = pages.getClass(); type != null; type = type.getSuperclass()) {
      for (Field field : type.getDeclaredFields()) {
        field.setAccessible(true);
        Object value = field.get(pages);
        if (!(value instanceof View) || !seen.add((View) value)) continue;
        View view = (View) value;
        System.out.println("== field " + field.getName() + " : " + view.getClass().getName());
        Rectangle alloc = new Rectangle(0, 0, (int) view.getPreferredSpan(View.X_AXIS), (int) view.getPreferredSpan(View.Y_AXIS));
        dump(view, alloc, 0, maxDepth, text);
      }
    }
    System.exit(0);
  }

  static Method method(Class<?> type, String name, Class<?> returns, Class<?>... parameters) {
    for (Method method : type.getMethods()) {
      if (method.getName().equals(name) && method.getReturnType() == returns && Arrays.equals(method.getParameterTypes(), parameters)) return method;
    }
    throw new IllegalStateException("method " + name + " not found");
  }

  static JTextComponent findText(Component component) throws Exception {
    if (component instanceof JTextComponent) return (JTextComponent) component;
    for (Class<?> type = component.getClass(); type != null; type = type.getSuperclass()) {
      for (Field field : type.getDeclaredFields()) {
        if (JTextComponent.class.isAssignableFrom(field.getType())) {
          field.setAccessible(true);
          Object value = field.get(component);
          if (value != null) return (JTextComponent) value;
        }
      }
    }
    if (component instanceof Container) {
      for (Component child : ((Container) component).getComponents()) {
        JTextComponent found = findText(child);
        if (found != null) return found;
      }
    }
    return null;
  }

  static void dump(View view, Shape alloc, int depth, int maxDepth, JTextComponent text) throws Exception {
    StringBuilder line = new StringBuilder();
    for (int i = 0; i < depth; i++) line.append("  ");
    String name = view.getClass().getName().replace("tr.com.havelsan.uyap.system.", "");
    line.append(name).append(" [").append(view.getStartOffset()).append(',').append(view.getEndOffset()).append(')');
    if (alloc != null) {
      Rectangle2D r = alloc instanceof Rectangle2D ? (Rectangle2D) alloc : alloc.getBounds2D();
      line.append(String.format(" @%.3f,%.3f %.3fx%.3f", r.getX(), r.getY(), r.getWidth(), r.getHeight()));
    }
    line.append(String.format(" pref %.3f/%.3f align %.4f", view.getPreferredSpan(View.X_AXIS), view.getPreferredSpan(View.Y_AXIS), view.getAlignment(View.Y_AXIS)));
    if (view.getViewCount() == 0) {
      int start = Math.max(0, view.getStartOffset());
      int end = Math.min(text.getDocument().getLength(), view.getEndOffset());
      String content = end > start ? text.getDocument().getText(start, end - start) : "";
      line.append(" \"").append(content.replace("\n", "\\n").replace("\t", "\\t")).append('"');
    }
    System.out.println(line);
    if (depth >= maxDepth) return;
    for (int i = 0; i < view.getViewCount(); i++) {
      Shape child = alloc == null ? null : view.getChildAllocation(i, alloc);
      dump(view.getView(i), child, depth + 1, maxDepth, text);
    }
  }
}
