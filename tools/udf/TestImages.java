import java.awt.*;
import java.awt.geom.Ellipse2D;
import java.awt.image.BufferedImage;
import java.io.File;
import javax.imageio.ImageIO;

// Writes the synthetic images used by the UDF test documents.
// Usage: java TestImages <output directory>
public class TestImages {
  public static void main(String[] args) throws Exception {
    File directory = new File(args[0]);
    directory.mkdirs();

    BufferedImage logo = new BufferedImage(160, 80, BufferedImage.TYPE_INT_ARGB);
    Graphics2D graphics = logo.createGraphics();
    graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
    graphics.setColor(new Color(178, 34, 34, 230));
    graphics.fill(new Ellipse2D.Double(4, 4, 72, 72));
    graphics.setColor(new Color(20, 60, 120));
    graphics.fillRect(84, 16, 70, 14);
    graphics.fillRect(84, 38, 52, 10);
    graphics.fillRect(84, 56, 62, 10);
    graphics.dispose();
    ImageIO.write(logo, "png", new File(directory, "logo.png"));

    BufferedImage photo = new BufferedImage(300, 200, BufferedImage.TYPE_INT_RGB);
    graphics = photo.createGraphics();
    for (int y = 0; y < 200; y++) {
      for (int x = 0; x < 300; x++) {
        photo.setRGB(x, y, new Color(40 + x * 180 / 300, 90 + y * 120 / 200, 160 - x * 100 / 300).getRGB());
      }
    }
    graphics.setColor(new Color(250, 240, 200));
    graphics.fillOval(200, 30, 60, 60);
    graphics.setColor(new Color(30, 70, 30));
    graphics.fillPolygon(new int[] {0, 90, 170, 260, 300, 300, 0}, new int[] {170, 110, 150, 100, 140, 200, 200}, 7);
    graphics.dispose();
    ImageIO.write(photo, "jpg", new File(directory, "photo.jpg"));

    BufferedImage stamp = new BufferedImage(40, 40, BufferedImage.TYPE_INT_ARGB);
    graphics = stamp.createGraphics();
    graphics.setColor(new Color(0, 90, 160));
    graphics.setStroke(new BasicStroke(4));
    graphics.drawOval(4, 4, 32, 32);
    graphics.dispose();
    ImageIO.write(stamp, "png", new File(directory, "stamp.png"));
    System.exit(0);
  }
}
