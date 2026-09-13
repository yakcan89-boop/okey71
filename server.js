/* 71 Okey — özel oda sunucusu
   Kurulum gerekmez, sadece: node server.js
   Aynı klasörde okey71.html (ya da index.html) bulunmalı. */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const PORT = process.env.PORT || 3000;
const HTML_PATH = ['okey71.html', 'index.html']
  .map(f => path.join(__dirname, f))
  .find(f => fs.existsSync(f));
if (!HTML_PATH) { console.error('okey71.html bulunamadı'); process.exit(1); }

const HTML   = fs.readFileSync(HTML_PATH, 'utf8');
const SCRIPT = HTML.match(/<script>([\s\S]*?)<\/script>/)[1];

/* ---------- zaman ayarları ---------- */
const POLL_MS    = 25000;    // uzun yoklamanın boşa çıkma süresi
const TUR_MIN    = 40;       // ağ oyununda en kısa tur süresi (saniye)
const SORU_MS    = 20000;    // çift hakkı sorusu bu kadar beklerse kendiliğinden geçilir
const TAVSIYE_MS = 8000;     // eş tavsiyesi bu kadar beklerse "karışmam" sayılır
const BOT_MS     = 30000;    // bot koltuğu bu kadar takılırsa dürtülür
const PERDE_MS   = 90000;    // el sonu perdesi bu kadar beklerse kendiliğinden geçilir
const KACIRMA_SINIR = 3;     // üst üste bu kadar tur kaçıran masadan düşer

/* ---------- sohbet ----------
   Serbest metin YOK: istemci yalnız bu listenin sırasını yollar. Böylece
   kaçırılmamış HTML, küfür, uzun mesaj ve taş söyleme derdi hiç doğmuyor.
   Listede olmayan bir sıra gelirse atılır. */
const SOHBET = ['Seri lütfen', 'Tebrikler'];
const SOHBET_MAX  = 30;      // eski mesajlar bunun üstünde silinir
const SOHBET_ARA  = 3000;    // aynı kişi bu aralıktan sık yazamaz
const SOHBET_UZUN = 35;      // serbest mesajda en fazla bu kadar karakter
/* Süre KAPALIYKEN çalışan sessiz emniyet. Ekranda sayaç görünmez, kimse
   acele etmez; ama biri telefonu bırakıp giderse masa kilitlenmesin diye
   sunucu bu süreden sonra yine de oynatır ve bunu kaçırma sayar. */
const SESSIZ_MS  = 180000;   // 3 dakika
const DEAD_MS    = 300000;   // odadaki tüm insanlar bu kadar süre yoksa oda silinir
const SWEEP_MS   = 2000;     // kontrol sıklığı (sıra saati buna bakıyor)

/* ---------- sunucuda çalışan sahte ekran ---------- */
function stubEl() {
  const el = {
    children: [], dataset: {}, style: {}, textContent: '', innerHTML: '',
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    appendChild(c){ this.children.push(c); return c; },
    addEventListener(){}, removeEventListener(){}, closest(){ return null; },
    getBoundingClientRect(){ return {left:0,top:0,right:0,bottom:0,width:0,height:0}; },
    setPointerCapture(){}, focus(){}, onclick: null,
    offsetLeft: 0, offsetWidth: 0, parentNode: null
  };
  el.parentNode = el;
  return el;
}

/* ---------- oda ---------- */
let nextRoom = 0;
const rooms = new Map();

function roomCode() {
  const s = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 4; i++) c += s[Math.floor(Math.random() * s.length)];
  return rooms.has(c) ? roomCode() : c;
}

