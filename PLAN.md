# pdfBrennt geliştirme planı

Telefon ve bilgisayarda tarayıcıdan açılan bir PDF araç kutusu. Ana sayfada her araç kendi kartıyla yer alır ve kart doğrudan ilgili işlem ekranını açar. İlk çalışan sürümün kodu açık bir GitHub reposunda tutulur ve GitHub Pages üzerinden ücretsiz yayımlanır. Dosyalar cihazda işlenir.

## Ekranlar ve iş akışları

| Ekran | Akış |
| --- | --- |
| **Ana sayfa** | En üstte PDF Dönüştür, PDF Birleştir ve PDF Ayır. Devamında sıkıştırma, sayfa düzenleme, PDF’den görsel alma, filigran, sayfa numaralandırma, OCR ve şifreleme araçları. Masaüstünde kart ızgarası, telefonda dokunmaya uygun kartlar. |
| **PDF Dönüştür** | PNG veya JPEG seç → sayfa boyutunu belirle → PDF’yi önizle ve indir. UDF beta sekmesinde temel bir UYAP belgesi seç → PDF’yi önizle ve indir. Office sekmesi yerel PDF dışa aktarma seçeneğini gösterir. |
| **PDF Birleştir** | En az iki PDF ekle → dosyaları sürükleyerek veya yukarı/aşağı düğmeleriyle sırala → her satırda **Tüm sayfalar** ya da **Sayfa aralığı** seç → toplam sayfa sayısını gör → birleştir. Örneğin `1-3, 7` dört sayfayı alır. Geçersiz aralık ilgili satırda gösterilir. |
| **PDF Ayır** | Bir PDF aç → küçük resimlerden veya aralık alanından sayfaları seç → seçilenleri tek PDF’ye al, her aralıktan ayrı bir PDF üret veya her sayfayı ayrı çıkar. Birden fazla çıktı ZIP ile birlikte indirilebilir. |

Telefon ekranında dosya seçme düğmesi her zaman görünür. Birleştirme sırası dokunarak ve klavyeyle de değiştirilebilir. Dosya başına durum, hata ve sonuç eylemleri aynı ekranda kalır.

## Teknik yapı ve GitHub’dan yayın

