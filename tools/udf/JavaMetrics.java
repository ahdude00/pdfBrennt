import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.charset.StandardCharsets;

// Prints the integer font metrics Swing uses for layout on this Java runtime.
// Usage: java JavaMetrics <code points file> <output file>
public class JavaMetrics {
  public static void main(String[] args) throws IOException {
    BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(args[0]), StandardCharsets.UTF_8));
    int[] codePoints = reader.lines().filter(line -> !line.isEmpty()).mapToInt(Integer::parseInt).toArray();
    Graphics2D graphics = new BufferedImage(8, 8, BufferedImage.TYPE_INT_RGB).createGraphics();
    String[] families = {"Times New Roman", "Arial"};
    int[] styles = {Font.PLAIN, Font.BOLD, Font.ITALIC, Font.BOLD | Font.ITALIC};
    try (Writer out = new OutputStreamWriter(new FileOutputStream(args[1]), StandardCharsets.UTF_8)) {
      out.write(System.getProperty("java.version") + "\n");
      for (String family : families) {
        for (int style : styles) {
          for (int size = 1; size <= 96; size++) {
            FontMetrics metrics = graphics.getFontMetrics(new Font(family, style, size));
            StringBuilder line = new StringBuilder();
            line.append(family).append('|').append(style).append('|').append(size).append('|')
              .append(metrics.getAscent()).append('|').append(metrics.getDescent()).append('|').append(metrics.getLeading()).append('|');
            for (int i = 0; i < codePoints.length; i++) {
              if (i > 0) line.append(',');
              line.append(metrics.getFont().canDisplay(codePoints[i]) ? metrics.charWidth(codePoints[i]) : -1);
            }
            out.write(line.append('\n').toString());
          }
        }
      }
    }
    System.exit(0);
  }
}
