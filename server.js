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
const AWOL_MS    = 70000;    // bu kadar süre hiç yoklama gelmezse oyuncu kopmuş sayılır
const DEAD_MS    = 300000;   // odadaki tüm insanlar bu kadar süre yoksa oda silinir
const SWEEP_MS   = 10000;    // kontrol sıklığı

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
    // Koltuğu olmayanlar. yanci=null ise sade seyirci (sadece masayı görür),
    // yanci=koltuk ise o oyuncunun yancısı (ONUN elini de görür, akıl verir).
    watchers: [],                      // {pid, name, lastSeen, yanci}
    yanciKapali: [false, false, false, false],  // oyuncu yancı yerini kapatabilir
    oneri: [null, null, null, null],   // yancıdan oyuncuya son tavsiye
    owner: null,                       // oda sahibinin pid'i (koltuk değişse de sabit)
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
  ctx.log = (m, big) => {
    room.log.push({ m: String(m), big: !!big, t: Date.now() });
    if (room.log.length > 200) room.log.shift();
    push(room);
  };
  ctx.render = () => push(room);
  ctx.notice = () => {};
  ctx.syncTimer = () => {};
  ctx.showVeil = (title, html, btn, fn, genis) => {
    // Maç sonunda tam puan tablosu gönderiliyor; geniş kart isteniyor.
    room.pendingNext = { title, html, fn, wide: !!genis, btn: btn || 'Devam' };
    push(room);
  };
  ctx.askVeil = (title, html, buttons) => {
    const seat = (api.S.askSeat != null) ? api.S.askSeat : api.self;
    // actor: soruyu doğuran hamleyi yapan koltuk (soruyu CEVAPLAYAN değil).
    // Cevap dönünce motor bu koltukla devam etmeli, yoksa açış yanlış kişiye yazılır.
    // auto: cevap veren koltuk kopup bota devredilirse basılacak güvenli düğme
    // (her iki soruda da altın renkli olan seçenek "durumu büyütmeyen" cevaptır).
    const auto = buttons.findIndex(b => b.cls === 'gold');
    room.pendingAsk = {
      seat, actor: api.self, auto: auto < 0 ? buttons.length - 1 : auto,
      title, html, buttons: buttons.map(b => b.t), fns: buttons
    };
    api.S.askSeat = null;
    push(room);
  };
  ctx.rollDice = (cb) => cb(Math.floor(Math.random() * 4));

  rooms.set(code, room);
  return room;
}

function seatOf(room, pid) {
  return room.seats.findIndex(s => s && s.pid === pid);
}

function yanciOf(room, seat) {
  return (room.watchers || []).find(w => w.yanci === seat) || null;
}
function watcherOf(room, pid) {
  return (room.watchers || []).findIndex(w => w && w.pid === pid);
}
// Oda sahibi masadan ayrılırsa yetkiyi masadaki başka bir insana devret.
function devretSahiplik(room, ayrilanPid) {
  if (room.owner !== ayrilanPid) return;
  const yeni = room.seats.find(Boolean) || (room.watchers || [])[0];
  room.owner = yeni ? yeni.pid : null;
  if (yeni) room.log.push({ m: `· Masa sahipliği ${yeni.name} adlı oyuncuya geçti.`, t: Date.now() });
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

// Kim ne görür: oturan kendi elini, yancı yanına oturduğu oyuncunun elini,
// sade seyirci hiçbir el görmez.
function bakisFor(room, pid) {
  const seat = seatOf(room, pid);
  if (seat >= 0) return viewFor(room, seat);
  const wi = watcherOf(room, pid);
  if (wi < 0) return null;
  const w = room.watchers[wi];
  if (w.yanci != null && room.seats[w.yanci]) {
    const v = viewFor(room, w.yanci);
    v.yanci = w.yanci;                       // kimin yancısıyım
    v.yanciAdi = room.seats[w.yanci].name;
    v.readOnly = true;                       // hamle yapamaz
    v.owner = false;
    v.ask = null;                            // soruyu oyuncu cevaplar
    v.snap = false;
    v.watcher = false;
    return v;
  }
  const v = viewFor(room, -1);
  v.yanci = null;
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
    freeSeats: room.seats.map((x, i) => (x ? -1 : i)).filter(i => i >= 0),
    watcherCount: (room.watchers || []).length,
    yanciKapali: room.yanciKapali.slice(),
    yancilar: [0, 1, 2, 3].map(i => { const y = yanciOf(room, i); return y ? y.name : null; }),
    oneri: seat >= 0 ? room.oneri[seat] : null,
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
        openPoints: p.openPoints, openPairs: p.openPairs,
        procLog: [], procMap: {}, proc: p.proc,
        mustOpen: false, pendingLay: null, mustRelay: null, okeyDebt: null,
        layNow: false, retracted: false, tookToOpen: false, fine: p.fine
      };
    }),
    log: room.log.slice(-40),
    ask: room.pendingAsk && room.pendingAsk.seat === seat
      ? { title: room.pendingAsk.title, html: room.pendingAsk.html, buttons: room.pendingAsk.buttons }
      : null,
    lastDraw: (S.turn === seat && S.lastDraw) ? { from: S.lastDraw.from } : null,
    // "Taşı topla" düğmesi S.snap'e bakıyor. Snapshot sunucuda duruyor ve
    // istemciye hiç gitmiyordu; bu yüzden düğme çok oyuncuda hep sönüktü.
    // İçeriğini göndermeye gerek yok, hakkın var mı bilgisi yeterli.
    snap: !!(S.turn === seat && S.snap),
    next: room.pendingNext || null
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
  S.dealer = Math.floor(Math.random() * 4);
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
  put:     (api, d) => { stage(api, d.groups); api.doPut(); },
  open:    (api, d) => { stage(api, d.groups); api.doOpen(!!d.finish); },
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

