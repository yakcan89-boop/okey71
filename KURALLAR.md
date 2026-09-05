# 71 Okey — Oyun Kuralları

Bu belge `okey71.html` içindeki motorun uyguladığı kuralların tamamıdır.
Kod ile belge arasında fark çıkarsa **kod esastır**; belge ona göre güncellenmelidir.

---

## 1. Malzeme ve dağıtım

- 106 taş: 4 renk (Kırmızı, Siyah, Mavi, Sarı) × 1–13 sayı × 2 takım, artı **2 sahte okey**.
- Destenin üstünden bir taş **gösterge** olarak açılır. Gösterge asla sahte okey olamaz;
  sahte gelirse destenin altına konur ve yeniden çekilir.
- **Okey** = göstergenin bir fazlası, aynı renk. Gösterge 13 ise okey aynı rengin 1'idir.
- Sahte okeyler oyunda gerçek okey yerine geçer.
- Dağıtandan sonraki oyuncu **15**, diğerleri **14** taş alır. Oyunu 15 taşlı oyuncu başlatır.
- Ortada 5 taşlık bir yığın açık durur; buradan çekildikçe desteden beslenir.

---

## 2. Sıra akışı

Her tur iki aşamadır:

1. **Çekme** — ya ortadan bir taş çekilir, ya da **soldaki oyuncunun** attığı son taş alınır.
2. **Hamle** — yere açma, yere koyma, işleme, okey değiştirme yapılır ve **bir taş atılır**.

Taş atılmadan sıra geçmez. Deste ve orta biterse el biter, puan yazılmaz.

---

## 3. Per (grup) geçerliliği

| Tür | Kural |
|---|---|
| **Seri** | Aynı renkten ardışık en az 3 taş. 13'ten 1'e dönmez. |
| **Set** | Aynı sayıdan farklı renkte 3 veya 4 taş. |
| **Çift** | Aynı renk + aynı sayıdan 2 taş. |

- Okey (ve sahte okey) her perde joker olarak kullanılır.
- İki okey birlikte çift sayılır; puanı okeyin sayı değerinin 2 katıdır.
- Bir perin puanı, perdeki taşların sayı değerleri toplamıdır. Okeyin yerine geçtiği
  taşın değeri sayılır.

---

## 4. Açış ve **KATLAMA**

> Bu bölüm oyunun en çok karıştırılan yeridir.

### 4.1 Sayı (düz) açışı

- İlk açış eşiği **71** puandır.
- Masada biri çift dediyse eşik **101**'e çıkar.
- Masada açılmış en yüksek açıştan **1 fazlası** gerekir.

Yani her an geçerli eşik:

```
eşik = max(71, çift_dendiyse ? 101 : 0, en_yüksek_açış + 1)
```

### 4.2 KATLAMA yalnızca açış anındaki sayıdır

**Katlama, oyuncunun yere açtığı andaki toplamdır. Sonradan yapılan hiçbir şey
katlamayı yükseltmez.** Katlamaya dahil **olmayan**lar:

- Açtıktan sonra yere indirilen yeni seriler / setler
- Yerdeki perlere işlenen tek taşlar
- Yerdeki okeyi kendi taşıyla alıp yerine taş koyma (okey değiş-tokuşu)
- Sonradan yere indirilen çiftler

*Örnek:* 72 ile açtın → katlama **72**, sonrakinin en az 73 açması gerekir.
Aynı turda yerdeki okeyi aldın ve 18 puanlık bir seri daha indirdin →
masadaki taş toplamın 90 oldu ama **katlama hâlâ 72'dir.**

Tek istisna: baraj altında açıp aynı turda tamamlarsan, tamamladığın sayı senin
açışın sayılır (aşağıya bak).

### 4.3 Baraj altında açış

Eşiğin altında yere inebilirsin, ama:

- O tur içinde eşiği geçecek kadar tamamlamak zorundasın.
- Tamamlayana kadar **işleme yapamazsın**.
- Tamamlamazsan tek çıkışın **"Taşı topla"**dır (cezası var, bkz. §8).

Tamamlanan sayı katlama olarak yazılır.

### 4.4 Yerden alınan taşın borcu

- Açmamış bir oyuncu yerden taş aldıysa, o taşı **açışında kullanmak zorundadır**.
- Açmış bir oyuncu yerden taş aldıysa, o taşı **aynı tur yere indirmek zorundadır**.
- İndirmezse **71 ceza** yazar.
- Yerden alınan taş aynı turda geri atılamaz.

---

## 5. Çift oyunu

### 5.1 Çift demek

- Bir oyuncu "çift" derse el **çifte döner**: artık ya elden bitilecek, ya 101 üstü
  açılacak, ya da çiftle açılacak.
- Çift diyen oyuncu **düz açamaz**, yalnız çiftle açar.
- Çifte giden oyuncunun attığı taşı **yalnız çifte giden başka bir oyuncu** alabilir.