function makeRoom(teams) {
  const code = roomCode();
  const room = {
    code, teams: !!teams,
    hands: 8,                          // kaç el oynanacak (3-8), oda sahibi seçer
    seats: [null, null, null, null],   // {pid, name, lastSeen} ya da null (bot)
    // Koltuğu olmayanlar: seyirciler. Masayı, yere inen perleri, atılan
    // taşları ve skorları görürler; kimsenin elini görmezler.
    watchers: [],                      // {pid, name, lastSeen}
    owner: null,                       // oda sahibinin pid'i (koltuk değişse de sabit)
    sira: 0,                           // katılım sırası sayacı (sahiplik devri buna bakar)
    sohbet: [],                        // {ad, i, seyirci, t} — oyun kaydından AYRI
    // Süre KAPALI başlar; oda sahibi isterse oyun içinde açar. Kapalıyken
    // sessiz emniyet (SESSIZ_MS) masayı korumaya devam eder.
    timerSec: 0,
    // Sıra saati SUNUCUDA işler: tarayıcı kapalı olsa da süre dolar ve
    // oyuncu adına oynanır. Eskiden sayaç yalnız istemcideydi; sekmesini
    // kapatanın süresi hiç dolmuyor, masa duruyordu.
    turSeat: null,                     // saatin işlediği koltuk
    turBasladi: 0,                     // o koltuğun sırası ne zaman başladı
    soruBasladi: 0,                    // bekleyen sorunun başlangıcı
    perdeBasladi: 0,                   // bekleyen perdenin başlangıcı
    kacirdi: [0, 0, 0, 0],             // üst üste kaçırılan tur sayısı
    // Oyun BAŞLADIKTAN sonra masaya oturmak oda sahibinin onayına bağlıdır.
    // {pid, ad, seat, t} — seat: istenen koltuk (null = fark etmez)
    istekler: [],
    version: 0,
    waiters: [],                       // bekleyen uzun-yoklama istekleri
    log: [],
    started: false,
    createdAt: Date.now(),
    api: null
  };

  const ctx = {
    console: { log(){}, warn(){}, error(...a){ console.error('MOTOR HATASI:', ...a); } },
    Math, Date, JSON, String, Number, Array, Object, Set, Map, isNaN, parseInt, parseFloat,
    setTimeout: (f, d) => setTimeout(() => {
      try { f(); }
      catch (e) {
        console.error('MOTOR HATASI:', e.message);
        try { room.api.S.busy = false; } catch (_) {}
        try { push(room); } catch (_) {}
      }
    }, d),
    clearTimeout, setInterval: () => 0, clearInterval: () => {},
    confirm: () => true,
    __NET__: true
  };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  ctx.document = {
    getElementById: () => stubEl(),
    createElement: () => stubEl(),
    querySelectorAll: () => [],
    elementFromPoint: () => null,
    body: stubEl()
  };

  vm.createContext(ctx);
  vm.runInContext(SCRIPT, ctx, { filename: 'engine.js' });

  const api = ctx.__api;
  room.api = api;

  const S = api.S;
  // ozel = {seat, genel}: satırı yalnız o koltuk kendi hâliyle görür, geri
  // kalanlar "genel" metnini görür. Desteden çekilen taşın adı bu yolla gizli
  // kalıyor — eskiden ortak kayda düşüp herkese görünüyordu.
  ctx.log = (m, big, ozel) => {
    const metin = String(m);
    // "·" ile başlayan satırlar oyuncuya özel uyarılardır ("Yerden aldığın
    // Kırmızı 5'i indirmelisin" gibi) ve taş adı içerebilir. Bunlar masanın
    // ortak defterine düşerse herkes elini okur; yalnız hamleyi yapan görsün.
    const kisisel = metin.charAt(0) === '·';
    const aktif = room.api ? room.api.self : null;
    room.log.push({
      m: metin, big: !!big, t: Date.now(),
      seat: ozel && ozel.seat != null ? ozel.seat : (kisisel ? aktif : null),
      genel: ozel && ozel.genel ? String(ozel.genel) : null
    });
    if (room.log.length > 200) room.log.shift();
    push(room);
  };
  ctx.render = () => push(room);
  ctx.notice = () => {};
  ctx.syncTimer = () => {};
  ctx.showVeil = (title, html, btn, fn, genis) => {
    // Maç/tur sonunda tam puan tablosu gönderiliyor; geniş kart isteniyor.
    // btn bir dizi olabilir: tur sonu perdesi iki seçenek sunuyor. Bu perde
    // askVeil DEĞİL — masadaki herkes görür, ilk basan devam ettirir.
    const cok = Array.isArray(btn);
    room.pendingNext = {
      title, html, wide: !!genis,
      btns: cok ? btn.map(b => ({ t: b.t, cls: b.cls || '' }))
                : [{ t: btn || 'Devam', cls: '' }],
      fns:  cok ? btn.map(b => b.fn) : [fn]
    };
    push(room);
  };
  ctx.askVeil = (title, html, buttons, opts) => {
    const seat = (api.S.askSeat != null) ? api.S.askSeat : api.self;
    // actor: soruyu doğuran hamleyi yapan koltuk (soruyu CEVAPLAYAN değil).
    // Cevap dönünce motor bu koltukla devam etmeli, yoksa açış yanlış kişiye yazılır.
    // auto: süre dolunca basılacak güvenli düğme (altın renkli olan, durumu
    // büyütmeyen cevap). opts.autoIdx varsa o kullanılır.
    const gold = buttons.findIndex(b => b.cls === 'gold');
    const auto = (opts && opts.autoIdx != null) ? auto0(opts.autoIdx, buttons)
               : (gold < 0 ? buttons.length - 1 : gold);
    // TEK ZAMANLAYICI: soruların süresi burada değil, sıra saati süpürmesinde
    // işler. Eskiden biri burada setTimeout ile, öteki süpürmede sayıyordu;
    // aynı iş iki yerde durunca birini değiştirince öteki unutuluyordu.
    const sn = (opts && opts.sure) ? opts.sure * 1000 : SORU_MS;
    room.pendingAsk = {
      seat, actor: api.self, auto,
      sureMs: sn,
      basladi: Date.now(),
      bitis: Date.now() + sn,
      sure: Math.round(sn / 1000),
      title, html, buttons: buttons.map(b => b.t), fns: buttons
    };
    room.soruBasladi = Date.now();
    api.S.askSeat = null;
    push(room);
  };

  function auto0(i, buttons) {
    return (i >= 0 && i < buttons.length) ? i : buttons.length - 1;
  }

  ctx.rollDice = (cb) => cb(Math.floor(Math.random() * 4));

  rooms.set(code, room);
  return room;
}

/* Bir koltuğa kaçırma yazar; sınıra gelirse koltuğu boşaltır.
   Hem süresi dolan tur hem cevapsız kalan soru buraya düşer — ikisi de
   masayı bekletiyor, ikisi de aynı sayaca yazılmalı. */
function kacirmaYaz(room, seat, sebep) {
  const oturan = room.seats[seat];
  if (!oturan) return;                       // bot koltuğu: sayaç tutulmaz
  const now = Date.now();
  room.kacirdi[seat] = (room.kacirdi[seat] || 0) + 1;
  if (room.kacirdi[seat] < KACIRMA_SINIR) {
    room.log.push({ m: `· ${oturan.name} ${sebep} (${room.kacirdi[seat]}/${KACIRMA_SINIR}).`, t: now });
    return;
  }
  const ad = oturan.name, pid = oturan.pid;
  room.seats[seat] = null;
  room.kacirdi[seat] = 0;
  room.istekler = room.istekler.filter(x => x.pid !== pid);
  room.api.S.players[seat].bot = true;
  room.api.setNames(botAdlari(room));
  room.log.push({ m: `· ${ad} üst üste ${KACIRMA_SINIR} kez masayı bekletti — düştü, yerine bot bakıyor.`, t: now });
  devretSahiplik(room, pid);
  if (!room.seats.some(Boolean)) closeRoom(room, 'terk');
}

/* Oturma isteği kaydeder. Aynı kişi iki kez sıraya girmez. */
function istekEkle(room, pid, ad, seat) {
  const v = room.istekler.find(x => x.pid === pid);
  if (v) { v.seat = seat; v.t = Date.now(); return v; }
  const y = { pid, ad, seat, t: Date.now() };
  room.istekler.push(y);
  room.log.push({ m: `· ${ad} masaya oturmak istiyor — oda sahibinin onayı bekleniyor.`, t: Date.now() });
  return y;
}

/* İsteği kabul et: kişiyi koltuğa oturt. */
function istegiKabulEt(room, istek) {
  let hedef = (istek.seat != null && istek.seat >= 0 && istek.seat < 4 && !room.seats[istek.seat])
    ? istek.seat
    : room.seats.findIndex(x => !x);
  if (hedef < 0) return { err: 'Boş koltuk yok.' };
  const wi = room.watchers.findIndex(w => w.pid === istek.pid);
  const kisi = wi >= 0 ? room.watchers.splice(wi, 1)[0]
                       : { pid: istek.pid, name: istek.ad, lastSeen: Date.now(), sira: ++room.sira };
  kisi.lastSeen = Date.now();
  room.seats[hedef] = kisi;
  room.istekler = room.istekler.filter(x => x.pid !== istek.pid);
  if (room.started) {
    room.api.S.players[hedef].bot = false;
    room.api.setNames(botAdlari(room));
  }
  room.log.push({ m: `· ${kisi.name} masaya oturdu (oda sahibi onayladı).`, t: Date.now() });
  return { ok: true, seat: hedef };
}

