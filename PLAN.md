# pdfBrennt geliştirme planı

Telefon ve bilgisayarda tarayıcıdan açılan bir PDF araç kutusu. Ana sayfada her araç kendi kartıyla yer alır ve kart doğrudan ilgili işlem ekranını açar. İlk çalışan sürümün kodu açık bir GitHub reposunda tutulur ve GitHub Pages üzerinden ücretsiz yayımlanır. Dosyalar cihazda işlenir.

## Ekranlar ve iş akışları

| Ekran | Akış |
| --- | --- |
| **Ana sayfa** | En üstte PDF Dönüştür, PDF Birleştir ve PDF Ayır. Devamında sıkıştırma, sayfa düzenleme, PDF’den görsel alma, filigran, sayfa numaralandırma, OCR ve şifreleme araçları. Masaüstünde kart ızgarası, telefonda dokunmaya uygun kartlar. |
| **PDF Dönüştür** | PNG veya JPEG seç → sayfa boyutunu belirle → PDF’yi önizle ve indir. UDF sekmesinde bir UYAP belgesi seç → PDF’yi önizle ve indir. Office sekmesi yerel PDF dışa aktarma seçeneğini gösterir. |
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

Bağımsız tarayıcı motoru UDF 1.8 belgelerini kapsar. Kurallar, kullanıcının izniyle UYAP Editör’ün kodundan (javap ile) okunup aktarıldı ve UYAP çıktısıyla doğrulandı. Referans PDF’ler bu bilgisayarda kurulu UYAP Editör’ün kendi PDF dışa aktarımından (Java 8) üretilir. Ailesi belirtilmemiş metinlerde varsayılan seçim Times New Roman’dır. Arial da seçilebilir. Kullanıcı özgün TTF dosyalarını eklediğinde motor aileyi ve biçimi eşleştirip yazı tipini PDF’ye gömer. Özgün TTF eklenmediğinde Times New Roman için Liberation Serif, Arial için Liberation Sans kullanılır ve çıktı üzerinde bilgi verilir. Font gömme ve alt küme bayrakları OpenType OS/2 tablosundan okunur. [Resmî Yazışma Yönetmeliği](https://iidb.adalet.gov.tr/Resimler/SayfaDokuman/106202011432920200610-8.pdf) · [OpenType OS/2 tablosu](https://learn.microsoft.com/en-us/typography/opentype/spec/os2)

Ölçümlerle bulunan kurallar:

- **Metin.** Kelimeler ipucusuz (unhinted) genişliklerle ölçülür. Satır, UYAP’ın satır görünümü gibi her parçanın genişliğini aşağı yuvarlar ve kalanı taşıyarak 0,5’i aştığında bir nokta ekler. Ortalama ve sağa yaslama 510 pt içinde satır genişliğinin tamsayı kısmını kullanır; paragrafın son satırındaki sondaki boşluklar ve satır sonu (1 pt) bu genişliğe dahildir. Bir kelime ancak ardındaki boşluklarla birlikte sığıyorsa satırda kalır.
- **İki yana yaslama.** Kural, UYAP Editör’ün satır görünümünden okunarak birebir aktarıldı. Son satır dışındaki her satırda iç boşluklar, boş genişliğin boşluk sayısına bölünmüş payının aşağı yuvarlanmış değerini alır; kalan kesir taşınır, yuvarlamadan artan genişlik iç boşluklara eşit dağıtılır. Satır başındaki boşluklar sıfır genişliğe iner. Alt çizgi her parçanın kendi doğal genişliğinde çizilir; sekmenin alt çizgisi sekme durağına uzanır, satırın son boşluğu çizilmez.
- **Satır yüksekliği** `ceil(kesirli satır yüksekliği)`, taban çizgisi Java ascent + leading altındadır. Daha yüksek bir satırda metin `trunc((H − h) × (1 − (jD − 2) / (h_kesirli + 1)))` kadar aşağıdan başlar. Bu kural iki aile, dört biçim ve 6–96 puntonun 728 birleşiminde doğrulandı.
- **Sayfa.** PDF sayfası üst ve alt kenar farkı kadar büyür. Gövde, başlangıcından `ceil(A4 yüksekliği − üst − alt kenar)` aşağıda kesilir. Üstbilgi ve altbilgi kendi ötelemelerinden çizilir ve gövde alanını daraltır.
- **Görsel, tablo, sekme ve liste.** Satır içi görseller satırın altına oturur. Tablo sütunları `columnSpans` oranıyla 510 pt’ye bölünür; hücre sayısı sütun sayısından farklı satırlar eşit bölünür. Hücre, satır ve dış kenarlık türleri çizilir. Sayfa sonuna gelen satır sığan satırlarıyla bölünür, kalanı sonraki sayfada devam eder. Sekme durakları Swing `TabStop` hizalamalarını izler. Liste işaretleri girintinin önünde ölçülmüş konumlarda durur.

- **Sayfa numarası.** `pageNumber-spec` bir bit kümesidir: 8 alt, 32 orta, 64 sağ, 2048 toplam sayfa, 4096 ilk sayfada gizle, 8192 tek sayfada gizle. Numara bölüm kutusunda TextLayout ile çizilir (taban çizgisi üstte kutu üstü + ⌊sınır yüksekliği⌋ + 2, altta kutu altı − 2); UYAP bunu şekil olarak yazdığı için `tools/udf/outlines.mjs` konumları Windows yazı tipleriyle doğrular.
- **Metin efektleri.** Vurgu her parçanın kutusunu satır kutusuna kırpılarak doldurur. Üstü çizili çizgi kutu altının (descent − 2) + ⌊0,3 × (ascent + 6)⌋ üstünde, alt çizgi 4 − descent altındadır. Üst ve alt simge 2 pt küçüktür; hizalamaları 1 ve (h − (d + a/2)) / h’dir.
- **Tablolar.** Hücre, satır ve tablo kenarlığı ayarları (`borderSpec` kenar bitleri, düz/kesik/noktalı stil, kalınlık, renk) UYAP’ın kalemiyle çizilir; satırın kendi `columnSpans` değeri birleştirilmiş hücreleri tanımlar. Satır kenarlığı sayfalar arası 861 pt’lik sürekli görünümde, tablo kenarlığı sayfa başına çizilir.
- **Listeler.** Altı düzey, 24 numara türü, 7 madde işareti, `NumberSetted`, `SecListTypeLevelN` ve `Hanging` UYAP’ın paragraf görünümüyle aynı kurallarla çizilir.
- **Sayfa.** Kâğıt `mediaSizeName` ile seçilir; yatay sayfada kâğıt ve kenar boşlukları döner.

`test/udf` altındaki 20 sentetik belgenin hepsi UYAP çıktısıyla konum, kalem ve renk düzeyinde aynıdır (0,02 pt eşik). `udfConvertor` projesindeki gerçek bir UYAP belgesinde 815 kelimenin ve 164 çizginin hepsi aynı konumdadır. Birebir çizilemeyen öğeler nedeni belirtilerek reddedilir; kullanıcı bu belgeler için UYAP köprüsünü kullanabilir. [UYAP Editör yardımı](https://uyap.gov.tr/Uyap-Editor-Yardim)

### Office denemesi

İki tarayıcı motoru, sentetik DOCX, PPTX ve XLSX belgelerini PDF’ye çevirdi. İki adayda da sekiz sayfanın metni, sayfa ölçüleri ve yönü masaüstü LibreOffice 26.8.3 ile eşleşti. Bir aday sekiz sayfada görüntü düzeyinde eşleşti. Diğeri yedi sayfada eşleşti ve bir Excel sayfasında küçük görüntü farkı vardı. Her iki motor da 1 GiB WebAssembly belleği ayırdı. Microsoft Office ve fiziksel telefon karşılaştırmaları bekliyor. Office sekmesi bu nedenle **Yakında** olarak gösteriliyor. [Skitionek](https://github.com/Skitionek/serverless-office-converter) · [eze-paz v0.2.0](https://github.com/eze-paz/libreoffice-wasm/releases/tag/v0.2.0)

## Uygulama sırası

1. **Tasarım prototipi.** Ana sayfa, dönüştürme, birleştirme ve ayırma akışlarını masaüstünde ve telefonda örnek dosyalarla gözden geçir.
2. **İlk çalışan sürüm ve ücretsiz yayın.** PNG/JPEG → PDF, PDF Birleştir ve PDF Ayır. Önizleme, geçerli sayfa aralıkları, dokunmatik sıralama ve indirme davranışlarını iOS Safari, Android Chrome ve masaüstü tarayıcılarda doğrula. GitHub Actions ile GitHub Pages’e yayın akışını hazırla.
3. **Office ve UDF doğrulaması.** Tarayıcıda çalışan dönüştürücü adaylarını referans belgelerle ve mobil cihazlarda dene. Kalite ve cihaz uyumluluğu doğrulanan biçimleri aç. Diğer biçimler için kaynak uygulamada PDF dışa aktarma yolunu göster.
4. **PDF düzenleme.** Aşağıdaki planla sayfa düzenleyiciyi çıkar. Ardından sayfa içi düzenleme araçlarını ekle.
5. **Diğer PDF araçları.** PDF’den PNG/JPEG alma uygulandı. Sıkıştırma, OCR ve parola ile PDF şifreleme sonraki araçlar arasında.

## PDF düzenleme uygulama planı

### İlk sürüm — uygulandı

Ana sayfadaki **Sayfaları Düzenle** kartı `#sayfalar` ekranını açar. Kullanıcı bir PDF seçer, küçük resimler üzerinden sayfaları işaretler ve sıralar. Seçili sayfalar topluca 90° sola veya sağa döndürülebilir ve silinebilir. Masaüstünde sürükle-bırak, telefonda ve klavyede **Yukarı taşı** ve **Aşağı taşı** kullanılabilir. Kullanıcı son işlemleri geri alabilir ve yeniden uygulayabilir. Çıktı önizlenir ve yeni bir PDF olarak indirilir.

### Uygulama

1. **Ekran ve durum.** Ayır aracının dosya seçicisini, sayfa küçük resimlerini ve sonuç panelini yeniden kullan. Her sayfa için kaynak sayfa numarasını ve dönüş farkını tut. Silinen sayfayı listeden çıkar. Geçmişe sadece sıralama ve açı durumunu kaydet. Son sayfa silme eylemini arayüzde ve PDF motorunda engelle.
2. **Önizleme.** PDF.js önizlemesinde belgedeki dönüş açısıyla düzenleme açısını birleştir. Görünen küçük resimleri yükle. Dosya değiştiğinde veya sayfa tekrar döndürüldüğünde önceki çizimi iptal et.
3. **Dışa aktarma.** Mevcut PDF worker’ına `editPdf` işlemini ekle. Planlanan sıradaki sayfaları `pdf-lib` ile yeni belgeye kopyala ve dönüşü sayfa açısına uygula. Böylece sayfa içeriği, çözünürlük ve seçilebilir metin korunur. Sayfaların sırada tekil ve geçerli olduğunu worker’da doğrula. Şifreli dosyalarda mevcut hata akışını kullan.
4. **Belge özellikleri.** Form alanları, yer imleri ve sayfalar arası bağlantılar için küçük test belgeleri hazırla. Kopyalama sırasında taşınamayan özellikleri açıkça belirt. İmza algılandığında mevcut imzalı belge bildirimini kullan ve kullanıcıya özgün dosyayı koruması için ayrı bir çıktı ver.

### Kabul ölçütleri

- Dört sayfalık bir belgede üçüncü sayfa silinip dördüncü başa alındığında çıktı `4, 1, 2` sırasıyla açılır. Önceden 90° dönmüş bir sayfa 90° daha döndürülürse önizleme ve PDF 180° gösterir.
- Tek PDF içinde farklı sayfa boyutları, gömülü yazı tipleri ve kırpma alanları korunur. Geri al ve yinele, birden fazla sayfayı etkileyen işlemlerde de çalışır.
- Telefon ve masaüstünde önizleme, klavyeyle sıralama, hata durumları ve indirme doğrulanır. Dosya verisi cihazda kalır. Mevcut Birleştir, Ayır ve UDF kontrolleri de geçer.

### Sonraki aşamalar

Önce boş sayfa veya başka PDF’den sayfa ekleme gelir. Sayfa içi düzenleme aşamasında metin kutusu, görsel, filigran ve sayfa numarası PDF koordinatlarıyla yerleştirilir. Var olan metni değiştirme ayrı bir çalışma olarak ele alınır. Önce gömülü fontlarla seçilebilir metnin düzenlenebilmesi ve komşu satırların konumunun korunması doğrulanır.