### 5.2 Çift açış eşiği

- En az **5 çift** gerekir.
- Masada çiftle açan varsa gereken sayı, en yüksek çift açışının **1 fazlasıdır**
  (üst sınır 7).

```
gereken_çift = min(7, max(5, en_yüksek_çift_açışı + 1))
```

### 5.3 Çift katlaması da açış anındakidir

Çiftle açan oyuncunun **sonradan indirdiği çiftler katlamaya dahil değildir.**
5 çiftle açıp sonra 6.'yı indirirsen katlama **5**'te kalır; sonraki oyuncuya
yine 6 çift yeter.

### 5.4 Çift açan oyuncunun işleme hakkı

Çiftle açmış bir oyuncu, bir turda serilere **en fazla 1 taş** işleyebilir.

### 5.5 Seriyle açan oyuncunun çift indirmesi

Seri/set ile açmış bir oyuncu, **masada çiftle açmış biri varsa** kendi çiftlerini
de yere indirebilir ("İşle" düğmesiyle, iki taşı seçerek).

- Bu onu çift oyuncusu **yapmaz**; düz oyuncu olarak devam eder.
- Bu çiftler **çift katlamasını yükseltmez**.
- Masada hiç çift yoksa bu hamle reddedilir.

### 5.6 Çift hakkı sorusu

Bir oyuncu, **henüz açmamış ve çift dememiş** birinin attığı taşı alıp **düz açmak**
isterse, taşı atan kişiye sorulur:

- **"Çift diyorum"** → taş verilmez, atan oyuncu çifte döner, el çifte döner.
- **"Hayır, alsın"** → taş alınır, ama alan oyuncu **o peri yere indirmek zorundadır**;
  indirmezse **71 ceza**.

Eşli oyunda soru önce **atanın eşine** danışılır (10 saniye): "Çift desin",
"Alsın, versin", "Karışmam". Tavsiye bağlayıcı değildir, karar taşı atanındır.

---

## 6. İşleme

- Yalnız açmış oyuncu işler.
- Baraj altındaysan işleyemezsin.
- Bir perin **bir ucuna** aynı turda en fazla **2 taş** işlenebilir. Sıra sana tekrar
  gelince o uca devam edebilirsin.
- Çift perlere tek taş işlenmez.
- Elinde atacak taş kalmalıdır; son taşını işleyerek bitiremezsin.

### 6.1 Yerdeki okeyi alma

Yerdeki bir perde okey joker olarak duruyorsa ve okeyin temsil ettiği taş sende
varsa, taşını koyup **okeyi alabilirsin**. Bu bir işleme hakkı harcamaz ve
katlamayı değiştirmez.

Aldığın okey el sonunda elinde kalırsa **71 ceza** yazarsın (eşin bitirdiyse yazmazsın).

---

## 7. Elin bitişi ve katlar

Bir oyuncu son taşını atınca el biter.

| Durum | Kat |
|---|---|
| Çiftle bitirme | ×2 |
| Kimse açmamışken elden bitirme | ×2 |
| Okey atarak bitirme | ×2 |
| **Çift okey** atarak bitirme | ×4 |

Katlar çarpılarak birikir (örn. çiftle + okeyle bitiş ×4).

### 7.1 Çift okeyle bitiş

Elinde son iki taş olarak iki okey kalırsa ikisini birden atıp bitirebilirsin.
Şartlar: açmış olmalısın, iki okey takozda **yan yana** durmalı.
Kimse açmamışsa da geçerlidir; biri açmışsa elinin katlamayı geçmesi gerekir.

### 7.2 7 çift

Çift oyuncusu 7. çiftini yere indirdiği anda el biter.

---

## 8. Cezalar

Hepsi **71 puan**tır ve o elin puanına eklenir:

| Ne yaptın | Ceza |
|---|---|
| Yerdeki perlere **işleyen (işlek) taş** attın | 71 — üstelik o taşı kimse alamaz, ölür |
| Yerden aldığın taşı açışında/o turda kullanmadın | 71 |
| "Alsın" izni alıp o taşı yere indirmedin | 71 |
| Yerden taş topladın ("Taşı topla") ve taş attın | 71 |
| Geri aldığın işlenmiş taşı aynı tur yeniden indirmedin | 71 |
| Yerden aldığın okey elinde kaldı | 71 |

Bir turda birden fazla ceza birikebilir.

---

## 9. Puanlama

El sonunda her oyuncu için:

| Durum | Yazılan |
|---|---|
| Bitiren | 0 |
| Bitirenin eşi (eşli oyunda) | 0 |
| Açmış | elindeki taşların değeri × kat |
| Açamamış | 101 × kat |
| Çift oyuncusu | yukarıdakinin ayrıca ×2'si |

Buna o elde biriken cezalar eklenir. **Düşük puan iyidir.**

### 9.1 X (101 düşümü)