function seatOf(room, pid) {
  return room.seats.findIndex(s => s && s.pid === pid);
}

// Boş koltukları dolduran botların adları. Gerçek oyuncular kendi adlarını
// girer; bu adlar yalnızca insan oturmayan koltuklara verilir.
const BOT_ADLARI = ['Yunus', 'Zeynep', 'Murat', 'Elif'];

function adGecerli(ad) {
  const t = String(ad || '').trim();
  if (t.length < 2) return null;
  return t.slice(0, 12);
}

// Boş koltuklara bot adı verirken masadaki insanların adlarıyla çakışma:
// oyuncu kendine "Murat" dediyse bot başka bir ad alır.
function botAdlari(room) {
  const insan = room.seats.filter(Boolean).map(x => x.name.toLocaleLowerCase('tr'));
  const havuz = BOT_ADLARI.concat(['Kemal', 'Selim', 'Ayla', 'Derya']);
  const kullanilan = insan.slice();
  return room.seats.map((x, i) => {
    if (x) return x.name;
    let ad = havuz.find(b => kullanilan.indexOf(b.toLocaleLowerCase('tr')) < 0) || ('Bot ' + (i + 1));
    kullanilan.push(ad.toLocaleLowerCase('tr'));
    return ad;
  });
}

function watcherOf(room, pid) {
  return (room.watchers || []).findIndex(w => w && w.pid === pid);
}
// Oda sahibi masadan ayrılırsa yetkiyi masadaki başka bir insana devret.
/* Sahiplik masaya KATILIM SIRASINA göre devredilir: ikinci giren, o da
   ayrılırsa üçüncü... Koltuktakiler önce gelir; masada kimse kalmazsa
   seyirciler arasından en eski giren devralır.
   "Masayı Kapat" bundan ayrıdır — orada oda tümden kapanır. */
function devretSahiplik(room, ayrilanPid) {
  if (room.owner !== ayrilanPid) return;
  const sirali = arr => arr.filter(Boolean).slice().sort((a, b) => (a.sira || 0) - (b.sira || 0));
  const yeni = sirali(room.seats)[0] || sirali(room.watchers)[0];
  room.owner = yeni ? yeni.pid : null;
  if (yeni) room.log.push({ m: `· Masa sahipliği ${yeni.name} adlı oyuncuya geçti.`, t: Date.now() });
  else room.log.push({ m: '· Masada kimse kalmadı.', t: Date.now() });
}

function closeRoom(room, sebep) {
  rooms.delete(room.code);
  const ws = room.waiters;
  room.waiters = [];
  for (const w of ws) {
    clearTimeout(w.timer);
    try { send(w.res, 200, { gone: true, reason: sebep || '' }); } catch (e) {}
  }
}

// Kim ne görür: oturan kendi elini görür. Seyirci hiçbir el görmez —
// masayı, yere inen perleri, atılan taşları ve skorları görür.
function bakisFor(room, pid) {
  const seat = seatOf(room, pid);
  if (seat >= 0) return viewFor(room, seat);
  const wi = watcherOf(room, pid);
  if (wi < 0) return null;
  room.watchers[wi].lastSeen = Date.now();

  const benimIstek = room.istekler.find(x => x.pid === pid) || null;

  // Oyun başlamadıysa seyirci bekleme panelini görür.
  if (!room.started) {
    const v = viewFor(room, -1);
    v.seyirci = true;
    v.bekliyor = !!benimIstek;
    return v;
  }
  // Oyun sürerken masa ÇİZİLİR. Ekranın çizilebilmesi için bir koltuk
  // gerekiyor; 0 numara çapa olarak kullanılıp bütün eller boşaltılıyor.
  const v = viewFor(room, 0);
  v.players.forEach(p => { p.hand = []; });
  v.log = room.log.slice(-40).map(e => {
    if (e.seat == null) return { m: e.m, big: e.big, t: e.t };
    return e.genel ? { m: e.genel, big: false, t: e.t } : null;
  }).filter(Boolean);
  v.seat = 0;
  v.seyirci = true;
  v.bekliyor = !!benimIstek;          // oturma isteğim onay bekliyor mu
  v.watcher = false;
  v.readOnly = true;
  v.owner = false;
  v.ask = null;
  v.next = null;
  v.snap = false;
  v.lastDraw = null;
  return v;
}

