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
    seats: [null, null, null, null],   // {pid, name} ya da null (bot)
    version: 0,
    waiters: [],                       // bekleyen uzun-yoklama istekleri
    log: [],
    started: false,
    api: null
  };

  const ctx = {
    console: { log(){}, warn(){}, error(...a){ console.error('MOTOR HATASI:', ...a); } },
    Math, Date, JSON, String, Number, Array, Object, Set, Map, isNaN, parseInt, parseFloat,
    setTimeout: (f, d) => setTimeout(() => {
      try { f(); }
      catch (e) {
        console.error('MOTOR HATASI:', e.message);
        try { room.api.S.busy = false; } catch (_) {}   // kilit kalmasın
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

  // motorun günlüğünü ve el sonu ekranlarını yakala
  const S = api.S;
  ctx.log = (m, big) => {
    room.log.push({ m: String(m), big: !!big, t: Date.now() });
    if (room.log.length > 200) room.log.shift();
    push(room);
  };
  ctx.render = () => push(room);
  ctx.notice = () => {};
  ctx.syncTimer = () => {};
  ctx.showVeil = (title, html, btn, fn) => { room.pendingNext = { title, html, fn }; push(room); };
  ctx.askVeil = (title, html, buttons) => {
    const seat = (api.S.askSeat != null) ? api.S.askSeat : api.self;
    room.pendingAsk = { seat, title, html, buttons: buttons.map(b => b.t) , fns: buttons };
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

/* ---------- oyuncuya özel görüntü ---------- */
function viewFor(room, seat) {
  const S = room.api.S;
  const hide = t => ({ id: t.id, h: 1 });
  return {
    version: room.version,
    code: room.code,
    teams: room.teams,
    started: room.started,
    seat,
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
        // kendi oyuncun: motorun tuttuğu her alan gitsin, ekran hepsini kullanıyor
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
    next: room.pendingNext || null
  };
}

function push(room) {
  room.version++;
  const ws = room.waiters;
  room.waiters = [];
  for (const w of ws) {
    clearTimeout(w.timer);
    const seat = seatOf(room, w.pid);
    try {
      if (seat < 0) send(w.res, 200, { gone: true });
      else send(w.res, 200, viewFor(room, seat));
    } catch (e) { /* kopmuş bağlantı */ }
  }
}

/* ---------- oyunu başlat ---------- */
function startRoom(room) {
  const api = room.api;
  const S = api.S;
  room.started = true;
  S.teams = room.teams;
  S.totals = [0, 0, 0, 0];
  S.xm = [0, 0, 0, 0];
  S.history = [];
  S.handNo = 1;
  S.dealer = Math.floor(Math.random() * 4);
  // koltuğu boş olanlar bot
  api.newHand();
  // insan oyuncuların bot bayrağını kapat
  S.players.forEach((p, i) => { p.bot = !room.seats[i]; });
  const kisi = room.seats.filter(Boolean).length;
  room.log.push({
    m: `Oda ${room.code} — oyun başladı. ${kisi} kişi, ${4 - kisi} bot.`,
    big: true, t: Date.now()
  });
  push(room);
  // sıra bottaysa oynatalım
  if (S.players[S.turn].bot) setTimeout(() => room.api.botTurn(), 700);
}

/* ---------- hamle ---------- */
const ACTIONS = {
  deck:    api => api.doDeck(),
  take:    api => api.doTake(),
  undo:    api => api.doUndo(),
  collect: api => api.doCollect(),
  okey:    api => api.doOkey(),
  process: (api, d) => { api.S.selected = new Set(d.ids || []); api.doProcess(); },
  put:     (api, d) => { stage(api, d.groups); api.doPut(); },
  open:    (api, d) => { stage(api, d.groups); api.doOpen(!!d.finish); },
  discard: (api, d) => { api.S.selected = new Set([d.id]); api.doDiscard(false); }
};

function stage(api, groups) {
  const S = api.S;
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

  S.busy = false;                       // insan oynarken motor kilidi açık olmalı
  const before = { hand: S.players[seat].hand.length, turn: S.turn, phase: S.phase,
                   melds: S.melds.length, log: room.log.length };
  api.setSelf(seat);
  try { fn(api, data || {}); }
  catch (e) { api.setSelf(0); return { ok: false, err: 'Hata: ' + e.message }; }
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

/* ---------- HTTP ---------- */
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
    room.seats[0] = { pid, name: (d.name || 'Oyuncu').slice(0, 12) };
    return send(res, 200, { code: room.code, pid, seat: 0 });
  }

  if (p === '/api/join' && req.method === 'POST') {
    const d = await readBody(req);
    const room = rooms.get(String(d.code || '').toUpperCase());
    if (!room) return send(res, 404, { err: 'Oda bulunamadı.' });
    if (room.started) return send(res, 400, { err: 'Oyun başlamış.' });
    const seat = room.seats.findIndex(s => !s);
    if (seat < 0) return send(res, 400, { err: 'Masa dolu.' });
    const pid = 'p' + (++nextRoom) + Math.random().toString(36).slice(2, 7);
    room.seats[seat] = { pid, name: (d.name || 'Oyuncu').slice(0, 12) };
    push(room);
    return send(res, 200, { code: room.code, pid, seat });
  }

  if (p === '/api/start' && req.method === 'POST') {
    const d = await readBody(req);
    const room = rooms.get(String(d.code || '').toUpperCase());
    if (!room) return send(res, 404, { err: 'Oda yok.' });
    if (seatOf(room, d.pid) !== 0) return send(res, 403, { err: 'Sadece oda sahibi başlatır.' });
    if (room.started) return send(res, 400, { err: 'Zaten başladı.' });
    startRoom(room);
    return send(res, 200, { ok: true });
  }

  if (p === '/api/action' && req.method === 'POST') {
    const d = await readBody(req);
    const room = rooms.get(String(d.code || '').toUpperCase());
    if (!room || !room.started) return send(res, 400, { err: 'Oda hazır değil.' });
    const seat = seatOf(room, d.pid);
    if (seat < 0) return send(res, 403, { err: 'Masada değilsin.' });
    return send(res, 200, doAction(room, seat, d.type, d.data));
  }

  if (p === '/api/answer' && req.method === 'POST') {
    const d = await readBody(req);
    const room = rooms.get(String(d.code || '').toUpperCase());
    if (!room || !room.pendingAsk) return send(res, 400, { err: 'Bekleyen soru yok.' });
    const seat = seatOf(room, d.pid);
    if (seat !== room.pendingAsk.seat) return send(res, 403, { err: 'Soru sana değil.' });
    const ask = room.pendingAsk;
    room.pendingAsk = null;
    room.api.setSelf(seat);
    try { ask.fns[d.idx].fn(); } catch (e) { /* yut */ }
    room.api.setSelf(0);
    push(room);
    return send(res, 200, { ok: true });
  }

  if (p === '/api/next' && req.method === 'POST') {
    const d = await readBody(req);
    const room = rooms.get(String(d.code || '').toUpperCase());
    if (!room || !room.pendingNext) return send(res, 400, { err: 'Bekleyen el yok.' });
    const fn = room.pendingNext.fn;
    room.pendingNext = null;
    try { fn(); } catch (e) { /* yut */ }
    push(room);
    return send(res, 200, { ok: true });
  }

  if (p === '/poll') {
    const room = rooms.get(String(u.searchParams.get('code') || '').toUpperCase());
    const pid  = u.searchParams.get('pid');
    const v    = parseInt(u.searchParams.get('v') || '0', 10);
    if (!room) return send(res, 404, { err: 'Oda yok.' });
    const seat = seatOf(room, pid);
    if (seat < 0) return send(res, 403, { gone: true });
    // güvenlik: sıra bir insandaysa motor kilidi açık olmalı
    const S = room.api.S;
    if (room.started && S.busy && room.seats[S.turn]) {
      S.busy = false;
      push(room);
    }
    if (room.version > v) return send(res, 200, viewFor(room, seat));
    const w = { pid, res };
    w.timer = setTimeout(() => {
      room.waiters = room.waiters.filter(x => x !== w);
      try { send(res, 200, { noChange: true, version: room.version }); } catch (e) {}
    }, 25000);
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

module.exports = { server, rooms, makeRoom, startRoom, doAction, viewFor };
