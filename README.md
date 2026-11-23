# PDF Brennt

Telefon ve bilgisayarda çalışan Türkçe PDF araçları. Dosya işlemleri tarayıcıda yapılır.

## Araçlar

- **PDF Birleştir** birden fazla PDF’yi sürükleyerek veya yön düğmeleriyle sıralar. Her dosyada tüm sayfaları ya da `2-4, 7` gibi aralıkları seçebilirsiniz.
- **PDF Ayır** sayfa aralığı veya küçük resimlerden seçim yapar. Seçili sayfalar tek PDF olarak çıkarılabilir. Ayrı PDF’ler üreten modlarda birden fazla çıktı ZIP olarak indirilir.
- **Sayfaları Düzenle** PDF sayfalarını sürükleyerek veya yön düğmeleriyle sıralar. Birden fazla sayfayı birlikte döndürebilir ve silebilir, işlemleri geri alıp yineleyebilir, yeni PDF’yi önizleyip indirebilirsiniz.
- **PDF’den Görsel Al** tüm sayfaları veya seçtiğiniz sayfaları PNG ya da JPEG olarak kaydeder. 72, 150 veya 300 DPI seçebilirsiniz. Tek sayfa için görsel önizlenir ve doğrudan indirilir. Birden fazla sayfa ayrı görseller halinde tek bir ZIP dosyasına konur.
- **PDF’ye Dönüştür** PNG, JPEG ve TIFF dosyalarını, seçilen sırayla ve en-boy oranını koruyarak görsel boyutunda veya A4 sayfalara yerleştirir. Çok sayfalı TIFF’lerin (örneğin taranmış belge veya faks) her sayfası ayrı bir PDF sayfası olur. TIFF sayfaları taranma çözünürlüğüne (DPI) göre boyutlanır: 300 DPI taranmış bir A4 sayfa PDF’de de A4 olur, yatay ve dikey çözünürlüğü farklı faks sayfaları basık görünmez. Sıkıştırmasız, LZW, Deflate, PackBits, JPEG ve CCITT G3/G4 (faks) TIFF’ler; siyah-beyaz, gri, renkli, paletli, CMYK ve saydam görseller desteklenir. Siyah-beyaz sayfalar PDF’ye 1 bit olarak, kayıpsız sıkıştırılarak gömülür.
- **UYAP (UDF)** UDF 1.8 belgelerini aranabilir PDF’ye dönüştürür. Satır ve sayfa kırılımları UYAP Editör’ün kendi PDF çıktısıyla aynıdır. İki yana yaslama, tablolar (hücre, satır ve tablo kenarlığı ayarları, birleştirilmiş hücreler, sayfalara bölünen satırlar), PNG/JPEG görseller, üstbilgi, altbilgi ve sayfa numarası, altı düzeye kadar numaralı ve madde işaretli listeler, özel sekme durakları, kalın, italik, altı çizili, üstü çizili, vurgulu, alt ve üst simge metin, yatay sayfa ile A4, A5, Letter ve JIS B5 kâğıt desteklenir. E-imzalı UDF’ler görüntülenir, imza PDF’ye taşınmaz. En çok 50 UDF birlikte seçilip sıralanabilir. Bunlar ayrı PDF’ler olarak tek bir ZIP’te indirilebilir ya da listedeki sırayla tek PDF’de birleştirilebilir. UYAP köprüsü de belgeleri aynı şekilde toplu dönüştürür.
- **Önizleme ve indirme** oluşan PDF’nin sayfalarını tarayıcıda gösterir.

Sayfa düzenleyici mevcut metni, görselleri ve sayfa boyutlarını korur. Form alanlarının görünümü PDF sayfasına işlenir. Görünümün korunamadığı bir alan varsa uygulama hata gösterir. Yer imleri, belge içi bağlantılar ve dijital imzalar kaynak dosyada kalır.

UDF sekmesi belgenin kullandığı yazı tipi ailelerini ve biçimlerini listeler. Belgede aile belirtilmediğinde **Times New Roman** varsayılan olarak seçilir. Varsayılanı **Arial** olarak değiştirebilirsiniz. **Yazı tipi ekle** ile kaynak belgedeki statik TTF dosyalarını seçebilirsiniz. Uygulama fontun aile ve biçimini dosyanın içinden okur, gömme bayraklarını denetler ve kullanılan fontları PDF’ye gömer. Bir TTF eklendiğinde eksik aile veya biçimler için ek dosya ister. Hiç TTF eklenmezse Times New Roman için Liberation Serif, Arial için Liberation Sans kullanılır ve sonuçta gösterilir.

UDF ve font dosyaları cihazda kalır. Dönüşüm için UYAP Editör kurulumu gerekmez. Görseller yeniden sıkıştırılmadan, özgün baytlarıyla PDF’ye gömülür.

**UYAP köprüsü**, UYAP Doküman Editörü kurulu bir Windows bilgisayarda Chrome veya Edge ile kullanılır. Telefonda çalışmaz. Dönüşümü bilgisayarınızdaki editör yapar. Belgeniz bilgisayarınızda kalır.