function viewFor(room, seat) {
  const S = room.api.S;
  const hide = t => ({ id: t.id, h: 1 });
  return {
    version: room.version,
    code: room.code,
    teams: room.teams,
    hands: room.hands,
    started: room.started,
    seat,
    watcher: seat < 0,
    odaKodu: room.code,
    sohbetSecenek: SOHBET,
    sohbetUzun: SOHBET_UZUN,
    sohbet: room.sohbet.map(m => ({ ad: m.ad, metin: m.metin, seyirci: m.seyirci, t: m.t })),
    timerSec: room.timerSec || 0,
    // Sayaç sunucuda işliyor; istemci yalnız gösteriyor.
    // Süre kapalıyken sayaç GÖSTERİLMEZ; sessiz emniyet arkada işler.
    kalanSure: (room.started && room.timerSec > 0 && !room.pendingAsk && !room.pendingNext)
      ? Math.max(0, Math.ceil(room.timerSec - (Date.now() - room.turBasladi) / 1000))
      : null,
    kacirdim: seat >= 0 ? (room.kacirdi[seat] || 0) : 0,
    kacirmaSinir: KACIRMA_SINIR,
    freeSeats: room.seats.map((x, i) => (x ? -1 : i)).filter(i => i >= 0),
    // Boş koltuklara oyun sırasında BOT bakar; istemci "bot oynuyor" yazsın.
    botKoltuklar: room.started
      ? room.seats.map((x, i) => (x ? -1 : i)).filter(i => i >= 0) : [],
    // Bekleyen oturma istekleri. Yalnız oda sahibi karar verir ama herkes görür.
    istekler: room.istekler.map(x => ({ pid: x.pid, ad: x.ad, seat: x.seat })),

    watcherCount: (room.watchers || []).length,
    owner: !!(seat >= 0 && room.seats[seat] && room.seats[seat].pid === room.owner),
    seats: room.seats.map((s, i) => ({ name: s ? s.name : 'Bot ' + (i + 1), bot: !s })),
    handNo: S.handNo, dealer: S.dealer, turn: S.turn, phase: S.phase,
    over: S.over, doubled: S.doubled, topOpen: S.topOpen, pairsMax: S.pairsMax,
    okey: S.okey, gosterge: S.gosterge,
    deck: S.deck.length, center: S.center.length,
    totals: S.totals, xm: S.xm, history: S.history,
    melds: S.melds.map(m => ({ tiles: m.tiles, owner: m.owner, pair: !!m.pair })),
    players: S.players.map((p, i) => {
      const ad = room.seats[i] ? room.seats[i].name : p.name;
      if (i === seat) {
        return Object.assign({}, p, { i, name: ad, hand: p.hand, count: p.hand.length });
      }
      return {
        i, name: ad,
        hand: p.hand.map(hide), count: p.hand.length,
        discards: p.discards,
        opened: p.opened, pairs: p.pairs, pairCount: p.pairCount,
        openPoints: p.openPoints, openPairs: p.openPairs, acilis: p.acilis,
        procLog: [], procMap: {}, proc: p.proc,
        mustOpen: false, pendingLay: null, mustRelay: null, okeyDebt: null,
        layNow: false, retracted: false, tookToOpen: false, fine: p.fine
      };
    }),
    log: room.log.slice(-40).map(e => {
      if (e.seat == null || e.seat === seat) return { m: e.m, big: e.big, t: e.t };
      return e.genel ? { m: e.genel, big: false, t: e.t } : null;
    }).filter(Boolean),
    ask: room.pendingAsk && room.pendingAsk.seat === seat
      ? { title: room.pendingAsk.title, html: room.pendingAsk.html, buttons: room.pendingAsk.buttons }
      : null,
    lastDraw: (S.turn === seat && S.lastDraw) ? { from: S.lastDraw.from } : null,
    // "Taşı topla" düğmesi S.snap'e bakıyor. Snapshot sunucuda duruyor ve
    // istemciye hiç gitmiyordu; bu yüzden düğme çok oyuncuda hep sönüktü.
    // İçeriğini göndermeye gerek yok, hakkın var mı bilgisi yeterli.
    snap: !!(S.turn === seat && S.snap),
    // Tur bilgisi istemciye gitmezse üstteki "1. Tur" rozeti ve skor
    // penceresindeki tur geçmişi herkeste boş kalır.
    currentTour: S.currentTour, turlar: S.turlar,
    // El bitince takoz bitirenin perlerini gösterir; herkese açık gider.
    bitirenTakoz: S.bitirenTakoz || null,
    // Eş emirleri koltuk başına: [0,1,2,3]. Herkes kendi bandını görür.
    emir: S.emir ? S.emir.slice() : [null, null, null, null],
    // fns sunucuda kalır; istemciye yalnız düğme etiketleri gider.
    next: room.pendingNext
      ? { title: room.pendingNext.title, html: room.pendingNext.html,
          wide: room.pendingNext.wide, btns: room.pendingNext.btns }
      : null
  };
}

function push(room) {
  room.version++;
  const ws = room.waiters;
  room.waiters = [];
  for (const w of ws) {
    clearTimeout(w.timer);
    try {
      const v = bakisFor(room, w.pid);
      if (!v) send(w.res, 200, { gone: true, reason: 'ayrildi' });
      else send(w.res, 200, v);
    } catch (e) {}
  }
}

function startRoom(room) {
  const api = room.api;
  const S = api.S;
  room.started = true;
  S.teams = room.teams;
  S.hands = room.hands || 8;
  S.totals = [0, 0, 0, 0];
  S.xm = [0, 0, 0, 0];
  S.history = [];
  S.handNo = 1;
  S.turlar = [];              // yeni masa: tur geçmişi sıfırdan
  S.currentTour = 1;
  S.dealer = Math.floor(Math.random() * 4);
  // Oyuncu adları el dağıtılmadan önce yerleşmeli — newHand adları buradan alıyor.
  // Boş koltuklara bot adı verilir; gerçek oyunculara asla bot adı atanmaz.
  api.setNames(botAdlari(room));
  api.newHand();
  S.players.forEach((p, i) => { p.bot = !room.seats[i]; });
  const now = Date.now();
  room.seats.forEach(s => { if (s) s.lastSeen = now; });
  const kisi = room.seats.filter(Boolean).length;
  room.log.push({
    m: `Oda ${room.code} — oyun başladı. ${kisi} kişi, ${4 - kisi} bot.`,
    big: true, t: now
  });
  push(room);
  if (S.players[S.turn].bot) setTimeout(() => room.api.botTurn(), 700);
}

const ACTIONS = {
  deck:    api => api.doDeck(),
  take:    api => api.doTake(),
  undo:    api => api.doUndo(),
  collect: api => api.doCollect(),
  okey:    api => api.doOkey(),
  process: (api, d) => { api.S.selected = new Set(d.ids || []); api.doProcess(); },
  // taşı elle belirli bir pere sürükleyerek işleme / o perdeki okeyi alma
  meldput: (api, d) => api.processInto(d.id, d.mi),
  // son iki taş okeyse ikisini birden atıp bitirmek
  ciftokey: (api) => api.doDoubleOkey(),
  // Takozdaki çiftleri yere indirme. Takoz düzeni yalnız istemcide olduğu
  // için grupları o hesaplar, buraya taş id'si olarak gelir.
  ciftindir: (api, d) => api.ciftIndirIds(d.groups),
  // "Çift Aç" — henüz açmamış oyuncu çiftle açar. Gruplar istemciden gelir.
  acikcift: (api, d) => { stage(api, d.groups); api.doOpen(); },
  // Eşine emir yollama (Topla / Çek / Taşla / Çifte git / Açtırma / Serbest).
  // Sıra beklemez: eş, kendi sırası olmasa da eşini yönlendirebilir.
  emir:    (api, d) => api.setEmir(d.m),
  put:     (api, d) => { stage(api, d.groups); api.doPut(); },
  open:    (api, d) => { stage(api, d.groups); api.doOpen(); },
  discard: (api, d) => { api.S.selected = new Set([d.id]); api.doDiscard(false); }
};

// Başarısız bir açış/koyma denemesinden sonra taşlar S.staging'de kalıyor ve
// oyuncunun elinden düşmüş oluyordu (tarayıcıda hazırlık alanı görünür, ağ
// üzerinden görünmüyor). Kalan varsa ele geri konuyor.
function stagingGeriVer(api, seat) {
  const S = api.S;
  if (!S.staging || !S.staging.length) return 0;
  const p = S.players[seat];
  let n = 0;
  for (const g of S.staging) {
    for (const t of g.tiles) {
      if (!p.hand.some(x => x.id === t.id)) { p.hand.push(t); n++; }
    }
  }
  S.staging = [];
  return n;
}

