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

**Açmış** bir oyuncu (düz ya da çift fark etmez) yerden aldığı taşı **o tur yere
indirmek zorundadır.** Yollar:

- Yerdeki bir pere işlemek
- Eşi elindeyse çift olarak indirmek
- Kendi peri olarak yere koymak

**Taşı yere indirmeden TAŞ ATAMAZ.** Oyun atışa izin vermez. Üç çıkışı vardır:

1. Taşı yere indirir / işler → ceza yok
2. **"Geri bırak"** der → taş yere döner, ceza yok, desteden çeker
3. Süresi dolar → taş kendiliğinden yere iade edilir, desteden çekilir ve
   **71 ceza** yazılır

Bu kural, oyuncunun istediği taşı alıp **başka bir taşı eşine yem olarak
atmasını** engeller. Aldıysan indireceksin.

**Açmamış** bir oyuncu yerden taş alabilir ve başka bir taş atarak devam edebilir;
ceza yazmaz, ama **çift demiş sayılır** (§5.1). Açacaksa aldığı taşı açışında
kullanmalıdır.

Bunun el sonundaki bedeli büyüktür: çift sayılıp da açamayan **101 değil 202**
yazar (§9). Kural insan için de bot için de aynıdır.

Yerden alınan taş aynı turda geri atılamaz.

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

### 5.4 Çift açan SERİ İNDİREMEZ

Çiftle açmış bir oyuncu yere seri/set indiremez. Elinde 1-2-3 gibi tam bir seri
olsa bile yere koyamaz. Yapabilecekleri:

- Yerdeki perlere **taş işlemek** (turda 1 hak, §5.5)
- Kendi **çiftini** yere indirmek (sınırsız)

Bu kural açışta da, açtıktan sonra da geçerlidir. Botlar da buna uyar.

### 5.5 Çift açan oyuncunun işleme hakkı

Çiftle açmış bir oyuncunun bir turda **tek bir işleme hakkı** vardır.

Bu hakkı harcayanlar:

- Serilerden birine bir taş işlemek
- **Yerdeki okeyi kendi taşıyla almak (okey takası)**

Yani okeyi aldıysan o tur seriye taş işleyemezsin; taş işlediysen okeyi alamazsın.
Sıra sana yeniden gelince hak sıfırlanır.

Hakka **tabi olmayan** hamleler:

- Kendi çiftini yere indirmek (istediğin kadar)
- Yeni bir per/seri yere koymak

### 5.6 Seriyle açan oyuncunun çift indirmesi

Seri/set ile açmış bir oyuncu, **masada çiftle açmış biri varsa** kendi çiftlerini
de yere indirebilir.

- Bu onu çift oyuncusu **yapmaz**; düz oyuncu olarak devam eder.
- Bu çiftler **çift katlamasını yükseltmez**.
- Çift açış eşiğinin (5-7) bununla ilgisi yoktur; tek çift bile indirilebilir.
- İşleme hakkı harcamaz.
- Masada hiç çift yoksa bu hamle reddedilir.
- Elde atacak taş kalmalıdır; son iki taşı çift diye indirip bitirilemez.

Uygulamada üç yol da aynı işi yapar: iki taşı seçip **İşle**, **Çift diz** deyip
hiçbir şey seçmeden **İşle** (takozda yan yana gelen çiftleri kendiliğinden
bulur), ya da **Yere koy**.

### 5.7 Çift hakkı sorusu

Bu soru **yalnızca** "senin taşınla DÜZ açacağım" durumunda sorulur.
**Çifte gitmiş bir oyuncu yerden taş alırken kimseye sormaz** — çifte gittiğini
masa zaten bilir, alıp yere indiremezse cezasını kendisi yer.

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
- Çift perlere tek taş işlenmez.
- Elinde atacak taş kalmalıdır; son taşını işleyerek bitiremezsin.

### 6.1 Düz açanın işleme sınırı

Bir perin **bir ucuna** aynı turda en fazla **2 taş** işlenir.

*Örnek:* Yerde kırmızı 6-7-8 var, elinde 5, 4 ve 3 var. Bu tur **5 ve 4**'ü
işlersin. **3** o uca girmez — ya sıra sana tekrar gelince işlersin, ya da
başka bir pere işlersin.

