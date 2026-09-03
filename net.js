/* 71 Okey — ağ katmanı. Sunucudan servis edildiğinde devreye girer. */
(function () {
  const api = window.__api;
  if (!api) return;

  let CODE = null, PID = null, SEAT = 0, STARTED = false, LAST = null;

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
      '<button id="lbJoin" style="' + BTN2 + '">Odaya katıl</button>' +
      '<button id="lbLeave" style="font:inherit;font-size:12px;padding:6px;border-radius:6px;border:none;background:rgba(255,0,0,0.2);color:#ffb4ae;cursor:pointer;width:100%;margin-top:14px">Kaydı Temizle / Yeniden Başla</button>'
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
    document.getElementById('lbLeave').onclick = () => {
      localStorage.removeItem('okey_code');
      localStorage.removeItem('okey_pid');
      location.reload();
    };

    const savedCode = localStorage.getItem('okey_code');
    const savedPid = localStorage.getItem('okey_pid');
    if (savedCode && savedPid) {
      CODE = savedCode;
      PID = savedPid;
      note('Kaldığın odaya bağlanılıyor...');
      connect();
    }
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
      n.style.cssText = 'margin-top:12px;font-size:13px;line-height:1.5;color:#ffd88a;word-break:break-word';
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
      localStorage.setItem('okey_code', CODE);
      localStorage.setItem('okey_pid', PID);
      api.setSelf(SEAT);
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
      localStorage.setItem('okey_code', CODE);
      localStorage.setItem('okey_pid', PID);
      api.setSelf(SEAT);
      connect();
    } catch (e) {
      note('Bağlanamadım: ' + e.message);
    }
  }

  function seatRow(v, i) {
    const s = v.seats[i];
    const ben = (i === v.seat);
    const bos = s.bot;
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;' +
      'padding:8px 10px;border-radius:8px;margin-bottom:5px;' +
      'background:rgba(255,255,255,' + (ben ? '.2' : '.07') + ')">' +
      '<span style="flex:1;text-align:left">' +
        '<b style="opacity:.5;margin-right:6px">' + (i + 1) + '.</b>' +
        (bos ? '<i style="opacity:.55">boş — bot oynar</i>' : s.name) +
      '</span>' +
      (ben ? '<b style="color:#f5c33b;font-size:13px">sen</b>'
           : (bos ? '<button data-otur="' + i + '" style="font:inherit;font-size:12px;font-weight:700;' +
                    'padding:5px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.3);' +
                    'background:rgba(255,255,255,.14);color:#eaf6ff;cursor:pointer">Buraya otur</button>'
                  : '')) +
      '</div>';
  }

  function showWaiting(v) {
    const link = location.origin + '/?oda=' + CODE;
    const baslik = t =>
      '<div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;opacity:.55;' +
      'margin:10px 0 5px;text-align:left">' + t + '</div>';

    let list;
    if (v.teams) {
      // karşılıklı oturanlar eş: 1–3 bir takım, 2–4 diğer takım
      list = baslik('A takımı') + seatRow(v, 0) + seatRow(v, 2) +
             baslik('B takımı') + seatRow(v, 1) + seatRow(v, 3);
    } else {
      list = [0, 1, 2, 3].map(i => seatRow(v, i)).join('');
    }

    lobbyHTML(
      '<div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;opacity:.6">oda kodu</div>' +
      '<div style="font-size:44px;font-weight:900;letter-spacing:.12em;margin:2px 0 10px">' + CODE + '</div>' +
      (v.owner
        ? '<div style="display:flex;gap:6px;margin-bottom:6px">' +
            '<button id="lbTek2" style="' + BTN2 + ';margin-top:0">Tek kişilik</button>' +
            '<button id="lbEsli2" style="' + BTN2 + ';margin-top:0">Eşli</button>' +
          '</div>' +
          '<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.55;margin-bottom:4px">kaç el</div>' +
          '<div style="display:flex;gap:4px;margin-bottom:8px">' +
            [3,4,5,6,7,8].map(function (n) {
              return '<button data-el="' + n + '" style="' + BTN2 + ';margin-top:0;padding:6px 0">' + n + '</button>';
            }).join('') +
          '</div>'
        : '<div style="font-size:12px;opacity:.7;margin-bottom:6px">' +
          (v.teams ? 'Eşli oyun — karşılıklı oturanlar eş' : 'Tek kişilik — herkes kendi başına') +
          ' · ' + (v.hands || 8) + ' el</div>') +
      list +
      '<div style="font-size:11px;opacity:.55;margin-top:8px">Boş bir koltuğa dokunarak yerini değiştirebilirsin.</div>' +
      '<button id="lbCopy" style="' + BTN2 + '">Daveti kopyala</button>' +
      (v.owner
        ? '<button id="lbStart" style="' + BTN + '">Oyunu başlat</button>' +
          '<div style="font-size:11px;opacity:.6;margin-top:8px">Boş koltuklar bot olarak oynar.</div>'
        : '<div style="font-size:13px;opacity:.75;margin-top:14px">Oda sahibi başlatınca oyun açılacak…</div>') +
      '<button id="lbLeave" style="font:inherit;font-size:12px;padding:6px;border-radius:6px;border:none;background:rgba(255,0,0,0.2);color:#ffb4ae;cursor:pointer;width:100%;margin-top:14px">Odadan Çık / Yeni Oda</button>'
    );

    lob.querySelectorAll('[data-otur]').forEach(b => {
      b.onclick = async () => {
        b.disabled = true;
        const d = await post('/api/seat', { code: CODE, pid: PID, seat: +b.dataset.otur });
        if (d && d.err) { note(d.err); b.disabled = false; }
      };
    });

    if (v.owner) {
      const t = document.getElementById('lbTek2'), e = document.getElementById('lbEsli2');
      const on = 'linear-gradient(180deg,#f5c33b,#a9761a)', off = 'rgba(255,255,255,.12)';
      t.style.background = v.teams ? off : on; t.style.color = v.teams ? '#eaf6ff' : '#3a2503';
      e.style.background = v.teams ? on : off; e.style.color = v.teams ? '#3a2503' : '#eaf6ff';
      t.onclick = () => post('/api/mode', { code: CODE, pid: PID, teams: false });
      e.onclick = () => post('/api/mode', { code: CODE, pid: PID, teams: true });
      lob.querySelectorAll('[data-el]').forEach(b => {
        const secili = +b.dataset.el === (v.hands || 8);
        b.style.background = secili ? on : off;
        b.style.color = secili ? '#3a2503' : '#eaf6ff';
        b.onclick = () => post('/api/mode', { code: CODE, pid: PID, hands: +b.dataset.el });
      });
    }

    const c = document.getElementById('lbCopy');
    if (c) c.onclick = () => {
      const t = 'Gel 71 Okey oynayalım. Oda: ' + CODE + '\n' + link;
      if (navigator.clipboard) navigator.clipboard.writeText(t);
      c.textContent = 'Kopyalandı';
    };
    const st = document.getElementById('lbStart');
    if (st) st.onclick = async () => {
      const d = await post('/api/start', { code: CODE, pid: PID });
      if (d && d.err) note(d.err);
    };

    const lv = document.getElementById('lbLeave');
    if (lv) lv.onclick = () => {
      localStorage.removeItem('okey_code');
      localStorage.removeItem('okey_pid');
      location.reload();
    };
  }

  function apply(v) {
    LAST = v;
    const S = api.S;
    S.teams = v.teams; S.handNo = v.handNo; S.dealer = v.dealer;
    S.hands = v.hands || 8;
    S.turn = v.turn; S.phase = v.phase; S.over = v.over;
    S.doubled = v.doubled; S.topOpen = v.topOpen; S.pairsMax = v.pairsMax;
    S.okey = v.okey; S.gosterge = v.gosterge;
    S.totals = v.totals; S.xm = v.xm; S.history = v.history;
    S.deck = new Array(v.deck).fill(0);
    S.center = new Array(v.center).fill(0).map((_, i) => ({ id: -100 - i }));
    S.melds = v.melds;
    S.players = v.players.map(p => Object.assign({ bot: p.i !== v.seat }, p));
    api.setNames(v.players.map((p, i) => (i === v.seat ? 'Sen' : p.name)));
    // S.snap sunucuda tutuluyor; buraya sadece "geri toplama hakkın var mı"
    // bilgisi geliyor. Yerel bir yer tutucu koyuyoruz ki düğme açılsın.
    S.busy = false; S.staging = []; S.snap = v.snap ? { net: true } : null;
    S.lastDraw = v.lastDraw;
    if (!S.selected || !S.selected.has) S.selected = new Set();
    // elden çıkmış taşların seçimi kalmasın
    {
      const el = (v.players[v.seat] && v.players[v.seat].hand) || [];
      const elde = new Set(el.map(t => t.id));
      Array.from(S.selected).forEach(id => { if (!elde.has(id)) S.selected.delete(id); });
    }
    api.setSelf(v.seat);
    api.render();
    paintLog(v.log);
    checkCloseButton(v.owner);
  }

  // Oda sahibine oyun ekranında sağ üstte "Masayı Kapat" butonu ekler
  function checkCloseButton(sahip) {
    let btn = document.getElementById('btnCloseRoom');
    if (sahip) {
      if (!btn) {
        btn = document.createElement('button');
        btn.id = 'btnCloseRoom';
        btn.textContent = 'Masayı Kapat';
        btn.style.cssText = 'position:fixed;top:8px;right:8px;z-index:150;font-size:11px;font-weight:700;padding:5px 8px;border-radius:6px;border:1px solid #ffb4ae;background:rgba(224,87,79,0.85);color:#fff;cursor:pointer;';
        btn.onclick = async () => {
          if (confirm('Masayı kapatmak istediğine emin misin? Oyun herkes için sonlandırılacak.')) {
            await post('/api/close', { code: CODE, pid: PID });
            localStorage.removeItem('okey_code');
            localStorage.removeItem('okey_pid');
            location.reload();
          }
        };
        document.body.appendChild(btn);
      }
    } else if (btn) {
      btn.remove();
    }
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
    // Maç sonu perdesinde tam puan tablosu geliyor, kart geniş olsun
    veil.classList.toggle('wide', !!n.wide);
    const vb = document.getElementById('vBtn');
    vb.style.display = ''; vb.textContent = n.btn || 'Devam';
    vb.onclick = () => {
      veil.classList.add('hidden');
      veil.classList.remove('wide');
      post('/api/next', { code: CODE, pid: PID });
    };
    veil.classList.remove('hidden');
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let VER = -1, RUNNING = false, STOP = false;
  let READONLY = false;      // yancı modunda hiçbir hamle gönderilmez

  /* ---------- bağlantı rozeti ---------- */
  function badge(msg) {
    let b = document.getElementById('netBadge');
    if (!msg) { if (b) b.remove(); return; }
    if (!b) {
      b = document.createElement('div');
      b.id = 'netBadge';
      b.style.cssText = 'position:fixed;left:8px;top:8px;z-index:190;font:700 11px/1.4 ' +
        '"Trebuchet MS",Arial,sans-serif;padding:5px 9px;border-radius:6px;' +
        'background:rgba(224,87,79,.9);color:#fff;pointer-events:none';
      document.body.appendChild(b);
    }
    b.textContent = msg;
  }

  /* ---------- bağlantı koptu ekranı ----------
     Kimlik (pid) burada SİLİNMEZ. Oyuncu "Yeniden bağlan" diyerek
     aynı koltuğa geri dönebilsin.                                   */
  function showLost(msg, canRetry) {
    STOP = true;
    badge(null);
    const cb = document.getElementById('btnCloseRoom');
    if (cb) cb.remove();
    lob.style.display = '';
    lobbyHTML(
      '<div style="font-size:15px;line-height:1.6;margin-bottom:6px">' + msg + '</div>' +
      (CODE ? '<div style="font-size:12px;opacity:.6;margin-bottom:10px">Oda: ' + CODE + '</div>' : '') +
      (canRetry ? '<button id="lbRetry" style="' + BTN + '">Yeniden bağlan</button>' : '') +
      '<button id="lbBack" style="' + BTN2 + '">Lobiye dön</button>'
    );
    const rt = document.getElementById('lbRetry');
    if (rt) rt.onclick = () => {
      lobbyHTML('<div style="font-size:15px">Bağlanılıyor…</div>');
      VER = -1;
      connect();
    };
    document.getElementById('lbBack').onclick = () => {
      localStorage.removeItem('okey_code');
      localStorage.removeItem('okey_pid');
      location.reload();
    };
  }

  function handle_(v) {
    SEAT = v.seat;
    // Koltuğu olmayan seyirci: masayı bekleme panelinden izler, boş koltuk
    // açılınca oturur. Oyun ekranı çizilmez, eli olmayan biri için anlamsız.
    READONLY = !!v.readOnly;
    const kt = document.querySelector('.controls');
    if (kt) { kt.style.pointerEvents = READONLY ? 'none' : ''; kt.style.opacity = READONLY ? '.4' : ''; }
    if (!READONLY && v.yanci == null) { /* normal oyuncu */ }
    if (v.watcher) { lob.style.display = ''; showWatcher(v); return; }
    if (!v.started) { lob.style.display = ''; showWaiting(v); return; }
    if (!STARTED) { STARTED = true; bind(); }
    lob.style.display = 'none';
    apply(v);
    checkLeaveButton(true);
    yanciCubugu(v);        // yancı çubuğu ya da oyuncunun yancı ayarları
    if (v.oneri) oneriGoster(v.oneri);
    if (v.ask) showAsk(v.ask);
    else if (v.next) showNext(v.next);
  }

  // ---- seyirci paneli ----
  function showWatcher(v) {
    const sira = v.started ? (v.seats[v.turn] ? v.seats[v.turn].name : 'Bot ' + (v.turn + 1)) : '—';
    const satir = i => {
      const s = v.seats[i];
      const bos = !s;
      const yanci = (v.yancilar || [])[i];
      const kapali = (v.yanciKapali || [])[i];
      const kucuk = 'font-size:11px;font-weight:700;padding:5px 9px;border-radius:6px;cursor:pointer;';
      let sag = '';
      if (bos) {
        sag = '<button data-otur="' + i + '" style="' + kucuk + 'border:1px solid #f5c33b;' +
              'background:linear-gradient(180deg,#f5c33b,#a9761a);color:#3a2503">Otur</button>';
      } else if (yanci) {
        sag = '<span style="font-size:11px;opacity:.7">yancı: ' + yanci + '</span>';
      } else if (kapali) {
        sag = '<span style="font-size:11px;opacity:.45">yancı kapalı</span>';
      } else {
        sag = '<button data-yanci="' + i + '" style="' + kucuk + 'border:1px solid rgba(255,255,255,.3);' +
              'background:rgba(255,255,255,.14);color:#eaf6ff">Yancısı ol</button>';
      }
      return '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;margin-bottom:5px;' +
        'border-radius:8px;background:rgba(255,255,255,' + (bos ? '.06' : '.12') + ')">' +
        '<b style="flex:1;text-align:left">' + (bos ? 'Boş koltuk' : s.name) + '</b>' +
        (v.started && v.turn === i ? '<span style="font-size:11px;color:#f5c33b">sırada</span>' : '') +
        sag + '</div>';
    };
    lobbyHTML(
      '<div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;opacity:.6">oda kodu</div>' +
      '<div style="font-size:38px;font-weight:900;letter-spacing:.12em;margin:2px 0 8px">' + CODE + '</div>' +
      '<div style="font-size:13px;opacity:.85;margin-bottom:10px">' +
        'Masa dolu — <b>izliyorsun</b>. Masayı ve atılan taşları görürsün, elleri görmezsin.' +
        '<br><b>Yancısı ol</b> dersen o oyuncunun elini de görürsün ve ona akıl verebilirsin.' +
        (v.started ? ' El ' + v.handNo + '/' + v.hands + ' oynanıyor, sıra <b>' + sira + '</b>.' : '') +
        '<br>Biri masadan ayrılınca <b>Otur</b> düğmesi açılır.' +
      '</div>' +
      [0, 1, 2, 3].map(satir).join('') +
      '<button id="lbAyril" style="width:100%;margin-top:10px;font-size:13px;font-weight:700;padding:9px;' +
      'border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.10);' +
      'color:#eaf6ff;cursor:pointer">Masadan ayrıl</button>'
    );
    lob.querySelectorAll('[data-otur]').forEach(b => {
      b.onclick = async () => {
        const r = await post('/api/seat', { code: CODE, pid: PID, seat: +b.dataset.otur });
        if (r && r.err) alert(r.err);
      };
    });
    lob.querySelectorAll('[data-yanci]').forEach(b => {
      b.onclick = async () => {
        const r = await post('/api/yanci', { code: CODE, pid: PID, seat: +b.dataset.yanci });
        if (r && r.err) alert(r.err);
      };
    });
    const a = document.getElementById('lbAyril');
    if (a) a.onclick = () => ayril(false);
  }

  /* ---------- yancı çubuğu ----------
     Yancıysan: oyuncunun elini görürsün, hamle yapamazsın, hazır tavsiyeleri
     yollarsın. Oyuncuysan: yancının adını görür, kovabilir ya da yancı yerini
     büsbütün kapatabilirsin. */
  function cubuk() {
    let c = document.getElementById('yanciBar');
    if (!c) {
      c = document.createElement('div');
      c.id = 'yanciBar';
      c.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:160;padding:7px 8px;' +
        'background:rgba(10,32,52,.96);border-top:1px solid rgba(255,255,255,.18);' +
        'display:flex;flex-wrap:wrap;gap:5px;align-items:center;justify-content:center;' +
        'font:700 12px/1.2 "Trebuchet MS",Arial,sans-serif;color:#eaf6ff';
      document.body.appendChild(c);
      document.body.style.paddingBottom = '64px';
    }
    return c;
  }
  function cubukSil() {
    const c = document.getElementById('yanciBar');
    if (c) c.remove();
    document.body.style.paddingBottom = '';
  }

  const ONERILER = [
    ['Desteden çek', 'desteden çek'],
    ['Yerden al',    'yerden al'],
    ['Bu taşı at',   null],
    ['Yere indir',   'yere indir, aç'],
    ['Bekle',        'bekle, tutma'],
    ['Çifte git',    'çifte git']
  ];

  function yanciCubugu(v) {
    // --- yancı görünümü ---
    if (v.yanci != null) {
      const c = cubuk();
      const dgm = (metin, fn, renk) => {
        const b = document.createElement('button');
        b.textContent = metin;
        b.style.cssText = 'font:700 12px/1.1 inherit;padding:7px 9px;border-radius:6px;cursor:pointer;' +
          'border:1px solid rgba(255,255,255,.28);background:' + (renk || 'rgba(255,255,255,.14)') +
          ';color:#eaf6ff';
        b.onclick = fn;
        return b;
      };
      c.innerHTML = '';
      const et = document.createElement('span');
      et.style.cssText = 'width:100%;text-align:center;opacity:.8;font-weight:400;margin-bottom:2px';
      et.innerHTML = '<b>' + v.yanciAdi + '</b> adlı oyuncunun yancısısın — elini görüyorsun, hamleyi o yapar.';
      c.appendChild(et);
      ONERILER.forEach(o => {
        c.appendChild(dgm(o[0], async () => {
          let metin = o[1];
          if (!metin) {                       // "Bu taşı at": takozdan seçilen taş
            const ids = Array.from(api.S.selected || []);
            const el = (api.S.players[v.yanci] || {}).hand || [];
            const t = el.find(x => x.id === ids[0]);
            if (!t) { flash('Önce takozdan bir taş seç.'); return; }
            metin = api.tileName(t) + ' at';
          }
          const r = await post('/api/oneri', { code: CODE, pid: PID, metin });
          if (r && r.err) flash(r.err); else flash('Tavsiye yollandı: ' + metin);
        }));
      });
      c.appendChild(dgm('Yancılıktan çık', async () => {
        await post('/api/yanci', { code: CODE, pid: PID, seat: -1 });
      }, 'rgba(224,87,79,.55)'));
      return;
    }

    // --- oturan oyuncunun yancı ayarları ---
    const benimYanci = (v.yancilar || [])[v.seat];
    const kapali = (v.yanciKapali || [])[v.seat];
    if (!benimYanci && !kapali) { cubukSil(); return; }
    const c = cubuk();
    c.innerHTML = '';
    const et = document.createElement('span');
    et.style.cssText = 'opacity:.85;font-weight:400';
    et.innerHTML = benimYanci
      ? 'Yancın: <b>' + benimYanci + '</b>'
      : 'Yancı yerin <b>kapalı</b>';
    c.appendChild(et);
    const dgm = (metin, fn, renk) => {
      const b = document.createElement('button');
      b.textContent = metin;
      b.style.cssText = 'font:700 12px/1.1 inherit;padding:6px 10px;border-radius:6px;cursor:pointer;' +
        'border:1px solid rgba(255,255,255,.28);background:' + (renk || 'rgba(255,255,255,.14)') + ';color:#eaf6ff';
      b.onclick = fn;
      c.appendChild(b);
    };
    if (benimYanci) {
      dgm('Kov', async () => {
        if (confirm(benimYanci + ' yancılıktan çıkarılsın mı?')) await post('/api/yancikov', { code: CODE, pid: PID });
      }, 'rgba(224,87,79,.55)');
    }
    dgm(kapali ? 'Yancı yerini aç' : 'Yancı yerini kapat', async () => {
      await post('/api/yancikapat', { code: CODE, pid: PID, kapali: !kapali });
    });
  }

  let sonOneri = 0;
  function oneriGoster(o) {
    if (!o || o.t === sonOneri) return;
    sonOneri = o.t;
    flash('Yancın ' + o.kim + ': “' + o.metin + '”');
  }

  // ---- masadan ayrılma ----
  async function ayril(oyunIcinde) {
    const uyari = oyunIcinde
      ? 'Masadan ayrılmak istediğine emin misin?\n\nKoltuğun boşalır ve elini bot devralır. ' +
        'Yerine başkası oturabilir — o zaman GERİ DÖNEMEZSİN.\n\n' +
        'Bağlantın kopmuşsa ayrılma: koltuğun sana ayrılı kalır, geri girebilirsin.'
      : 'Masayı izlemeyi bırakacaksın. Emin misin?';
    if (!confirm(uyari)) return;
    STOP = true;
    try { await post('/api/leave', { code: CODE, pid: PID }); } catch (e) {}
    localStorage.removeItem('okey_code');
    localStorage.removeItem('okey_pid');
    location.reload();
  }

  // Oyun ekranında sol üstte "Masadan ayrıl" düğmesi
  function checkLeaveButton(goster) {
    let btn = document.getElementById('btnLeaveRoom');
    if (goster) {
      if (!btn) {
        btn = document.createElement('button');
        btn.id = 'btnLeaveRoom';
        btn.textContent = 'Masadan ayrıl';
        btn.style.cssText = 'position:fixed;top:8px;left:8px;z-index:150;font-size:11px;font-weight:700;' +
          'padding:5px 8px;border-radius:6px;border:1px solid rgba(255,255,255,.3);' +
          'background:rgba(0,0,0,.35);color:#eaf6ff;cursor:pointer;';
        btn.onclick = () => ayril(true);
        document.body.appendChild(btn);
      }
    } else if (btn) btn.remove();
  }

  async function connect() {
    if (RUNNING) return;
    RUNNING = true;
    STOP = false;
    let fails = 0;

    while (!STOP) {
      let r, d;
      try {
        r = await fetch('/poll?code=' + CODE + '&pid=' + PID + '&v=' + VER);
      } catch (e) {
        fails++;
        badge(fails > 1 ? 'bağlantı yok — deneniyor' : null);
        await sleep(Math.min(1200 * fails, 6000));
        continue;
      }

      if (r.status === 404) {                    // oda sunucuda yok
        fails++;
        if (fails >= 3) {
          showLost('Oda sunucuda bulunamadı. Sunucu yeniden başlamış ya da masa kapatılmış olabilir.', false);
          break;
        }
        await sleep(2000);
        continue;
      }

      try { d = await r.json(); }
      catch (e) { fails++; await sleep(1500); continue; }

      fails = 0;
      badge(null);

      if (d.gone) {
        const kendi = d.reason === 'ayrildi';
        showLost(
          d.reason === 'kapatildi' ? 'Oda sahibi masayı kapattı.'
          : kendi ? 'Masadan ayrıldın. Koltuğun boşaldı — geri dönmek için oda koduyla yeniden katılman gerekir; boş koltuk yoksa seyirci olarak beklersin.'
          : 'Masadaki yerin düştü. Yeniden bağlanmayı deneyebilirsin.',
          !kendi && d.reason !== 'kapatildi');
        break;
      }
      if (d.version != null) VER = d.version;
      if (d.noChange) continue;
      if (d.err) { await sleep(1500); continue; }

      try { handle_(d); }
      catch (e) { note('Ekran hatası: ' + e.message); }
    }

    RUNNING = false;
  }

  // Telefon uykuya girip döndüğünde yoklamayı hemen canlandır
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !RUNNING && !STOP && CODE && PID) connect();
  });
  window.addEventListener('online', () => {
    if (!RUNNING && !STOP && CODE && PID) connect();
  });

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
    if (kilitli()) return;
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

  // Yancı hamle yapamaz — kazara basılan her şey burada durur.
  function kilitli() {
    if (READONLY) { flash('Yancısın — hamleyi oyuncu yapar, sen sadece akıl verirsin.'); return true; }
    return false;
  }

  function selectedIds() {
    // S.selected istemcide yaşıyor ve sunucudan gelen güncellemede temizlenmiyordu.
    // Açış/işleme sonrası elden çıkmış taşların id'leri kümede kalıyor, "At"
    // düğmesi 1'den fazla id görüp sessizce hiçbir şey yapmıyordu.
    const S = api.S;
    const el = S.players && S.players[SEAT] ? (S.players[SEAT].hand || []) : [];
    const elde = new Set(el.map(t => t.id));
    return Array.from(S.selected || []).filter(id => elde.has(id));
  }

  function bind() {
    const on = (id, fn) => { const e = document.getElementById(id); if (e) e.onclick = fn; };
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
      // son iki taş okeyse "At" düğmesi çift okey atışına döner
      const el = (api.S.players[SEAT] || {}).hand || [];
      if (el.length === 2 && el.every(t => api.isWild(t)) && api.S.players[SEAT].opened) {
        act('ciftokey'); return;
      }
      const ids = selectedIds();
      if (ids.length === 0) { flash('Atmak için bir taş seç.'); return; }
      if (ids.length > 1) { flash('Atmak için tek taş seç — ' + ids.length + ' taş işaretli.'); return; }
      act('discard', { id: ids[0] });
    });

    window.__netDiscard = id => act('discard', { id });
  }

  window.doDiscard = function (auto) {
    const el = (api.S.players[SEAT] || {}).hand || [];
    if (el.length === 2 && el.every(t => api.isWild(t)) && api.S.players[SEAT].opened) {
      act('ciftokey'); return;
    }
    const ids = selectedIds();
    if (ids.length !== 1) return;
    act('discard', { id: ids[0] });
  };
  window.doTake = function () { act('take'); };
  window.doDeck = function () { act('deck'); };
  // taşı yerdeki bir perin üstüne sürükleyince
  window.processInto = function (id, mi) { act('meldput', { id, mi }); };
  window.doDoubleOkey = function () { act('ciftokey'); };

  window.addEventListener('error', e => {
    try { note('Hata: ' + (e.message || 'bilinmeyen')); } catch (_) {}
  });
  window.addEventListener('unhandledrejection', e => {
    try { note('Hata: ' + ((e.reason && e.reason.message) || e.reason)); } catch (_) {}
  });

  showEntry();
})();