function stage(api, groups) {
  const S = api.S;
  stagingGeriVer(api, api.self);
  S.staging = [];
  if (!groups || !groups.length) return;
  const me = S.players[api.self];
  for (const ids of groups) {
    const tiles = ids.map(id => me.hand.find(t => t.id === id)).filter(Boolean);
    if (tiles.length < 2) continue;
    const v = tiles.length >= 3 ? api.validateMeld(tiles) : api.validatePair(tiles);
    if (!v) continue;
    S.staging.push({ tiles, points: v.points, pair: tiles.length === 2 });
    const set = new Set(ids);
    me.hand = me.hand.filter(t => !set.has(t.id));
  }
}

// Sıra beklemeden yapılabilen hamleler.
const SIRASIZ = { emir: 1 };

function doAction(room, seat, type, data) {
  const api = room.api;
  const S = api.S;
  if (S.over) return { ok: false, err: 'El bitti, yeni eli bekle.' };
  const fn = ACTIONS[type];
  if (!fn) return { ok: false, err: 'Bilinmeyen hamle.' };

  // Eşine emir vermek sıra beklemez — sıradaki eşine tam o an akıl vermeli.
  if (SIRASIZ[type]) {
    api.setSelf(seat);
    let sonuc = { ok: true };
    try { fn(api, data || {}); }
    catch (e) { sonuc = { ok: false, err: 'Hata: ' + e.message }; }
    api.setSelf(0);
    push(room);
    return sonuc;
  }

  if (S.turn !== seat) return { ok: false, err: 'Sıra sende değil.' };

  S.busy = false;
  room.kacirdi[seat] = 0;              // hamle yaptı: kaçırma sayacı sıfırlanır
  const before = { hand: S.players[seat].hand.length, turn: S.turn, phase: S.phase,
                   melds: S.melds.length, log: room.log.length };
  api.setSelf(seat);
  try { fn(api, data || {}); }
  catch (e) { stagingGeriVer(api, seat); api.setSelf(0); return { ok: false, err: 'Hata: ' + e.message }; }
  // Açış başarılıysa motor staging'i kendisi boşaltır. Hâlâ doluysa ya hamle
  // olmadı (baraj yetmedi vb.) ya da çift hakkı sorusu bekliyor. Soru yoksa
  // taşlar oyuncunun eline geri dönmeli, yoksa kayboluyorlar.
  if (!room.pendingAsk) stagingGeriVer(api, seat);
  api.setSelf(0);

  const after = { hand: S.players[seat].hand.length, turn: S.turn, phase: S.phase,
                  melds: S.melds.length };
  const changed = before.hand !== after.hand || before.turn !== after.turn ||
                  before.phase !== after.phase || before.melds !== after.melds;
  push(room);
  if (!changed) {
    const son = room.log.slice(before.log).map(l => l.m).filter(m => m.startsWith('·'));
    return { ok: false, err: son[0] || 'Bu hamle şu an yapılamıyor.' };
  }
  return { ok: true };
}

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise(resolve => {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } });
  });
}

/* ---------- sıra saati ve oda bakımı ----------
   Masayı durduran her şey buradan çözülür: süresi dolan tur, cevapsız kalan
   soru, kapanmayan perde, terk edilmiş oda. Bağlantı koptu diye kimse bota
   devredilmez — süreyi kaçıran düşer, sekmesi açık mı kapalı mı fark etmez. */