function doAction(room, seat, type, data) {
  const api = room.api;
  const S = api.S;
  if (S.over) return { ok: false, err: 'El bitti, yeni eli bekle.' };
  if (S.turn !== seat) return { ok: false, err: 'Sıra sende değil.' };
  const fn = ACTIONS[type];
  if (!fn) return { ok: false, err: 'Bilinmeyen hamle.' };

  S.busy = false;
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

/* ---------- kopma denetimi ----------
   Uzun yoklamanın boşa çıkması kopma DEĞİLDİR; oyunda 25 sn hiçbir değişiklik
   olmaması gayet normaldir. Kopma, oyuncudan hiç yoklama isteği gelmemesidir.
   Bu yüzden karar burada, ayrı bir süpürmede veriliyor.                        */
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

    let degisti = false;
    room.seats.forEach((s, i) => {
      if (!s) return;                        // zaten bot koltuğu
      if (S.players[i].bot) return;          // zaten bota devredilmiş
      if (now - (s.lastSeen || 0) < AWOL_MS) return;
      S.players[i].bot = true;
      room.log.push({ m: `· ${s.name} bağlantısı koptu, yerine bot bakıyor.`, t: now });
      degisti = true;
    });

    if (degisti) {
      // Soru, kopan oyuncuya sorulmuş olabilir. Kimse cevaplayamayacağı için
      // masa sonsuza kadar kilitlenir; güvenli seçeneği bot adına basıyoruz.
      if (room.pendingAsk && S.players[room.pendingAsk.seat].bot) {
        const ask = room.pendingAsk;
        room.pendingAsk = null;
        room.log.push({ m: `· ${S.players[ask.seat].name} cevap veremedi — soru kendiliğinden geçildi.`, t: now });
        const aktor = ask.actor != null ? ask.actor : ask.seat;
        room.api.setSelf(aktor);
        try { ask.fns[ask.auto].fn(); } catch (_) {}
        if (!room.pendingAsk) stagingGeriVer(room.api, aktor);
        room.api.setSelf(0);
      }
      push(room);
      if (!S.over && S.players[S.turn].bot) {
        S.busy = false;
        try { room.api.botTurn(); } catch (_) {}
      }
    }
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
    const room = makeRoom(!!d.teams);
    const pid = 'p' + (++nextRoom) + Math.random().toString(36).slice(2, 7);
    room.seats[0] = { pid, name: (d.name || 'Oyuncu').slice(0, 12), lastSeen: Date.now() };
    room.owner = pid;
    return send(res, 200, { code: room.code, pid, seat: 0 });
  }

  // Odaya GİRMEDEN durumuna bakmak: davet linkini açan kişi önce koltukları
  // ve kimin yancı kabul ettiğini görsün, rolünü ona göre seçsin.
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
      yanciKapali: room.yanciKapali.slice(),
      yancilar: [0, 1, 2, 3].map(i => { const y = yanciOf(room, i); return y ? y.name : null; }),
      watcherCount: room.watchers.length
    });
  }

  if (p === '/api/join' && req.method === 'POST') {
    const d = await readBody(req);
    const room = rooms.get(String(d.code || '').toUpperCase());
    if (!room) return send(res, 404, { err: 'Oda bulunamadı.' });
    const ad = (d.name || 'Oyuncu').slice(0, 12);
    const pid = 'p' + (++nextRoom) + Math.random().toString(36).slice(2, 7);
    const rol = String(d.rol || 'oyuncu');

    // Seyirci olarak katılmak isteyen: boş koltuk olsa da oturmaz
    if (rol === 'seyirci') {
      room.watchers.push({ pid, name: ad, lastSeen: Date.now(), yanci: null });
      room.log.push({ m: `· ${ad} masayı izlemeye başladı.`, t: Date.now() });
      push(room);
      return send(res, 200, { code: room.code, pid, seat: -1, watcher: true, rol });
    }

    // Yancı olarak katılmak isteyen: kimin yancısı olacağını seçmiş olmalı
    if (rol === 'yanci') {
      const hedef = parseInt(d.yanciSeat, 10);
      if (!(hedef >= 0 && hedef < 4)) return send(res, 400, { err: 'Kimin yancısı olacağını seç.' });
      if (!room.seats[hedef]) return send(res, 400, { err: 'O koltukta insan yok.' });
      if (room.yanciKapali[hedef]) return send(res, 400, { err: 'O oyuncu yancı istemiyor.' });
      if (yanciOf(room, hedef)) return send(res, 400, { err: 'O oyuncunun yancısı zaten var.' });
      room.watchers.push({ pid, name: ad, lastSeen: Date.now(), yanci: hedef });
      room.log.push({ m: `· ${ad}, ${room.seats[hedef].name} adlı oyuncunun yancısı oldu.`, t: Date.now() });
      push(room);
      return send(res, 200, { code: room.code, pid, seat: -1, watcher: false, yanci: hedef, rol });
    }

    const seat = room.seats.findIndex(s => !s);
    // Boş koltuk varsa otur — oyun başlamış olsa bile (o koltuğa bot bakıyordur).
    // Boş koltuk yoksa masaya SEYİRCİ olarak katıl, biri ayrılınca oturursun.
    if (seat >= 0) {
      room.seats[seat] = { pid, name: ad, lastSeen: Date.now() };
      if (room.started) {
        room.api.S.players[seat].bot = false;
        room.api.setNames(room.seats.map((x, i) => x ? x.name : 'Bot ' + (i + 1)));
        room.log.push({ m: `· ${ad} boş koltuğa oturdu.`, t: Date.now() });
      }
      push(room);
      return send(res, 200, { code: room.code, pid, seat, watcher: false });
    }
    room.watchers.push({ pid, name: ad, lastSeen: Date.now(), yanci: null });
    push(room);
    return send(res, 200, { code: room.code, pid, seat: -1, watcher: true });
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
    if (cur >= 0) {
      room.seats[hedef] = room.seats[cur];
      room.seats[cur] = null;
    } else {
      room.seats[hedef] = room.watchers.splice(wi, 1)[0];
      delete room.seats[hedef].yanci;          // artık oyuncu, yancı değil
    }
    room.seats[hedef].lastSeen = Date.now();
    if (room.started) {
      room.api.S.players[hedef].bot = false;
      room.api.setNames(room.seats.map((x, i) => x ? x.name : 'Bot ' + (i + 1)));
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

  // Seyirci bir oyuncunun yancısı olur — ya da yancılığı bırakır (seat: -1)
  if (p === '/api/yanci' && req.method === 'POST') {
    const d = await readBody(req);
    const room = rooms.get(String(d.code || '').toUpperCase());
    if (!room) return send(res, 404, { err: 'Oda yok.' });
    const wi = watcherOf(room, d.pid);
    if (wi < 0) return send(res, 403, { err: 'Masada oturuyorsun, yancı olamazsın.' });
    const w = room.watchers[wi];
    const hedef = parseInt(d.seat, 10);
    if (!(hedef >= 0 && hedef < 4)) {                 // yancılıktan çık
      if (w.yanci != null) room.log.push({ m: `· ${w.name} yancılıktan çıktı.`, t: Date.now() });
      w.yanci = null; push(room);
      return send(res, 200, { ok: true, yanci: null });
    }
    if (!room.seats[hedef]) return send(res, 400, { err: 'O koltukta insan yok.' });
    if (room.yanciKapali[hedef]) return send(res, 400, { err: 'O oyuncu yancı istemiyor.' });
    const varOlan = yanciOf(room, hedef);
    if (varOlan && varOlan !== w) return send(res, 400, { err: 'O oyuncunun yancısı zaten var.' });
    w.yanci = hedef;
    room.log.push({ m: `· ${w.name}, ${room.seats[hedef].name} adlı oyuncunun yancısı oldu.`, t: Date.now() });
    push(room);
    return send(res, 200, { ok: true, yanci: hedef });
  }

  // Oyuncu kendi yancı yerini açar / kapatır
  if (p === '/api/yancikapat' && req.method === 'POST') {
    const d = await readBody(req);
    const room = rooms.get(String(d.code || '').toUpperCase());
    if (!room) return send(res, 404, { err: 'Oda yok.' });
    const seat = seatOf(room, d.pid);
    if (seat < 0) return send(res, 403, { err: 'Masada değilsin.' });
    room.yanciKapali[seat] = !!d.kapali;
    if (d.kapali) {
      const y = yanciOf(room, seat);
      if (y) y.yanci = null;
      room.oneri[seat] = null;
    }
    room.log.push({ m: `· ${room.seats[seat].name} yancı yerini ${d.kapali ? 'kapattı' : 'açtı'}.`, t: Date.now() });
    push(room);
    return send(res, 200, { ok: true, kapali: room.yanciKapali[seat] });
  }

  // Oyuncu yancısını kovar
  if (p === '/api/yancikov' && req.method === 'POST') {
    const d = await readBody(req);
    const room = rooms.get(String(d.code || '').toUpperCase());
    if (!room) return send(res, 404, { err: 'Oda yok.' });
    const seat = seatOf(room, d.pid);
    if (seat < 0) return send(res, 403, { err: 'Masada değilsin.' });
    const y = yanciOf(room, seat);
    if (!y) return send(res, 400, { err: 'Yancın yok.' });
    y.yanci = null;
    room.oneri[seat] = null;
    room.log.push({ m: `· ${room.seats[seat].name}, yancısı ${y.name} adlı kişiyi kaldırdı.`, t: Date.now() });
    push(room);
    return send(res, 200, { ok: true });
  }

  // Yancıdan oyuncusuna tavsiye — sadece o oyuncu görür, masaya yayılmaz
  if (p === '/api/oneri' && req.method === 'POST') {
    const d = await readBody(req);
    const room = rooms.get(String(d.code || '').toUpperCase());
    if (!room) return send(res, 404, { err: 'Oda yok.' });
    const wi = watcherOf(room, d.pid);
    if (wi < 0) return send(res, 403, { err: 'Yancı değilsin.' });
    const w = room.watchers[wi];
    if (w.yanci == null || !room.seats[w.yanci]) return send(res, 400, { err: 'Oyuncun masada yok.' });
    const metin = String(d.metin || '').slice(0, 60).trim();
    if (!metin) return send(res, 400, { err: 'Boş tavsiye.' });
    room.oneri[w.yanci] = { kim: w.name, metin, t: Date.now() };
    push(room);
    return send(res, 200, { ok: true });
  }

  if (p === '/api/leave' && req.method === 'POST') {
    const d = await readBody(req);
    const room = rooms.get(String(d.code || '').toUpperCase());
    if (!room) return send(res, 404, { err: 'Oda yok.' });
    const seat = seatOf(room, d.pid);
    const wi = watcherOf(room, d.pid);
    if (seat < 0 && wi < 0) return send(res, 403, { err: 'Masada değilsin.' });
    if (wi >= 0) {                               // seyirci sessizce ayrılır
      room.watchers.splice(wi, 1);
      push(room);
      return send(res, 200, { ok: true, left: true });
    }
    const ad = room.seats[seat].name;
    room.watchers.forEach(w => { if (w.yanci === seat) w.yanci = null; });
    room.yanciKapali[seat] = false;
    room.oneri[seat] = null;
    room.seats[seat] = null;                     // koltuk BOŞALIR, başkası oturabilir
    devretSahiplik(room, d.pid);
    if (room.started) {
      room.api.S.players[seat].bot = true;       // eli bot devralır, oyun durmaz
      room.api.setNames(room.seats.map((x, i) => x ? x.name : 'Bot ' + (i + 1)));
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
    if (seat >= 0) room.seats[seat].lastSeen = Date.now();
    const fn = room.pendingNext.fn;
    room.pendingNext = null;
    try { fn(); } catch (e) {}
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