- **Arayüz:** Vite, HTML, CSS ve JavaScript. PDF.js sayfa önizlemelerini üretir. `pdf-lib` sayfaları kopyalayarak birleştirme ve ayırmayı, JPG/PNG gömme işlemlerini tarayıcıda yapar. Önizlemeler ihtiyaç oldukça üretilir ve dosya işlemleri Web Worker’da yürütülür. [PDF.js](https://mozilla.github.io/pdf.js/getting_started/) · [pdf-lib PDFDocument API](https://pdf-lib.js.org/docs/api/classes/pdfdocument)
- **Ücretsiz yayın:** GitHub Actions, ana dala gönderilen değişikliklerde statik Vite çıktısını derler ve GitHub Pages’e yayımlar. GitHub Free ile herkese açık repo ve GitHub’ın verdiği `github.io` adresi kullanılır. Yayın yalnızca uygulama dosyalarını içerir. Kullanıcı belgeleri tarayıcı belleğinde işlenir. [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) · [Otomatik yayın](https://docs.github.com/en/get-started/start-your-journey/deploying-your-website-automatically)
- **Office belgeleri:** DOCX/PPTX/XLSX için tarayıcıda çalışan LibreOffice WebAssembly derlemesi denenir. Motor yalnızca dönüşüm istendiğinde yüklenir. İlk indirme boyutu, mobil bellek kullanımı, iOS Safari ve Android Chrome uyumluluğu, gerekli tarayıcı başlıkları, lisanslar ve çıktı kalitesi Pages üzerinde doğrulanır. İlk sürümde PDF, bilgisayarda mevcut Office uygulamasından veya ücretsiz LibreOffice’ten dışa aktarılabilir ve PDF Brennt’te düzenlenebilir. [Tarayıcıda LibreOffice denemesi](https://github.com/eze-paz/libreoffice-wasm) · [LibreOffice PDF dışa aktarma](https://help.libreoffice.org/latest/en-US/text/shared/01/ref_pdf_export.html)

## Dönüşüm kalitesi ve kabul ölçütleri

Word, PowerPoint ve Excel için hedef, kaynak uygulamada alınmış PDF ile aynı sayfa düzenini yakalamaktır. Tarayıcıda denenirken lisansı uygun fontlar kullanılır. Görseller için yeniden örnekleme kapatılır, yeniden kodlanan görseller için kayıpsız sıkıştırma seçilir ve metin mümkün olduğunda seçilebilir kalır. Eksik fontlar ve karmaşık Office öğeleri sayfa düzenini etkileyebilir. Dönüştürme özelliği açıldığında kullanıcı indirmeden önce gerçek çıktı PDF’sini görür. [LibreOffice PDF dışa aktarma seçenekleri](https://help.libreoffice.org/latest/en-US/text/shared/01/ref_pdf_export_general.html)

| Referans belge | Yayın öncesi kontrol |
| --- | --- |
| **DOCX ve Word’den alınan PDF** | Çok sayfalı tablo, Türkçe karakterler, başlık/altbilgi, sayfa numarası ve yatay bölüm. Sayfa sayısı, boyut, satır ve sayfa kırımları eşleşir. Taşma, kırpılma ve eksik glif gözlenmez. |
| **PPTX ve PowerPoint’ten alınan PDF** | 16:9 sunum, grafik, saydam görsel ve gömülü font. Slayt sırası, boyutu, metin hizası ve görsel konumu karşılaştırılır. |
| **XLSX ve Excel’den alınan PDF** | Birden çok çalışma sayfası, baskı alanı, tekrarlanan başlık satırı, yatay yön ve özel sayfa kırımı. Sayfalama, sütun kapsamı ve grafikler karşılaştırılır. |
| **PNG/JPEG kaynakları** | Saydam PNG ve telefon kamerasından JPEG. Kaynak piksel çözünürlüğü, görüntü oranı, yön ve kırpılma kontrol edilir. |
| **PDF birleştirme ve ayırma** | Farklı sayfa boyutu ve yönü olan üç PDF. Dosya ve sayfa sırası, seçilen aralıklar ve toplam sayfa sayısı doğrulanır. Çıktının sayfa içeriği ölçeklenmeden kopyalanır. Eksik, ters veya sınır dışı aralıklar satırda yakalanır. |

Referanslar sentetik veya kullanımı yetkilendirilmiş belgelerden hazırlanır. Dönüşüm testi önce sayfa sayısı, sayfa boyutu ve metni karşılaştırır. Ardından sayfa görselleri ve anlamlı düzen farkları incelenir. Office motoru veya fontlar değiştiğinde doğrulama seti yeniden çalıştırılır.

### UDF (UYAP)

Bağımsız tarayıcı motoru, UYAP Editör 5.4.20 çıktısıyla karşılaştırılan temel A4 dikey UDF 1.8 belgelerini kapsar. Ailesi belirtilmemiş metinlerde varsayılan seçim Times New Roman’dır. Arial da seçilebilir. Kullanıcı özgün TTF dosyalarını eklediğinde motor aileyi ve biçimi eşleştirip yazı tipini PDF’ye gömer. Özgün TTF eklenmediğinde Times New Roman için Liberation Serif, Arial için Liberation Sans kullanılır ve çıktı üzerinde bilgi verilir. Font gömme ve alt küme bayrakları OpenType OS/2 tablosundan okunur. [Resmî Yazışma Yönetmeliği](https://iidb.adalet.gov.tr/Resimler/SayfaDokuman/106202011432920200610-8.pdf) · [OpenType OS/2 tablosu](https://learn.microsoft.com/en-us/typography/opentype/spec/os2)

Sentetik referanslar sol, orta ve sağ hizalama, aynı kelimede dört yazı biçimi, alt çizgi, varsayılan sekmeler ve otomatik veya elle eklenen sayfa sonlarıyla karşılaştırıldı. Yayınlanan kapsamda metin, sayfa ölçüleri ve sayfa sayısı test edilir. Bazı punto ve biçim birleşimlerinde küçük görsel farklar bulundu. İki yana yaslama, özel sekmeler, yatay sayfa, tablolar, görseller, üstbilgi, altbilgi, doğrulama kodu ve imzalı UDF henüz desteklenmiyor. [UYAP Editör yardımı](https://uyap.gov.tr/Uyap-Editor-Yardim) · [egPDF UDF desteği](https://github.com/acc-studio/egpdf#uyap-documents-udf)

### Office denemesi

İki tarayıcı motoru, sentetik DOCX, PPTX ve XLSX belgelerini PDF’ye çevirdi. İki adayda da sekiz sayfanın metni, sayfa ölçüleri ve yönü masaüstü LibreOffice 26.8.3 ile eşleşti. Bir aday sekiz sayfada görüntü düzeyinde eşleşti. Diğeri yedi sayfada eşleşti ve bir Excel sayfasında küçük görüntü farkı vardı. Her iki motor da 1 GiB WebAssembly belleği ayırdı. Microsoft Office ve fiziksel telefon karşılaştırmaları bekliyor. Office sekmesi bu nedenle **Yakında** olarak gösteriliyor. [Skitionek](https://github.com/Skitionek/serverless-office-converter) · [eze-paz v0.2.0](https://github.com/eze-paz/libreoffice-wasm/releases/tag/v0.2.0)

## Uygulama sırası

1. **Tasarım prototipi.** Ana sayfa, dönüştürme, birleştirme ve ayırma akışlarını masaüstünde ve telefonda örnek dosyalarla gözden geçir.
2. **İlk çalışan sürüm ve ücretsiz yayın.** PNG/JPEG → PDF, PDF Birleştir ve PDF Ayır. Önizleme, geçerli sayfa aralıkları, dokunmatik sıralama ve indirme davranışlarını iOS Safari, Android Chrome ve masaüstü tarayıcılarda doğrula. GitHub Actions ile GitHub Pages’e yayın akışını hazırla.
3. **Office ve UDF doğrulaması.** Tarayıcıda çalışan dönüştürücü adaylarını referans belgelerle ve mobil cihazlarda dene. Kalite ve cihaz uyumluluğu doğrulanan biçimleri aç. Diğer biçimler için kaynak uygulamada PDF dışa aktarma yolunu göster.
4. **Ek araçlar.** Sayfa sıralama, silme ve döndürme, PDF’den PNG/JPEG alma, filigran ve sayfa numarası. Ardından sıkıştırmada kalite ve dosya boyutu seçimi, OCR ile taramanın metin katmanı ve parola ile PDF şifreleme.
