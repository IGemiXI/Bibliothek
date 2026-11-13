'use strict';
/* Seite für die Zweitbildschirme: Begrüßung, Schnellstart, Fenster auf diesem Bildschirm. */
(function () {
  if (!IS_COMPANION) return;
  const displayId = Number(IS_COMPANION);
  document.body.classList.add('companion');
  $('#app').hidden = true;
  const root = document.createElement('div');
  root.id = 'comp';
  document.body.prepend(root);
  let wins = [];
  const SIZES = { s: [1, 1, 'Normal'], w: [2, 1, 'Breit'], l: [2, 2, 'Groß'] };
  const GAP = 18;

  const myNr = () => { const d = ((S.state && S.state.displays) || []).find((x) => x.id === displayId); return d ? d.nr : 2; };
  const tiles = () => (S.state.config.quickTiles || []);
  const layout = () => Object.assign({ hello: true, side: true }, S.state.config.compLayout || {});

  function hostOf(url) { try { return new URL(/^https?:/i.test(url) ? url : 'https://' + url).hostname; } catch { return ''; } }
  function tileIcon(t) {
    const mono = `<span class="mono qm">${esc((t.name || '?').charAt(0))}</span>`;
    if (t.icon) return mono + `<img src="${esc(t.icon)}" data-srcs="${attr([t.icon])}" alt="">`;
    if (t.type === 'web') {
      const u = `https://www.google.com/s2/favicons?domain=${esc(hostOf(t.url))}&sz=256`;
      return mono + `<img src="${u}" data-srcs="${attr([u])}" alt="">`;
    }
    const p = progById(t.programId);
    return p && p.icon ? mono + `<img src="${esc(p.icon)}" data-srcs="${attr([p.icon])}" alt="">` : mono;
  }
  function greeting(d) {
    const h = d.getHours();
    return h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 14 ? 'Mahlzeit' : h < 18 ? 'Guten Tag' : 'Guten Abend';
  }

  function tileHtml(t, i) {
    const [w, h] = SIZES[t.size || 's'];
    const sub = t.type === 'web' ? esc(hostOf(t.url).replace(/^www\./, '')) : 'Programm';
    return `<button class="quick${S.compEdit ? ' editing' : ''}" style="grid-column:span ${w};grid-row:span ${h}" data-act="${S.compEdit ? 'noop' : 'q-open'}" data-i="${i}" data-w="${w}" data-h="${h}" title="${esc(t.type === 'web' ? t.url : t.name)}">
      <span class="qi">${tileIcon(t)}</span><span class="qn">${esc(t.name)}</span><span class="qs">${sub}</span>
      ${S.compEdit ? `<span class="qedit">
        <span class="qb" data-act="q-move" data-i="${i}" data-d="-1" title="Nach vorne">‹</span>
        <span class="qb wide" data-act="q-size" data-i="${i}" title="Größe ändern">${SIZES[t.size || 's'][2]}</span>
        <span class="qb wide" data-act="q-icon" data-i="${i}" title="Bild ändern">Bild</span>
        <span class="qb" data-act="q-move" data-i="${i}" data-d="1" title="Nach hinten">›</span>
        <span class="qb del" data-act="q-remove" data-i="${i}" title="Entfernen">${I.x}</span>
      </span>` : ''}
    </button>`;
  }

  function clockHtml(now, cls) {
    return `<div class="comp-clock${cls ? ' ' + cls : ''}"><div class="t">${now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div><div class="d">${now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</div></div>`;
  }

  function render() {
    if (!S.state) return;
    const now = new Date();
    const nr = myNr();
    const L = layout();
    const here = wins.filter((w) => w.mon === nr);
    const sys = S.sys;
    const list = tiles();
    const showAdd = S.compEdit || !list.length;
    const pill = (key, label) => `<button class="pill" data-act="q-layout" data-k="${key}" aria-pressed="${!!L[key]}">${label}</button>`;
    root.innerHTML = `
      <div class="comp-bg">${GXArt.hero('Bildschirm' + nr, true)}</div>
      <div class="comp">
        <header class="comp-head">
          <div class="brand" style="padding:0">${I.crest}<div><div class="brand-name">${esc(ownerName() || 'Meine')}</div><div class="brand-sub">Bibliothek · Bildschirm ${nr}</div></div></div>
          <span style="flex:1"></span>
          ${S.compEdit ? `<span class="muted" style="font-size:12.5px">Anzeigen:</span>${pill('hello', 'Begrüßung')}${pill('side', 'Seitenleiste')}
            <button class="btn gold" data-act="q-edit">Fertig</button>`
            : `<button class="btn quiet" data-act="q-edit">${I.gear.replace('<svg ', '<svg width="17" height="17" ')}Bearbeiten</button>
            <button class="btn quiet" data-act="app-window" data-a="front">${I.home.replace('<svg ', '<svg width="17" height="17" ')}Bibliothek öffnen</button>`}
          ${L.hello ? '' : clockHtml(now)}
        </header>
        <div class="comp-body">
          <section class="comp-main">
            ${L.hello ? `<div class="comp-hello">
              ${GXArt.hero('Gruss' + nr, nr % 2 === 0)}
              <div class="comp-hello-body">
                <div class="eyebrow">${esc(greeting(now))}</div>
                <div class="comp-hello-name">${esc(ownerName() || 'Willkommen')}</div>
                <span style="flex:1"></span>
                ${clockHtml(now, 'left')}
              </div>
            </div>` : ''}
            <div class="quick-area">
              <div class="quick-grid">
                ${list.map(tileHtml).join('')}
                ${showAdd ? `<button class="quick add" data-act="q-add" data-w="1" data-h="1"><span class="qi" style="color:var(--gold)">${I.plus.replace('width="20" height="20"', 'width="40%" height="40%"')}</span><span class="qn">Hinzufügen</span><span class="qs">Website oder Programm</span></button>` : ''}
              </div>
            </div>
          </section>
          ${L.side ? `<aside class="comp-side">
            <section class="panel widget" style="flex:1;min-height:0">
              <div class="widget-head"><span class="eyebrow">Auf diesem Bildschirm</span><span class="r">${here.length || ''}</span></div>
              <div class="comp-wins">${here.length ? here.map((w) => `<button class="comp-win" data-act="win-focus" data-h="${w.h}">${S.winIcons[w.path] ? `<img src="${S.winIcons[w.path]}" alt="">` : '<span class="ph"></span>'}<span class="t">${esc(w.title)}</span><span class="x" data-act="cw-close" data-h="${w.h}" title="Schließen">${I.x}</span></button>`).join('')
                : '<div class="muted" style="font-size:13px;line-height:1.6">Hier ist gerade nichts geöffnet. Starte etwas aus dem Schnellstart – es landet direkt auf diesem Bildschirm.</div>'}</div>
            </section>
            ${S.notif && S.notif.items.length ? `<section class="panel widget" style="gap:8px">
              <div class="widget-head"><span class="eyebrow">Benachrichtigungen</span><span class="r">${S.notif.unread ? S.notif.unread + ' neu' : ''}</span></div>
              ${S.notif.items.slice(0, 4).map((n) => notifRow(n, true)).join('')}
            </section>` : ''}
            ${sys ? `<section class="panel widget" style="gap:12px">
              <div class="widget-head"><span class="eyebrow">System</span></div>
              ${[['CPU', sys.cpu + ' %', sys.cpu], sys.gpu ? ['GPU', sys.gpu.util + ' % · ' + sys.gpu.temp + ' °C', sys.gpu.util] : null, ['RAM', (sys.ramUsed / 1073741824).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' / ' + Math.round(sys.ramTotal / 1073741824) + ' GB', 100 * sys.ramUsed / sys.ramTotal]].filter(Boolean).map(([l, v, p]) => `<div><div class="meter-row"><span>${l}</span><span>${v}</span></div><div class="meter"><div style="width:${Math.min(100, p)}%"></div></div></div>`).join('')}
            </section>` : ''}
          </aside>` : ''}
        </div>
      </div>`;
    fit();
  }
  window.renderCompanion = render;

  /* Kachelgröße so wählen, dass der Platz gefüllt ist: wenige Kacheln = groß, viele = kleiner */
  function pack(cols, spans) {
    const grid = [];
    let rows = 0;
    const free = (r, c, w, h) => { for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (grid[y] && grid[y][x]) return false; return true; };
    for (let [w, h] of spans) {
      w = Math.min(w, cols);
      let placed = false;
      for (let r = 0; !placed && r < 400; r++) {
        for (let c = 0; c + w <= cols; c++) {
          if (free(r, c, w, h)) {
            for (let y = r; y < r + h; y++) { grid[y] = grid[y] || []; for (let x = c; x < c + w; x++) grid[y][x] = 1; }
            rows = Math.max(rows, r + h);
            placed = true;
            break;
          }
        }
      }
    }
    return rows;
  }
  function fit() {
    const area = root.querySelector('.quick-area');
    const grid = root.querySelector('.quick-grid');
    if (!area || !grid) return;
    const W = area.clientWidth - 16;
    const H = area.clientHeight - 16;
    const items = [...grid.children];
    const spans = items.map((el) => [+el.dataset.w || 1, +el.dataset.h || 1]);
    if (!spans.length) return;
    let best = { s: 0, cols: 1 };
    for (let cols = 1; cols <= 14; cols++) {
      const rows = pack(cols, spans);
      const s = Math.min((W - GAP * (cols - 1)) / cols, (H - GAP * (rows - 1)) / rows);
      if (s > best.s) best = { s, cols };
    }
    const s = Math.max(110, Math.min(380, Math.floor(best.s)));
    grid.style.gridTemplateColumns = `repeat(${best.cols}, ${s}px)`;
    grid.style.gridAutoRows = `${s}px`;
    for (const el of items) {
      const h = +el.dataset.h || 1;
      el.style.setProperty('--t', (s * h + GAP * (h - 1)) + 'px');
    }
  }
  window.addEventListener('resize', () => fit());

  function addDialog() {
    let mode = 'web';
    const draw = () => {
      const list = programs().filter((p) => !(S.compQ) || p.name.toLowerCase().includes(S.compQ.toLowerCase())).slice(0, 40);
      $('#overlay').innerHTML = `<div class="modal" style="width:620px"><div class="modal-head"><h2>Zum Schnellstart hinzufügen</h2><button class="icon-btn" style="width:38px;height:38px" data-act="close" aria-label="Schließen">${I.x}</button></div>
        <div class="modal-body" style="display:flex;flex-direction:column;gap:16px">
          <div class="seg"><button data-act="q-mode" data-m="web" aria-pressed="${mode === 'web'}">Website</button><button data-act="q-mode" data-m="program" aria-pressed="${mode === 'program'}">Programm</button></div>
          ${mode === 'web' ? `
            <label style="display:flex;flex-direction:column;gap:8px"><span class="muted" style="font-size:12px">Adresse</span><input class="field" id="qurl" placeholder="z. B. youtube.com" autocomplete="off" spellcheck="false"></label>
            <label style="display:flex;flex-direction:column;gap:8px"><span class="muted" style="font-size:12px">Name</span><input class="field" id="qname" placeholder="z. B. YouTube" autocomplete="off"></label>
            <div class="row" style="justify-content:flex-end"><button class="btn gold" data-act="q-save-web">Hinzufügen</button></div>`
          : `<input class="field" id="qq" placeholder="Programm suchen" value="${esc(S.compQ || '')}" autocomplete="off" spellcheck="false">
            <div style="max-height:46vh;overflow-y:auto;display:flex;flex-direction:column;gap:4px">${list.map((p) => `<button class="res" data-act="q-save-prog" data-id="${esc(p.id)}"><span class="mi-icon" style="width:30px;height:30px">${p.icon ? `<img src="${esc(p.icon)}" alt="" style="width:22px;height:22px">` : ''}</span><span class="t">${esc(p.name)}</span><span class="s">${esc(catLabel(p.category))}</span></button>`).join('')}</div>`}
        </div></div>`;
      $('#overlay').hidden = false;
      const f = $('#qurl') || $('#qq');
      if (f) { f.focus(); if (f.id === 'qq') f.setSelectionRange(f.value.length, f.value.length); }
      const qq = $('#qq');
      if (qq) qq.addEventListener('input', () => { S.compQ = qq.value; draw(); });
      const qurl = $('#qurl');
      if (qurl) qurl.addEventListener('input', () => { const n = $('#qname'); if (!n.dataset.touched) { const h = hostOf(qurl.value).replace(/^www\./, '').split('.')[0]; n.value = h ? h.charAt(0).toUpperCase() + h.slice(1) : ''; } });
      const qname = $('#qname');
      if (qname) qname.addEventListener('input', () => { qname.dataset.touched = '1'; });
    };
    Object.assign(ACTIONS, {
      'q-mode': (d) => { mode = d.m; draw(); },
      'q-save-web': () => {
        const url = $('#qurl').value.trim();
        if (!url) return toast('Bitte eine Adresse eingeben.', 'error');
        const name = $('#qname').value.trim() || hostOf(url);
        save(tiles().concat([{ id: 'w' + Date.now(), type: 'web', name, url: /^https?:/i.test(url) ? url : 'https://' + url, size: 's' }]));
      },
      'q-save-prog': (d) => { const p = progById(d.id); if (p) save(tiles().concat([{ id: 'p' + Date.now(), type: 'program', name: p.name, programId: p.id, size: 's' }])); },
    });
    draw();
  }
  async function save(list) { await act(gx.setConfig({ quickTiles: list })); closeOverlay(); }

  Object.assign(ACTIONS, {
    'q-open': (d) => { const t = tiles()[+d.i]; if (t) act(gx.openTile(t, displayId)); },
    'q-remove': (d) => save(tiles().filter((_, i) => i !== +d.i)),
    'q-add': () => addDialog(),
    'q-icon': (d) => {
      const t = tiles()[+d.i];
      if (!t) return;
      const term = t.type === 'web' ? (hostOf(t.url).replace(/^(www|music)\./, '').split('.')[0]) : t.name;
      openIconPicker({ kind: 'tile', id: t.id }, t.name || term, t.name, t.type === 'web' ? hostOf(t.url) : null);
    },
    'q-edit': () => { S.compEdit = !S.compEdit; render(); },
    'q-move': (d) => {
      const list = tiles().slice();
      const i = +d.i;
      const j = i + +d.d;
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      save(list);
    },
    'q-size': (d) => {
      const order = ['s', 'w', 'l'];
      save(tiles().map((t, i) => (i === +d.i ? Object.assign({}, t, { size: order[(order.indexOf(t.size || 's') + 1) % order.length] }) : t)));
    },
    'q-layout': (d) => { const L = layout(); L[d.k] = !L[d.k]; act(gx.setConfig({ compLayout: L })); },
    'cw-close': (d) => {
      act(gx.closeWindow(+d.h));
      wins = wins.filter((w) => String(w.h) !== String(d.h)); // sofort aus der Liste nehmen
      render();
      setTimeout(refresh, 900);
    },
  });

  let lastKey = '';
  async function refresh() {
    const list = await gx.windows().catch(() => null);
    let changed = false;
    if (list) {
      const key = JSON.stringify(list.map((w) => [w.h, w.title, w.mon]));
      changed = key !== lastKey;
      lastKey = key;
      wins = list;
      for (const w of list) {
        if (w.path && !(w.path in S.winIcons)) {
          S.winIcons[w.path] = null;
          gx.fileIcon(w.path).then((ic) => { S.winIcons[w.path] = ic; render(); }).catch(() => {});
        }
      }
    }
    S.sys = await gx.system().catch(() => S.sys);
    if (!$('#overlay').hidden) return;
    // Nur neu zeichnen, wenn sich die Fenster geändert haben – sonst nur die Messwerte und die Uhr aktualisieren
    if (changed) return render();
    updateLive();
  }
  function updateLive() {
    const now = new Date();
    root.querySelectorAll('.comp-clock .t').forEach((el) => { el.textContent = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); });
    const sys = S.sys;
    if (!sys) return;
    const vals = [[sys.cpu + ' %', sys.cpu]];
    if (sys.gpu) vals.push([sys.gpu.util + ' % · ' + sys.gpu.temp + ' °C', sys.gpu.util]);
    vals.push([(sys.ramUsed / 1073741824).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' / ' + Math.round(sys.ramTotal / 1073741824) + ' GB', 100 * sys.ramUsed / sys.ramTotal]);
    const rows = root.querySelectorAll('.comp-side .meter-row span:last-child');
    const bars = root.querySelectorAll('.comp-side .meter > div');
    vals.forEach(([t, p], i) => { if (rows[i]) rows[i].textContent = t; if (bars[i]) bars[i].style.width = Math.min(100, p) + '%'; });
  }

  (async function init() {
    S.state = await gx.state();
    S.notif = await gx.notifications().catch(() => null);
    render();
    refresh();
    setInterval(refresh, 3000);
  })();
})();