Perin **öbür ucu** ayrı sayılır: aynı tur yukarı uca da 2 taş işlenebilir.

Bunun dışında düz açan serbesttir:

- Yerdeki okeyi kendi taşıyla alabilir; bu **işleme hakkını yemez**, aynı tur
  taş işlemeye devam eder.
- Aldığı okeyi elinde tutabilir. Ama biri bitirirse **71 ceza** yazar (§8).
- Masada çiftle açan varsa kendi çiftlerini de indirebilir (§5.6).

### 6.2 Çift açanın işleme sınırı

Çift açanın turda **tek** işleme hakkı vardır ve okey takası da onu harcar
(§5.5). Çift indirmek bu hakka girmez.

### 6.3 Yerdeki okeyi alma

Yerdeki bir perde okey joker olarak duruyorsa ve okeyin temsil ettiği taş sende
varsa, taşını koyup **okeyi alabilirsin**. Katlamayı değiştirmez.
Bu **çift perlerde de geçerlidir**: yerde "okey + mavi 12" duruyorsa, mavi 12'ni
koyup okeyi alabilirsin.

Bunun sonucu olarak, o taş masadaki herkes için **işlek taştır**: yerde okeyli
bir çift varken eşini atan 71 yazar (§8).

**Okey takası bir işleme sayılır.** Çift açan oyuncu için bu, o turdaki tek
hakkını harcar (bkz. §5.5).

Aldığın okey el sonunda elinde kalırsa **71 ceza** yazarsın (eşin bitirdiyse yazmazsın).

---

## 7. Elin bitişi ve katlar

Bir oyuncu son taşını atınca el biter.

| Durum | Kat |
|---|---|
| Çiftle bitirme | ×2 |
| **Kimse açmamışken elden bitirme** | ×2 |
| Okey atarak bitirme | ×2 |
| **Çift okey** atarak bitirme | ×4 |

Katlar **çarpılarak** birikir ve birbirini yutmaz.

### 7.0 Elden bitme nedir

Hiç kimse açmamışken, **aynı turda** açıp o turda bitmektir. İki biçimi vardır ve
ikisi de aynı sayılır:

- Yedi çifti bir anda yere indirip bitmek
- Bütün perlerini bir anda indirip son taşını atmak

Önceki turlarda açmış olan bir oyuncu elden bitmiş sayılmaz — açışıyla bitişi
arasında sıra geçmiştir.

*Örnek 1 — düz elden bitiş, okey atmadan.* Çarpan **×2**.
- Çift deyip açamayan rakip: 101 × 2 (çift açamadı) × 2 (elden) = **404**
- Sade açamayan rakip: 101 × 2 (elden) = **202**
- Bitirenin eşi: **0**

*Örnek 2 — 7 çifti bir anda indirip elden bittin.* Çarpan 2 (çiftle bitiş)
× 2 (elden) = **×4**. Çift deyip açamayan rakip 101 × 4 × 2 = **808** yazar.
Sen 7 çiftle açtığın için ayrıca **2 X** alırsın.

*Örnek 3 — düz elden bitiş + okey attın.* ×2 (elden) × 2 (okey) = **×4**.
Çift okey atsaydın ×2 × 4 = **×8** olurdu.

### 7.1 Çift okeyle bitiş — yalnız DÜZ oyuncuya

Elinde son iki taş olarak iki okey kalırsa ikisini birden atıp bitirebilirsin.
Şartlar: açmış olmalısın, iki okey takozda **yan yana** durmalı.

**Çift oyuncusu çift okey atamaz.** Onun elindeki iki okey bir **çifttir**:
yere iner ve 7. çifti tamamlayarak eli bitirir. Çift oyuncusu bitirirken en
fazla **tek okey** atabilir.

*Örnek — 6 çift yerde, elde son iki taş iki okey.* İki yolu vardır:

| Yol | Ne yapar | Çarpan | Açamayan rakip |
|---|---|---|---|
| **A** | İkisini çift olarak indirir → 7. çift | ×2 | 202 |
| **B** | Birini yerdeki seriye işler, ötekini **atar** | ×4 | 404 |