1. **PDF’ye Dönüştür** ekranında **UYAP (UDF)** seçeneğini açın. **Köprüyü indirin** bağlantısına tıklayın. `pdfbrennt-kopru.jar` dosyası **İndirilenler** klasöründe görünür. Bulamazsanız tarayıcıda `Ctrl + J` ile indirme listesini açın.
2. İndirdiğiniz dosyaya çift tıklayın. **PDF Brennt köprüsü** penceresinde **“Köprü hazır.”** yazısını bekleyin. Pencerede UYAP Doküman Editörü’nün bulunduğu klasör yazar; **Klasörü aç** onu Dosya Gezgini’nde açar. Pencere görünmezse sitedeki **Köprü açılmıyorsa** bölümünü izleyin. Köprü editörü kurulum kaydından, olağan klasörden ve adında “UYAP” geçen klasörlerden arar. Editörün dosyasını adından değil içeriğinden tanır; `editor-app.jar` olmayan sürümlerde de (`editor_lib.jar` gibi) UYAP klasöründeki herhangi bir `.jar` dosyasını seçmek yeter. Bulamazsa hangi klasörlere baktığını ve UYAP klasörünün nasıl bulunacağını adım adım gösterir; seçilen klasörde dönüştürücü yoksa Masaüstü’ne belge içeriği taşımayan bir tanı raporu (`pdfbrennt-kopru-rapor.txt`) yazar.
3. Köprü açıkken sitede belgenizi seçin ve **UYAP köprüsüyle dönüştür** düğmesine basın. Tarayıcı erişim sorarsa **İzin ver**’i seçin. Erişim engellendiyse adres çubuğunun solundaki site simgesinden site ayarlarına girin ve sitedeki **Erişim engellendiyse** adımlarını izleyin.
4. **Dosyanız hazır** yazısını gördüğünüzde **PDF’yi indir** düğmesine basın. İşiniz bitince **Köprüyü kapat** düğmesine basın. Sonraki kullanımda İndirilenler’deki aynı köprüyü açıp sitede dönüştürün.

UYAP’ın ürettiği PDF’de yazılar başka bir bilgisayarda farklı görünebilir. [Köprü kaynak kodu](bridge/PdfBrenntKopru.java)

Dönüştürücü birebir çizemediği bir öğeyle karşılaşırsa eksik PDF üretmez, öğeyi adıyla belirterek belgeyi reddeder; bu durumda UYAP köprüsü kullanılabilir. Reddedilen öğeler şunlardır: Legal, Executive ve zarf kâğıtları, sayfa arka plan görseli, yalnızca bazı sayfalarda görünen ya da renkli veya çerçeveli üstbilgi ve altbilgi, alan (field) ve barkod öğeleri, negatif girinti, satıra sığmayan sözcük ve sekme, görselle başlayan liste paragrafı, `cellSpan`/`rowSpans` içeren tablolar.

Başka programların ürettiği bazı UDF’leri UYAP Doküman Editörü’nün kendisi de açamaz. Örneğin tablo sütun genişliği tam sayı değilse (`columnSpans="35.95,…"`) UYAP tabloyu çizerken hata verir. Dönüştürücü bu belgeleri nedenini söyleyerek reddeder ve köprüyü önermez, çünkü köprü de aynı editörü kullanır. UYAP’ın okuyamadığı bir yazı boyutunu (`size="10.5"` gibi) ise UYAP gibi yok sayar: yazı paragrafın boyutunu, o da yoksa varsayılan boyutu alır.

Yerleşim kuralları kurulu UYAP Editör’ün PDF dışa aktarımına karşı ölçüldü. `test/udf` klasöründeki sentetik belgeler her yayında UYAP referanslarıyla kelime kelime karşılaştırılır (`npm run udf:compare`). Ölçüm ve referans araçları [tools/udf](tools/udf/README.md) altındadır.

Office dönüşümü geliştirme planında yer alır. Belgeleri [LibreOffice](https://help.libreoffice.org/latest/en-US/text/shared/01/ref_pdf_export.html) ile PDF olarak dışa aktarabilirsiniz.

UDF dönüştürücünün ilk sürümü egPDF’den uyarlanmıştı. [egPDF lisansı](public/licenses/egpdf-MIT.txt) · [Liberation yazı tipleri lisansı](public/licenses/liberation-OFL.txt)

Parola korumalı PDF’lerin kilidini önce kaynak uygulamada açın. Birleştirme ve ayırma sayfa içeriğini kopyalar. Etkileşimli formlar ve yer imleri çıktı dosyasına aktarılmayabilir. Dijital imzaları doğrulamak için özgün belgeyi saklayın. 16 bit PNG ve TIFF renk derinliği PDF’de 8 bite düşer. Animasyonlu PNG’nin varsayılan karesi PDF’ye eklenir. CMYK TIFF’ler RGB’ye çevrilir. TIFF’lerdeki küçük önizleme kopyaları atlanır. BigTIFF, JPEG 2000 sıkıştırmalı, düzlemsel (planar) kanal düzenli ve kayan noktalı TIFF’ler desteklenmez; uygulama bunları nedenini belirterek reddeder. Bir TIFF sayfası en çok 100 megapiksel olabilir. Uygulama bu durumları dönüşüm sonucunda bildirir.

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