- **En yüksek düz açışı** yapan ve açışı **101 veya üstü** olan oyuncu **1 X** alır.
- **6 çiftle** açan **1 X**, **7 çiftle** açan **2 X** alır.
- Her X, toplamdan **101 düşer**.
- X hesabında **açış anındaki** sayı/çift geçerlidir (§4.2, §5.3).

```
net = toplam − (X sayısı × 101)
```

### 9.2 Kimse açamazsa

Hiç kimse açmadan el biterse puan yazılmaz, **aynı el yeniden dağıtılır**.

---

## 10. Tur ve seri yapısı

- Masa kurulurken **bir turun kaç el** olacağı seçilir (3–8 el).
- O kadar el tamamlanınca **tur biter**:
  - **Tek kişilik modda** en düşük neti olan tur kazananı, en yüksek olan kaybedendir.
  - **Eşli modda** eşlerin netleri toplanır; düşük olan taraf kazanır.
- Tur sonu ekranı masadaki **herkese** açılır ve iki seçenek sunar:
  - **"Sonraki Tura Geç"** — puanlar sıfırlanır, el sayacı 1'e döner, dağıtan bir kayar,
    tur sonucu geçmişe yazılır.
  - **"Seriyi Bitir"** — tüm turların şampiyonu ilan edilir ve seri sıfırlanır.
- Tur geçmişi skor penceresinden (üstteki skor düğmesi) her zaman görülebilir.

---

## 11. Eşli oyun

- Karşılıklı oturanlar eştir: **0 ↔ 2** ve **1 ↔ 3**.
- Eşi bitiren oyuncu 0 yazar.
- Eşin aldığı okeyin cezası, eşi bitirdiyse yazılmaz.
- Açmadan önce eşine kısa mesaj gönderilebilir ("çiftim var", "elim açar", "serbest oyna").
- Çift hakkı sorusunda eşine 10 saniyelik tavsiye hakkı sorulur.

---

## 12. Masa dışı roller (çok oyunculu)

| Rol | Ne görür | Ne yapar |
|---|---|---|
| **Oyuncu** | Kendi eli + masa | Oynar |
| **Yancı** | Yalnız masa — oyuncunun elini **görmez** | Hamle yapamaz, kısa tavsiye yazar |
| **Seyirci** | Yalnız masa | Boş koltuk açılırsa oturabilir |

- **Yancı, yanına oturduğu oyuncunun elini görmez.** Yere açılan perleri, atılan
  taşları, taş sayılarını ve masadaki genel kaydı görür; oyuncunun çektiği taşın
  adı ona "desteden çekti" diye görünür.
- Tavsiyeler masaya bakarak verilebilecek genel yönlendirmelerdir
  ("yerden alma", "yere indir", "okeyi al" gibi).
- Bir oyuncunun aynı anda en fazla bir yancısı olur.
- Yancının tavsiyesi yalnız kendi oyuncusuna görünür, masaya yayılmaz.
- Oyuncu **yancı yerini her an açıp kapatabilir**. Kapatınca varsa mevcut yancısı
  düşer ve o koltuğa kimse yancı olamaz.
- Oyuncu yancısını **kovabilir. Kovulan kişi o oyuncuya geri dönemez** — ne aynı
  kimlikle ne de aynı adla. Masada sade seyirci olarak kalabilir ve **başka bir
  oyuncunun** yancısı olabilir. Koltuk boşalırsa o koltuğun yasak listesi silinir.

### 12.1 Kopma

- 70 saniye hiç yoklama gelmezse oyuncu kopmuş sayılır, elini **bot devralır**;
  oyuncu dönünce koltuğunu geri alır.
- Masadan kendi isteğiyle ayrılanın koltuğu **boşalır**, başkası oturabilir.
- Oda sahibi ayrılırsa sahiplik masadaki başka birine geçer.
- Masadaki herkes 5 dakika uğramazsa oda kendiliğinden kapanır.

---

## 13. Uygulama notu — katlama değişkenleri

Kodda katlama üç alanla izlenir. Yeni kod yazarken bunlara dikkat:

| Alan | Anlamı | Ne zaman değişir |
|---|---|---|
| `p.acilis` | Oyuncunun **açış anındaki** sayısı | Yalnız açışta (ve baraj tamamlanınca) |
| `p.openPoints` | Oyuncunun yerdeki toplam sayısı | Her yere koymada artar |
| `p.openPairs` | **Açış anındaki** çift sayısı | Yalnız açışta |
| `p.pairCount` | Toplam çift sayısı | Her çift indirmede artar |
| `S.topOpen` | Masadaki en yüksek **açış** | Yalnız `p.acilis`'ten beslenir |
| `S.pairsMax` | Masadaki en yüksek **çift açışı** | Yalnız `p.openPairs`'ten beslenir |

**Kural:** `S.topOpen` ve `S.pairsMax`'a açış dışında hiçbir yerden yazılmaz.