İkisini birden atmak yoktur. B yolu daha çok yazdırır ama okeyi masaya
vermek demektir.

### 7.2 Kimse açmadan bitiş — tam tablo

| Bitiş | Çarpan | Sade rakip | Çift deyip açamayan |
|---|---|---|---|
| Elden bitme (düz), okey atmadan | ×2 | 202 | 404 |
| Elden bitme (düz) + okey attın | ×4 | 404 | 808 |
| Elden bitme (düz) + çift okey attın | ×8 | 808 | 1616 |
| Çiftten bitme (7 çift), okey atmadan | ×4 | 404 | 808 |
| Çiftten bitme (7 çift) + okey attın | ×8 | 808 | 1616 |
| Çiftten bitme + çift okey | — | *mümkün değil* | *mümkün değil* |

**Tek kişilik ile eşli farkı:** rakiplerin yazdığı sayılar aynıdır. Tek fark,
eşli oyunda karşındaki **eşindir ve 0 yazar**; tek kişilikte o da rakiptir ve
tablodaki sayıyı yazar.

X'ler ayrıca işler (§9.1): 7 çiftle açan **2 X**, 6 çiftle açan **1 X**, düz
elden bitende açış 101 ve üstüyse **1 X**.

Bu tabloyu `testler/tablo_katlar.js` üretir; çarpanları değiştirirsen
`node tablo_katlar.js` ile yeniden bastırabilirsin.

### 7.2 7 çift

Çift oyuncusu 7. çiftini yere indirdiği anda el biter.

---

### 7.3 El sonunda bitirenin taşları TAKOZDA gösterilir

El bitince herkesin **takozu**, bitirenin yere koyduğu perleri gösterir: seriler
puanıyla, çiftler "çift" etiketiyle, aralarında boşlukla. Üstte
"*<ad>* bu taşlarla bitirdi" yazar, elden bitişse "— ELDEN" eklenir.

Skor penceresi yalnız **puanları** yazar; taş listesi orada değil, takozdadır.

Bu, elden bitiş için tek görme şansıdır: orada taşlar tek anda inip el kapanır.
Çok oyunculuda takoz masadaki **herkese** aynı gider.

---

## 8. Cezalar

Hepsi **71 puan**tır ve o elin puanına eklenir:

| Ne yaptın | Ceza |
|---|---|
| Yerdeki perlere **işleyen (işlek) taş** attın | 71 — üstelik o taşı kimse alamaz, ölür |
| ↳ *yerdeki bir okeyin yerine geçen taş da işlektir* | ÇİFT perdeki okey de sayılır |
| ↳ *ama o taşla el bitiyorsa* | **ceza yok, taş da ölmez** |
| Yerden aldığın taşı açışında/o turda kullanmadın | 71 |
| "Alsın" izni alıp o taşı yere indirmedin | 71 |
| Yerden taş topladın ("Taşı topla") ve taş attın | 71 |
| Geri aldığın işlenmiş taşı aynı tur yeniden indirmedin | 71 |
| Yerden aldığın okey elinde kaldı | 71 |

Bir turda birden fazla ceza birikebilir.

**Bitiren son taşa ceza yazılmaz.** Son taşın işlek olsa da, okey olsa da, o
taşla el bitiyorsa 71 yazmazsın ve taş ölü sayılmaz. Elden bitişte de böyledir.
Ceza yalnız el devam ederken işlek taş atmaya yazılır.

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
  Aynı elde daha yüksek açan varsa alttaki X alamaz.
- **6 çiftle** açan **1 X**, **7 çiftle** açan **2 X** alır.
- **Aynı elde 7 çift açan varsa, 6 çift açanın X'i gider.** X yalnız o elin en
  yüksek çift açışına yazılır.
- Sayı X'i ile çift X'i birbirini etkilemez; aynı elde ikisi de verilebilir.
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
- Çift hakkı sorusunda eşine 10 saniyelik tavsiye hakkı sorulur.

### 11.1 Eşe emir verme

Eşli oyunda herkes eşine kısa bir emir yollayabilir. Emir **sıra beklemez** —
eşinin sırası gelmeden de verilebilir. Emir eşinin ekranında, kendi bölümünde
sarı bir bant olarak durur; örneğin *"Murat eli iyi, sizden **ÇİFTE GİTMENİZİ**
istiyor."*

