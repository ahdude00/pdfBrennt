# PDF Brennt

Telefon ve bilgisayarda çalışan Türkçe PDF araçları. Dosya işlemleri tarayıcıda yapılır.

## Araçlar

- **PDF Birleştir** birden fazla PDF’yi sürükleyerek veya yön düğmeleriyle sıralar. Her dosyada tüm sayfaları ya da `2-4, 7` gibi aralıkları seçebilirsiniz.
- **PDF Ayır** sayfa aralığı veya küçük resimlerden seçim yapar. Seçili sayfalar tek PDF olarak çıkarılabilir. Ayrı PDF’ler üreten modlarda birden fazla çıktı ZIP olarak indirilir.
- **PDF’ye Dönüştür** PNG ve JPEG dosyalarını, seçilen sırayla ve en-boy oranını koruyarak görsel boyutunda veya A4 sayfalara yerleştirir.
- **UYAP (UDF) · Beta** Times New Roman ile hazırlanmış temel, imzasız A4 dikey UDF 1.8 belgelerini aranabilir PDF’ye dönüştürür. Metin biçimleri ve belgeye eklenmiş sayfa sonları desteklenir. Çıktıda metrik uyumlu Liberation Serif kullanılır.
- **Önizleme ve indirme** oluşan PDF’nin sayfalarını tarayıcıda gösterir.

Office dönüşümü geliştirme planında yer alır. Belgeleri [LibreOffice](https://help.libreoffice.org/latest/en-US/text/shared/01/ref_pdf_export.html) ile PDF olarak dışa aktarabilirsiniz. Yatay, tablolu, görselli, imzalı veya doğrulama kodlu UDF’ler için [UYAP Editör](https://uyap.gov.tr/Uyap-Editor-Yardim) kullanılabilir.

UDF metin yerleşimi egPDF’den uyarlanmıştır. [egPDF lisansı](public/licenses/egpdf-MIT.txt) · [Liberation Serif lisansı](public/licenses/liberation-OFL.txt)

Parola korumalı PDF’lerin kilidini önce kaynak uygulamada açın. Birleştirme ve ayırma sayfa içeriğini kopyalar. Etkileşimli formlar ve yer imleri çıktı dosyasına aktarılmayabilir. Dijital imzaları doğrulamak için özgün belgeyi saklayın. 16 bit PNG renk derinliği PDF’de 8 bite düşer. Animasyonlu PNG’nin varsayılan karesi PDF’ye eklenir. Uygulama bu durumları dönüşüm sonucunda bildirir.

## Bilgisayarda çalıştırma

Node.js 24 LTS ile proje klasöründe şu komutları çalıştırın. Vite’ın terminalde gösterdiği adresi tarayıcıda açın.

```sh
npm ci
npm run dev
```

Yayın çıktısını oluşturup bilgisayarda incelemek için aşağıdaki komutları çalıştırın.

```sh
npm run build
npm run preview
```

## GitHub Pages’e ücretsiz yayınlama

1. Dosyaları herkese açık bir GitHub reposunun `main` dalına gönderin.
2. Repo ayarlarında **Settings → Pages → Build and deployment → Source** alanından **GitHub Actions** seçin.
3. **Actions → GitHub Pages → Run workflow** ile ilk yayını başlatın. Sonraki `main` gönderimleri yayını otomatik günceller.
4. Yayın adresi, tamamlanan iş akışında ve **Settings → Pages** ekranında görünür. Proje siteleri genellikle `https://KULLANICI.github.io/DEPO/` adresini kullanır.

[Yayın iş akışı](.github/workflows/deploy-pages.yml) uygulamayı derler ve `dist/` klasörünü yayımlar. Göreli varlık adresleri, derlemenin GitHub Pages’te repo alt yolundan açılmasını sağlar. [GitHub Pages belgeleri](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

Ürün kapsamı ve Office/UDF doğrulama adımları [geliştirme planında](PLAN.md) yer alır. İlk ekran tasarımları [tasarım prototipinde](design/index.html) görülebilir.