setInterval(() => {
  const now = Date.now();
  for (const room of Array.from(rooms.values())) {
    if (!room.started) {
      // henüz başlamamış ve kimse dokunmuyorsa odayı bir süre sonra topla
      const sonTemas = Math.max(room.createdAt,
        ...room.seats.filter(Boolean).map(s => s.lastSeen || 0));
      if (now - sonTemas > DEAD_MS) closeRoom(room, 'bos');
      continue;
    }

    const S = room.api.S;
    const insanlar = room.seats.filter(Boolean);

    // hiç kimse uzun süredir uğramıyorsa oda kendiliğinden kapansın
    if (insanlar.length && insanlar.every(s => now - (s.lastSeen || 0) > DEAD_MS)) {
      closeRoom(room, 'terk');
      continue;
    }

    /* ---------- SIRA SAATİ ----------
       Süre sunucuda işler. Tarayıcısı kapalı olsa da oyuncunun süresi dolar
       ve onun adına oynanır; masa durmaz. Üst üste KACIRMA_SINIR tur kaçıran
       masadan düşer, yerine bot bakar, geri dönmek için oda sahibinin izni
       gerekir (§12.1). */
    if (!S.over && !room.pendingAsk && !room.pendingNext) {
      const sira = S.turn;
      if (room.turSeat !== sira) { room.turSeat = sira; room.turBasladi = now; }

      const oturan = room.seats[sira];
      // Süre kapalıysa sayaç görünmez ama sessiz emniyet yine de işler.
      const sinir = room.timerSec > 0 ? room.timerSec * 1000 : SESSIZ_MS;
      const sessiz = room.timerSec <= 0;
      const sureDoldu = now - room.turBasladi > sinir;

      if (oturan && !S.players[sira].bot && sureDoldu) {
        room.api.setSelf(sira);
        try { room.api.autoPlay(); } catch (e) {}
        room.api.setSelf(0);
        room.turSeat = S.turn; room.turBasladi = now;
        kacirmaYaz(room, sira, sessiz ? 'uzun süre hamle yapmadı, onun adına oynandı'
                                      : 'süreyi kaçırdı');
        push(room);
      }

      // BOT EMNİYETİ: bot koltuğunda saat işlemiyordu (oturan null olduğu için).
      // Bot bir sebeple takılırsa masayı kurtaracak bir şey yoktu; dürtüyoruz.
      if (!oturan && now - room.turBasladi > BOT_MS) {
        room.turBasladi = now;
        S.busy = false;
        try { room.api.botTurn(); } catch (e) {}
        room.log.push({ m: '· Bot takıldı, oyun ilerletildi.', t: now });
        push(room);
      }
    }

    /* Bekleyen soru/perde kimseyi bekletmesin: sahibi cevaplamazsa
       güvenli seçenek kendiliğinden işletilir. */
    if (room.pendingAsk) {
      if (!room.soruBasladi) room.soruBasladi = now;
      const soruSuresi = room.pendingAsk.sureMs || SORU_MS;
      if (now - room.soruBasladi > soruSuresi) {
        const ask = room.pendingAsk;
        room.pendingAsk = null; room.soruBasladi = 0;
        const aktor = ask.actor != null ? ask.actor : ask.seat;
        room.api.setSelf(aktor);
        try { ask.fns[ask.auto].fn(); } catch (_) {}
        if (!room.pendingAsk) stagingGeriVer(room.api, aktor);
        room.api.setSelf(0);
        // Cevapsız soru da masayı bekletir: aynı sayaca yazılır. Yoksa biri
        // her soruyu görmezden gelip her turda masayı bekletebiliyordu.
        kacirmaYaz(room, ask.seat, 'soruyu cevapsız bıraktı');
        room.turBasladi = now;
        push(room);
      }
    } else room.soruBasladi = 0;

    if (room.pendingNext) {
      if (!room.perdeBasladi) room.perdeBasladi = now;
      if (now - room.perdeBasladi > PERDE_MS) {
        const fns = room.pendingNext.fns || [];
        room.pendingNext = null; room.perdeBasladi = 0;
        room.log.push({ m: '· Perde uzun süre bekledi — kendiliğinden devam edildi.', t: now });
        room.api.setSelf(0);
        try { if (fns[0]) fns[0](); } catch (_) {}
        room.api.setSelf(0);
        room.turBasladi = now;
        push(room);
      }
    } else room.perdeBasladi = 0;
  }
}, SWEEP_MS);

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;

  if (p === '/' || p === '/index.html') {
    const page = HTML
      .replace('<body>', '<body><script>window.__NET__=1;</script>')
      .replace('</body>', '<script src="/net.js"></script></body>');
    return send(res, 200, page, 'text/html; charset=utf-8');
  }
  if (p === '/net.js') {
    return send(res, 200, fs.readFileSync(path.join(__dirname, 'net.js'), 'utf8'),
                'application/javascript; charset=utf-8');
  }

  if (p === '/api/create' && req.method === 'POST') {
    const d = await readBody(req);
    const ad = adGecerli(d.name);
    if (!ad) return send(res, 400, { err: 'En az 2 harfli bir ad yaz.' });
    const room = makeRoom(!!d.teams);
    const pid = 'p' + (++nextRoom) + Math.random().toString(36).slice(2, 7);
    room.seats[0] = { pid, name: ad, lastSeen: Date.now(), sira: ++room.sira };
    room.owner = pid;
    return send(res, 200, { code: room.code, pid, seat: 0 });
  }

  // Odaya GİRMEDEN durumuna bakmak: davet linkini açan kişi önce koltukları
  // kaç kişinin izlediğini görsün, oyuncu mu seyirci mi olacağına karar versin.
  if (p === '/api/oda' && req.method === 'GET') {
    const kod = String(u.searchParams.get('code') || '').toUpperCase();
    const room = rooms.get(kod);
    if (!room) return send(res, 404, { err: 'Oda bulunamadı.' });
    return send(res, 200, {
      code: room.code,
      started: room.started,
      teams: room.teams,
      hands: room.hands,
      seats: room.seats.map(x => x ? { name: x.name } : null),
      watcherCount: room.watchers.length
    });
  }

  if (p === '/api/join' && req.method === 'POST') {
    const d = await readBody(req);
    const room = rooms.get(String(d.code || '').toUpperCase());
    if (!room) return send(res, 404, { err: 'Oda bulunamadı.' });
    const ad = adGecerli(d.name);
    if (!ad) return send(res, 400, { err: 'En az 2 harfli bir ad yaz.' });
    const pid = 'p' + (++nextRoom) + Math.random().toString(36).slice(2, 7);
    const rol = String(d.rol || 'oyuncu');

    // Seyirci olarak katılmak isteyen: boş koltuk olsa da oturmaz
    if (rol === 'seyirci') {
      room.watchers.push({ pid, name: ad, lastSeen: Date.now(), sira: ++room.sira });
      room.log.push({ m: `· ${ad} masayı izlemeye başladı.`, t: Date.now() });
      push(room);
      return send(res, 200, { code: room.code, pid, seat: -1, watcher: true, rol });
    }

    const seat = room.seats.findIndex(s => !s);

    // Oyun BAŞLAMADIYSA boş koltuğa doğrudan oturulur — lobide izin gerekmez.
    if (!room.started && seat >= 0) {
      room.seats[seat] = { pid, name: ad, lastSeen: Date.now(), sira: ++room.sira };
      push(room);
      return send(res, 200, { code: room.code, pid, seat, watcher: false });
    }

    // Oyun başladıysa: seyirci olarak girer, oturmak için ODA SAHİBİNİN
    // onayı gerekir. Masadan kendi isteğiyle ayrılan biri de buradan döner.
    room.watchers.push({ pid, name: ad, lastSeen: Date.now(), sira: ++room.sira });
    istekEkle(room, pid, ad, seat >= 0 ? seat : null);
    push(room);
    return send(res, 200, {
      code: room.code, pid, seat: -1, watcher: true,
      bekliyor: true, mesaj: 'Oda sahibinin onayı bekleniyor.'
    });
  }

  if (p === '/api/mode' && req.method === 'POST') {
    const d = await readBody(req);
    const room = rooms.get(String(d.code || '').toUpperCase());
    if (!room) return send(res, 404, { err: 'Oda yok.' });
    if (d.pid !== room.owner) return send(res, 403, { err: 'Sadece oda sahibi değiştirir.' });
    if (room.started) return send(res, 400, { err: 'Oyun başladı.' });
    if (d.teams !== undefined) room.teams = !!d.teams;
    if (d.hands !== undefined) {
      const n = Math.round(Number(d.hands));
      if (n >= 3 && n <= 8) room.hands = n;
    }
    push(room);
    return send(res, 200, { ok: true, teams: room.teams, hands: room.hands });
  }

  if (p === '/api/seat' && req.method === 'POST') {
    const d = await readBody(req);
    const room = rooms.get(String(d.code || '').toUpperCase());
    if (!room) return send(res, 404, { err: 'Oda yok.' });
    const cur = seatOf(room, d.pid);
    const wi  = watcherOf(room, d.pid);
    if (cur < 0 && wi < 0) return send(res, 403, { err: 'Masada değilsin.' });
    const hedef = parseInt(d.seat, 10);
    if (!(hedef >= 0 && hedef < 4)) return send(res, 400, { err: 'Geçersiz koltuk.' });
    if (hedef === cur) return send(res, 200, { ok: true, seat: cur });
    if (room.seats[hedef]) return send(res, 400, { err: 'O koltuk dolu.' });
    // Oyun başladıktan sonra oturan kişi, o koltuğa bakan botun elini devralır.
    if (room.started && cur >= 0) {
      return send(res, 400, { err: 'Oyun başladı, koltuk değiştiremezsin.' });
    }
    // Oyun başladıysa seyirci doğrudan oturamaz: oda sahibi onaylamalı.
    if (room.started && cur < 0) {
      const w = room.watchers[wi];
      istekEkle(room, d.pid, w.name, hedef);
      push(room);
      return send(res, 200, { ok: true, bekliyor: true,
                              mesaj: 'Oda sahibinin onayı bekleniyor.' });
    }
    if (cur >= 0) {
      room.seats[hedef] = room.seats[cur];
      room.seats[cur] = null;
    } else {
      room.seats[hedef] = room.watchers.splice(wi, 1)[0];
    }
    room.seats[hedef].lastSeen = Date.now();
    if (room.started) {
      room.api.S.players[hedef].bot = false;
      room.api.setNames(botAdlari(room));
      room.log.push({ m: `· ${room.seats[hedef].name} boş koltuğa oturdu.`, t: Date.now() });
    }
    push(room);
    return send(res, 200, { ok: true, seat: hedef });
  }

  if (p === '/api/start' && req.method === 'POST') {
    const d = await readBody(req);
    const room = rooms.get(String(d.code || '').toUpperCase());
    if (!room) return send(res, 404, { err: 'Oda yok.' });
    if (d.pid !== room.owner) return send(res, 403, { err: 'Sadece oda sahibi başlatır.' });
    if (room.started) return send(res, 400, { err: 'Zaten başladı.' });
    startRoom(room);
    return send(res, 200, { ok: true });
  }

  // Oda sahibi oturma isteğini onaylar ya da reddeder.
  // Sohbet: hazır cümle numarası gelir, metin değil.
  if (p === '/api/mesaj' && req.method === 'POST') {
    const d = await readBody(req);
    const room = rooms.get(String(d.code || '').toUpperCase());
    if (!room) return send(res, 404, { err: 'Oda yok.' });
    // İki yol var: hazır cümlenin sırası (i) ya da kısa serbest metin.
    let metin = null;
    if (d.metin != null) {
      // Serbest metin TEMİZLENİR: satır sonu, aşırı boşluk ve HTML'e yarayan
      // işaretler atılır, uzunluk kırpılır. Ekrana zaten textContent ile
      // basılıyor ama girdi tarafında da bırakmıyoruz.
      metin = String(d.metin)
        .replace(/[\r\n\t]/g, ' ')
        .replace(/[<>&"'`]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, SOHBET_UZUN);
      if (!metin) return send(res, 400, { err: 'Boş mesaj.' });
    } else {
      const i = parseInt(d.i, 10);
      if (!(i >= 0 && i < SOHBET.length)) return send(res, 400, { err: 'Geçersiz mesaj.' });
      metin = SOHBET[i];
    }

    const seat = seatOf(room, d.pid);
    const wi = watcherOf(room, d.pid);
    if (seat < 0 && wi < 0) return send(res, 403, { err: 'Masada değilsin.' });
    const kisi = seat >= 0 ? room.seats[seat] : room.watchers[wi];
    kisi.lastSeen = Date.now();

    const son = room.sohbet[room.sohbet.length - 1];
    const now = Date.now();
    // Aynı kişi arka arkaya aynı şeyi basmasın, ekranı doldurmasın.
    if (son && son.pid === d.pid && (son.metin === metin || now - son.t < SOHBET_ARA))
      return send(res, 200, { ok: true, atlandi: true });

    room.sohbet.push({ pid: d.pid, ad: kisi.name, metin, seyirci: seat < 0, t: now });
    if (room.sohbet.length > SOHBET_MAX) room.sohbet.shift();
    push(room);
    return send(res, 200, { ok: true });
  }

  // Tur süresi masanın ortak ayarıdır; yalnız oda sahibi değiştirir.
  if (p === '/api/sure' && req.method === 'POST') {
    const d = await readBody(req);
    const room = rooms.get(String(d.code || '').toUpperCase());
    if (!room) return send(res, 404, { err: 'Oda yok.' });
    if (d.pid !== room.owner) return send(res, 403, { err: 'Süreyi oda sahibi ayarlar.' });
    // 0 = kapalı (sessiz emniyet devreye girer). Açıksa en az TUR_MIN saniye.
    const ham = Math.round(Number(d.sn) || 0);
    const sn = ham <= 0 ? 0 : Math.max(TUR_MIN, Math.min(180, ham));
    room.timerSec = sn;
    if (room.api) room.api.S.timerSec = sn;
    room.turBasladi = Date.now();
    room.log.push({ m: sn ? `· Tur süresi ${sn} saniyeye ayarlandı.`
                          : '· Tur süresi kapatıldı — kimse acele etmesin.', t: Date.now() });
    push(room);
    return send(res, 200, { ok: true, timerSec: sn });
  }

  if (p === '/api/onay' && req.method === 'POST') {
    const d = await readBody(req);
    const room = rooms.get(String(d.code || '').toUpperCase());
    if (!room) return send(res, 404, { err: 'Oda yok.' });
    if (d.pid !== room.owner) return send(res, 403, { err: 'Bunu oda sahibi yapar.' });
    const istek = room.istekler.find(x => x.pid === d.hedefPid);
    if (!istek) return send(res, 404, { err: 'İstek bulunamadı.' });

    if (d.kabul === false) {
      room.istekler = room.istekler.filter(x => x.pid !== istek.pid);
      room.log.push({ m: `· ${istek.ad} masaya alınmadı.`, t: Date.now() });
      push(room);
      return send(res, 200, { ok: true, kabul: false });
    }
    const r = istegiKabulEt(room, istek);
    push(room);
    if (r.err) return send(res, 400, r);
    return send(res, 200, r);
  }

  if (p === '/api/leave' && req.method === 'POST') {
    const d = await readBody(req);
    const room = rooms.get(String(d.code || '').toUpperCase());
    if (!room) return send(res, 404, { err: 'Oda yok.' });
    const seat = seatOf(room, d.pid);
    const wi = watcherOf(room, d.pid);
    if (seat < 0 && wi < 0) return send(res, 403, { err: 'Masada değilsin.' });
    room.istekler = room.istekler.filter(x => x.pid !== d.pid);
    if (wi >= 0) {                               // seyirci sessizce ayrılır
      room.watchers.splice(wi, 1);
      push(room);
      return send(res, 200, { ok: true, left: true });
    }
    const ad = room.seats[seat].name;
    room.seats[seat] = null;                     // koltuk BOŞALIR, başkası oturabilir
    devretSahiplik(room, d.pid);
    if (room.started) {
      room.api.S.players[seat].bot = true;       // eli bot devralır, oyun durmaz
      room.api.setNames(botAdlari(room));
      room.log.push({ m: `· ${ad} masadan ayrıldı — koltuk boşaldı, yerine bot bakıyor.`, t: Date.now() });
    }
    push(room);
    const S = room.api.S;
    if (room.started && !S.over && S.players[S.turn].bot) {
      S.busy = false;
      try { room.api.botTurn(); } catch (_) {}
    }
    return send(res, 200, { ok: true, left: true });
  }

  if (p === '/api/close' && req.method === 'POST') {
    const d = await readBody(req);
    const room = rooms.get(String(d.code || '').toUpperCase());
    if (!room) return send(res, 404, { err: 'Oda yok.' });
    if (d.pid !== room.owner) return send(res, 403, { err: 'Sadece oda sahibi kapatabilir.' });
    closeRoom(room, 'kapatildi');
    return send(res, 200, { ok: true });
  }

  if (p === '/api/action' && req.method === 'POST') {
    const d = await readBody(req);
    const room = rooms.get(String(d.code || '').toUpperCase());
    if (!room || !room.started) return send(res, 400, { err: 'Oda hazır değil.' });
    const seat = seatOf(room, d.pid);
    if (seat < 0) return send(res, 403, { err: 'Masada değilsin.' });
    room.seats[seat].lastSeen = Date.now();
    return send(res, 200, doAction(room, seat, d.type, d.data));
  }

  if (p === '/api/answer' && req.method === 'POST') {
    const d = await readBody(req);
    const room = rooms.get(String(d.code || '').toUpperCase());
    if (!room || !room.pendingAsk) return send(res, 400, { err: 'Bekleyen soru yok.' });
    const seat = seatOf(room, d.pid);
    if (seat !== room.pendingAsk.seat) return send(res, 403, { err: 'Soru sana değil.' });
    room.seats[seat].lastSeen = Date.now();
    const ask = room.pendingAsk;
    room.pendingAsk = null;
    // Cevabı atıcı verdi ama devam eden hamle taşı ALAN oyuncunun hamlesi.
    // Motoru cevaplayanın koltuğuyla sürdürürsek açış yanlış oyuncuya yazılıyor.
    const aktor = ask.actor != null ? ask.actor : seat;
    room.api.setSelf(aktor);
    try { ask.fns[d.idx].fn(); } catch (e) {}
    if (!room.pendingAsk) stagingGeriVer(room.api, aktor);
    room.api.setSelf(0);
    push(room);
    return send(res, 200, { ok: true });
  }

  if (p === '/api/next' && req.method === 'POST') {
    const d = await readBody(req);
    const room = rooms.get(String(d.code || '').toUpperCase());
    if (!room || !room.pendingNext) return send(res, 400, { err: 'Bekleyen el yok.' });
    const seat = seatOf(room, d.pid);
    if (seat < 0) return send(res, 403, { err: 'Bunu masadakiler yapar.' });
    room.seats[seat].lastSeen = Date.now();
    const fns = room.pendingNext.fns || [];
    const idx = Math.max(0, Math.min(fns.length - 1, parseInt(d.idx, 10) || 0));
    const fn = fns[idx];
    room.pendingNext = null;
    // Düğmeye BASAN koltuk belli olmalı: seri bitirme oyu kime yazılacak
    // buna bakıyor. Eskiden hep 0 numaraya yazılıyordu.
    room.api.setSelf(seat);
    try { if (fn) fn(); } catch (e) {}
    room.api.setSelf(0);
    push(room);
    return send(res, 200, { ok: true });
  }

  if (p === '/poll') {
    const room = rooms.get(String(u.searchParams.get('code') || '').toUpperCase());
    const pid  = u.searchParams.get('pid');
    const v    = parseInt(u.searchParams.get('v') || '0', 10);
    if (!room) return send(res, 404, { err: 'Oda yok.' });

    const seat = seatOf(room, pid);
    const wi = watcherOf(room, pid);
    // Koltuğu da yok, seyirci de değilse masayla ilgisi kalmamıştır.
    // (Kendi isteğiyle ayrılan buraya düşer: geri giremez, yeniden katılması gerekir.)
    if (seat < 0 && wi < 0) return send(res, 403, { gone: true, reason: 'ayrildi' });

    if (seat >= 0) room.seats[seat].lastSeen = Date.now();
    else room.watchers[wi].lastSeen = Date.now();
    const S = room.api.S;

    // kopmuş sayılıp bota devredilen oyuncu geri döndüyse koltuğunu geri alsın
    if (seat >= 0 && room.started && S.players[seat].bot) {
      S.players[seat].bot = false;
      room.log.push({ m: `· ${room.seats[seat].name} geri döndü.`, t: Date.now() });
      push(room);
    }

    if (seat >= 0 && room.started && S.busy && room.seats[S.turn]) {
      S.busy = false;
      push(room);
    }
    if (room.version > v) {
      const g = bakisFor(room, pid);
      return send(res, 200, g || { gone: true, reason: 'ayrildi' });
    }

    const w = { pid, res };
    w.timer = setTimeout(() => {
      room.waiters = room.waiters.filter(x => x !== w);
      // Zaman aşımı kopma değildir: oyuncu hâlâ burada, sadece oyunda değişiklik yok.
      const sIndex = seatOf(room, pid);
      if (sIndex >= 0) room.seats[sIndex].lastSeen = Date.now();
      else { const wj = watcherOf(room, pid); if (wj >= 0) room.watchers[wj].lastSeen = Date.now(); }
      try { send(res, 200, { noChange: true, version: room.version }); } catch (e) {}
    }, POLL_MS);

    room.waiters.push(w);
    req.on('close', () => {
      clearTimeout(w.timer);
      room.waiters = room.waiters.filter(x => x !== w);
    });
    return;
  }

  send(res, 404, { err: 'yok' });
});

server.listen(PORT, () => {
  console.log('71 Okey sunucusu çalışıyor:  http://localhost:' + PORT);
});

module.exports = { server, rooms, makeRoom, startRoom, doAction, viewFor, closeRoom };