| Emir | Ne demek | Bot ne yapar |
|---|---|---|
| **Çifte git** | Çift oyununa geç | **Koşulsuz çifte gider** — eli neye benzerse benzesin |
| **Topla** | Atılan taşı al | Kural izin verdiği sürece yerden alır, desteye gitmez |
| **Çek** | Desteden çek | Yerdeki taşa dokunmaz |
| **Taşla** | Elini boşalt, besle | Çıkmış taşları ve kendi çiftini bozarak atar — **işlek taş asla atmaz** |
| **Açtırma** | Karşıyı açtırma | Çift hakkı sorusunda "çift de" der, taşı vermez |
| **Serbest** | Emri kaldır | Kendi kararıyla oynar |

- Emirler **koltuk başına** tutulur, iki takımın kanalı ayrıdır.
- Hem botlar hem insanlar emir alır ve emir verir. Bot, eli uygunsa eşine
  kendiliğinden emir yollar ("5 çiftim var — sen de çifte git.").
- Aynı düğmeye ikinci kez basmak emri kaldırır.
- "Taşla" emri bile **işlek taş attırmaz**: 71 ceza yazdıracağı için bot o taşa
  dokunmaz. İnsan oyuncu zaten atarken uyarı alır.

---

## 12. Seyirci (çok oyunculu)

Masada oturmayan herkes **seyircidir**. Ayrı bir "yancı" rolü yoktur.

| | Oyuncu | Seyirci |
|---|---|---|
| Kendi eli | görür | — |
| Başkasının eli | görmez | görmez |
| Yere açılan perler | görür | **görür** |
| Atılan taşlar | görür | **görür** |
| Gösterge, okey, taş sayıları | görür | **görür** |
| Skorlar ve tur geçmişi | görür | **görür** |
| Hamle yapmak | yapar | yapamaz |

- Seyirci **hiç kimsenin elini görmez** — kendi koltuğu olmadığı için de görecek
  bir eli yoktur. Oyuncuya özel kayıt satırları ona genel hâliyle görünür:
  "Tukce desteden çekti" der, çekilen taşın adını yazmaz.
- Boş koltuk varsa seyirci **oturabilir**; oyun başlamış olsa da olur, o koltuğa
  bakan botun elini devralır. Oturduğu anda kendi elini görmeye başlar.
- Masa doluyken katılmak isteyen kendiliğinden seyirci olur.
- Seyirci masadan istediği an ayrılabilir.
- İleride sohbet eklenirse seyirci de mesaj yazabilecek.

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

### 13.1 Çarpanlar tek yerde

Bütün el sonu çarpanları motorun başındaki `KAT` nesnesindedir:

```js
const KAT = {
  ciftBitis:   2,   // çiftle bitirme
  eldenBitis:  2,   // kimse açmadan elden bitirme
  okeyAtis:    2,   // okey atarak bitirme
  ciftOkey:    4,   // çift okey atarak bitirme
  ciftAcamadi: 2    // çift deyip açamayanın kendi cezası
};
```

Masanızda başka türlü oynanıyorsa yalnız bu sayılar değiştirilir; `endHand`
ve puan satırları buradan beslenir. Çarpanları koda gömmeyin.

`w.openedNow` alanı "bu turda açtı" demektir; her turun başında sıfırlanır.
Elden bitme kontrolü buna bakar.

## 14. Uygulama notu — takoz sunucuda yoktur

Taş dizilişi (`S.rack`) **yalnız oyuncunun tarayıcısında** yaşar. "Çift diz",
"Seriye çevir", sürükle-bırak — hiçbiri sunucuya gitmez; sunucudaki `S.rack`
ilk dağıtım düzeninde kalır.

Sonuç: takoza bakan bir hamle sunucuda `rackBlocks()` çağırarak yazılamaz.
Grupları **istemci hesaplar**, taş id'si olarak yollar, sunucu id'lerden taşları
bulur. `put`, `open` ve `ciftindir` hamleleri böyle çalışır.

Yeni bir "takozdan bul" özelliği eklenirken bu kurala uyulmalıdır.
