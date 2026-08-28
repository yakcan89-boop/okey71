/* 71 Okey — ağ katmanı. Sunucudan servis edildiğinde devreye girer. */
(function () {
  const api = window.__api;
  if (!api) return;

  let CODE = null, PID = null, SEAT = 0, STARTED = false, LAST = null;

  /* ---------- lobi ekranı ---------- */
  const lob = document.createElement('div');
  lob.id = 'lobby';
  lob.style.cssText =
    'position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;' +
    'padding:18px;background:linear-gradient(170deg,#1d6f96,#0b3d5c);color:#eaf6ff;' +
    'font-family:"Trebuchet MS",Helvetica,Arial,sans-serif';
  document.body.appendChild(lob);

  function lobbyHTML(inner) {
    lob.innerHTML =
      '<div style="max-width:380px;width:100%;text-align:center">' +
      '<div style="font-size:26px;font-weight:900;letter-spacing:.06em;margin-bottom:4px">71 OKEY</div>' +
      '<div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;opacity:.6;margin-bottom:18px">özel oda</div>' +
      inner + '</div>';
  }

  const BTN = 'font:inherit;font-size:15px;font-weight:700;padding:11px 14px;border-radius:9px;' +
              'border:1px solid #ffe08a;background:linear-gradient(180deg,#f5c33b,#a9761a);color:#3a2503;' +
              'cursor:pointer;width:100%;margin-top:8px';
  const BTN2 = BTN.replace('#ffe08a', 'rgba(255,255,255,.25)')
                  .replace('linear-gradient(180deg,#f5c33b,#a9761a)', 'rgba(255,255,255,.12)')
                  .replace('color:#3a2503', 'color:#eaf6ff');
  const INP = 'font:inherit;font-size:16px;padding:11px;border-radius:9px;width:100%;' +
              'border:1px solid rgba(255,255,255,.3);background:rgba(0,0,0,.25);color:#fff;text-align:center';

  let TEAMS = false;

  function showEntry(err) {
    lobbyHTML(
      (err ? '<div style="color:#ffb4ae;font-size:13px;margin-bottom:10px">' + err + '</div>' : '') +
      '<input id="lbName" style="' + INP + '" placeholder="Adın" maxlength="12">' +
      '<div style="display:flex;gap:6px;margin-top:8px">' +
        '<button id="lbTek" style="' + BTN2 + ';margin-top:0">Tek kişilik</button>' +
        '<button id="lbEsli" style="' + BTN2 + ';margin-top:0">Eşli</button>' +
      '</div>' +
      '<div id="lbMode" style="font-size:11px;opacity:.7;margin-top:6px">Herkes kendi başına</div>' +
      '<button id="lbCreate" style="' + BTN + '">Oda kur</button>' +
      '<div style="margin:16px 0 6px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;opacity:.55">ya da</div>' +
      '<input id="lbCode" style="' + INP + '" placeholder="Oda kodu" maxlength="4">' +
      '<button id="lbJoin" style="' + BTN2 + '">Odaya katıl</button>'
    );
    const url = new URL(location.href);
    const pre = url.searchParams.get('oda');
    if (pre) document.getElementById('lbCode').value = pre.toUpperCase();
    const paint = () => {
      const t = document.getElementById('lbTek'), e = document.getElementById('lbEsli');
      const on = 'linear-gradient(180deg,#f5c33b,#a9761a)', off = 'rgba(255,255,255,.12)';
      t.style.background = TEAMS ? off : on; t.style.color = TEAMS ? '#eaf6ff' : '#3a2503';
      e.style.background = TEAMS ? on : off; e.style.color = TEAMS ? '#3a2503' : '#eaf6ff';
      document.getElementById('lbMode').textContent = TEAMS
        ? 'Karşılıklı oturanlar eş — puanlar takım olarak sayılır'
        : 'Herkes kendi başına';
    };
    document.getElementById('lbTek').onclick = () => { TEAMS = false; paint(); };
    document.getElementById('lbEsli').onclick = () => { TEAMS = true; paint(); };
    paint();
    document.getElementById('lbCreate').onclick = () => create();
    document.getElementById('lbJoin').onclick = () => join();
  }

  function nameVal() {
    const v = (document.getElementById('lbName') || {}).value || '';
    return v.trim() || 'Oyuncu';
  }

  function note(msg) {
    let n = document.getElementById('lbNote');
    if (!n) {
      n = document.createElement('div');
      n.id = 'lbNote';
      n.style.cssText = 'margin-top:12px;font-size:13px;line-height:1.5;color:#ffd88a;' +
                        'word-break:break-word';
      lob.firstChild.appendChild(n);
    }
    n.textContent = msg;
  }

  async function post(path, body) {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    const txt = await r.text();
    let d;
    try { d = JSON.parse(txt); }
    catch (e) { throw new Error('Sunucu cevabı okunamadı (' + r.status + '): ' + txt.slice(0, 120)); }
    if (!r.ok && !d.err) throw new Error('Sunucu hatası ' + r.status);
    return d;
  }

  async function create() {
    note('Oda kuruluyor…');
    try {
      const d = await post('/api/create', { name: nameVal(), teams: TEAMS });
      if (d.err) { note('Hata: ' + d.err); return; }
      CODE = d.code; PID = d.pid; SEAT = d.seat;
      api.setSelf(SEAT);
      note('Oda kuruldu: ' + CODE);
      connect();
    } catch (e) {
      note('Bağlanamadım: ' + e.message);
    }
  }

  async function join() {
    const el = document.getElementById('lbCode');
    const code = ((el && el.value) || '').trim().toUpperCase();
    if (code.length !== 4) { note('Oda kodu 4 harf olmalı.'); return; }
    note('Odaya giriliyor…');
    try {
      const d = await post('/api/join', { code, name: nameVal() });
      if (d.err) { note('Hata: ' + d.err); return; }
      CODE = d.code; PID = d.pid; SEAT = d.seat;
      api.setSelf(SEAT);
      connect();
    } catch (e) {
      note('Bağlanamadım: ' + e.message);
    }
  }

  function showWaiting(v) {
    const link = location.origin + '/?oda=' + CODE;
    const list = v.seats.map((s, i) =>
      '<div style="display:flex;justify-content:space-between;padding:7px 10px;border-radius:8px;margin-bottom:5px;' +
      'background:rgba(255,255,255,' + (i === v.seat ? '.18' : '.07') + ')">' +
      '<span>' + (i + 1) + '. ' + (s.bot ? '<i style="opacity:.55">boş — bot</i>' : s.name) + '</span>' +
      (i === v.seat ? '<b style="color:#f5c33b">sen</b>' : '') + '</div>').join('');
    lobbyHTML(
      '<div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;opacity:.6">' +
        (v.teams ? 'eşli oyun · oda kodu' : 'tek kişilik · oda kodu') + '</div>' +
      '<div style="font-size:44px;font-weight:900;letter-spacing:.12em;margin:2px 0 14px">' + CODE + '</div>' +
      list +
      '<button id="lbCopy" style="' + BTN2 + '">Daveti kopyala</button>' +
      (v.seat === 0
        ? '<button id="lbStart" style="' + BTN + '">Oyunu başlat</button>' +
          '<div style="font-size:11px;opacity:.6;margin-top:8px">Boş koltuklar bot olarak oynar.</div>'
        : '<div style="font-size:13px;opacity:.75;margin-top:14px">Oda sahibi başlatınca oyun açılacak…</div>')
    );
    const c = document.getElementById('lbCopy');
    if (c) c.onclick = () => {
      const t = 'Gel 71 Okey oynayalım. Oda: ' + CODE + '\n' + link;
      if (navigator.clipboard) navigator.clipboard.writeText(t);
      c.textContent = 'Kopyalandı';
    };
    const st = document.getElementById('lbStart');
    if (st) st.onclick = () => post('/api/start', { code: CODE, pid: PID });
  }

  /* ---------- sunucu durumunu ekrana uygula ---------- */
  function apply(v) {
    LAST = v;
    const S = api.S;
    S.teams = v.teams; S.handNo = v.handNo; S.dealer = v.dealer;
    S.turn = v.turn; S.phase = v.phase; S.over = v.over;
    S.doubled = v.doubled; S.topOpen = v.topOpen; S.pairsMax = v.pairsMax;
    S.okey = v.okey; S.gosterge = v.gosterge;
    S.totals = v.totals; S.xm = v.xm; S.history = v.history;
    S.deck = new Array(v.deck).fill(0);
    S.center = new Array(v.center).fill(0).map((_, i) => ({ id: -100 - i }));
    S.melds = v.melds;
    S.players = v.players.map(p => Object.assign({ bot: p.i !== v.seat }, p));
    api.setNames(v.players.map((p, i) => (i === v.seat ? 'Sen' : p.name)));
    S.busy = false; S.staging = []; S.snap = null;
    S.lastDraw = v.lastDraw;
    if (!S.selected || !S.selected.has) S.selected = new Set();
    api.setSelf(v.seat);
    api.render();
    paintLog(v.log);
  }

  function paintLog(lines) {
    const box = document.getElementById('log');
    if (!box) return;
    box.innerHTML = '';
    lines.forEach(l => {
      const p = document.createElement('p');
      if (l.big) p.className = 'b';
      p.textContent = l.m;
      box.appendChild(p);
    });
    box.scrollTop = box.scrollHeight;
  }

  /* ---------- soru ve el sonu kutuları ---------- */
  function showAsk(a) {
    const veil = document.getElementById('veil');
    document.querySelectorAll('.veil .opt').forEach(x => x.remove());
    document.getElementById('vTitle').textContent = a.title;
    document.getElementById('vLines').innerHTML = a.html;
    const vb = document.getElementById('vBtn');
    vb.style.display = 'none';
    a.buttons.forEach((t, i) => {
      const b = document.createElement('button');
      b.className = 'opt gold'; b.textContent = t; b.style.margin = '3px';
      b.onclick = () => {
        document.querySelectorAll('.veil .opt').forEach(x => x.remove());
        veil.classList.add('hidden');
        post('/api/answer', { code: CODE, pid: PID, idx: i });
      };
      vb.parentNode.appendChild(b);
    });
    veil.classList.remove('hidden');
  }

  function showNext(n) {
    const veil = document.getElementById('veil');
    document.querySelectorAll('.veil .opt').forEach(x => x.remove());
    document.getElementById('vTitle').textContent = n.title;
    document.getElementById('vLines').innerHTML = n.html;
    const vb = document.getElementById('vBtn');
    vb.style.display = ''; vb.textContent = 'Devam';
    vb.onclick = () => {
      veil.classList.add('hidden');
      post('/api/next', { code: CODE, pid: PID });
    };
    veil.classList.remove('hidden');
  }

  /* ---------- bağlantı: uzun yoklama (her ağda çalışır) ---------- */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let VER = -1, RUNNING = false;   // -1: ilk durumu hemen iste, bekleme

  function handle(v) {
    if (v.gone) { location.reload(); return; }
    try { handle_(v); } catch (e) { note('Ekran hatası: ' + e.message); }
  }
  function handle_(v) {
    SEAT = v.seat;
    if (!v.started) { showWaiting(v); return; }
    if (!STARTED) { STARTED = true; lob.style.display = 'none'; bind(); }
    apply(v);
    if (v.ask) showAsk(v.ask);
    else if (v.next) showNext(v.next);
  }

  async function connect() {
    if (RUNNING) return;
    RUNNING = true;
    while (true) {
      try {
        const r = await fetch('/poll?code=' + CODE + '&pid=' + PID + '&v=' + VER);
        const d = await r.json();
        if (d.version != null) VER = d.version;
        if (d.noChange) continue;
        if (d.err) { await sleep(1500); continue; }
        handle(d);
      } catch (e) {
        await sleep(1500);
      }
    }
  }

  /* ---------- hamleleri sunucuya gönder ---------- */
  function flash(msg) {
    const box = document.getElementById('log');
    if (!box) return;
    const p = document.createElement('p');
    p.className = 'b';
    p.textContent = '· ' + msg;
    box.appendChild(p);
    box.scrollTop = box.scrollHeight;
  }

  async function act(type, data) {
    try {
      const d = await post('/api/action', { code: CODE, pid: PID, type, data });
      if (d && d.err) flash(d.err);
      return d;
    } catch (e) {
      flash('Sunucuya ulaşamadım: ' + e.message);
    }
  }

  function groupsFromRack(finish) {
    const b = api.rackBlocks();
    const melds = b.melds.map(g => g.tiles.map(t => t.id));
    const pairs = b.pairs.map(g => g.tiles.map(t => t.id));
    const mCount = melds.reduce((a, g) => a + g.length, 0);
    const pCount = pairs.reduce((a, g) => a + g.length, 0);
    const meP = api.S.players[SEAT].pairs;
    if (meP) return pairs;
    if (finish) return pCount > mCount ? pairs : melds;
    const pts = b.melds.reduce((a, g) => a + g.points, 0);
    if (pts >= api.threshold()) return melds;
    if (pairs.length >= api.needPairs()) return pairs;
    return melds;
  }

  function selectedIds() {
    return Array.from(api.S.selected || []);
  }

  function bind() {
    const on = (id, fn) => { const e = document.getElementById(id); if (e) e.onclick = fn; };
    // ağda kullanılmayanları gizle
    ['btnGroup'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });

    on('btnDeck',    () => act('deck'));
    on('deck',       () => act('deck'));
    on('btnTake',    () => act('take'));
    on('btnUndo',    () => act('undo'));
    on('btnCollect', () => act('collect'));
    on('btnOkey',    () => act('okey'));
    on('btnProcess', () => act('process', { ids: selectedIds() }));
    on('btnPut',     () => act('put',  { groups: groupsFromRack(false) }));
    on('btnOpen',    () => act('open', { groups: groupsFromRack(false), finish: false }));
    on('btnFinish',  () => act('open', { groups: groupsFromRack(true), finish: true }));
    on('btnDiscard', () => {
      const ids = selectedIds();
      if (ids.length !== 1) return;
      act('discard', { id: ids[0] });
    });

    // takozdaki taşa dokununca atma (sürükleyip atma kutusu) da sunucuya gitsin
    window.__netDiscard = id => act('discard', { id });

    // yerel kalanlar: dizme, seçim, puan tablosu — dokunma
  }

  /* yerel "doDiscard" yerine ağ sürümü (sürükle-bırak için) */
  window.doDiscard = function (auto) {
    const ids = Array.from(api.S.selected || []);
    if (ids.length !== 1) return;
    act('discard', { id: ids[0] });
  };
  window.doTake = function () { act('take'); };
  window.doDeck = function () { act('deck'); };

  window.addEventListener('error', e => {
    try { note('Hata: ' + (e.message || 'bilinmeyen')); } catch (_) {}
  });
  window.addEventListener('unhandledrejection', e => {
    try { note('Hata: ' + ((e.reason && e.reason.message) || e.reason)); } catch (_) {}
  });

  showEntry();
})();
