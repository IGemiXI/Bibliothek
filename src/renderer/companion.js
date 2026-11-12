'use strict';
/* Seite für die Zweitbildschirme: Schnellstart, Fenster auf diesem Bildschirm, Uhr. */
(function () {
  if (!IS_COMPANION) return;
  const displayId = Number(IS_COMPANION);
  document.body.classList.add('companion');
  $('#app').hidden = true;
  const root = document.createElement('div');
  root.id = 'comp';
  document.body.prepend(root);
  let wins = [];

  const myNr = () => { const d = ((S.state && S.state.displays) || []).find((x) => x.id === displayId); return d ? d.nr : 2; };
  const tiles = () => (S.state.config.quickTiles || []);

  function hostOf(url) { try { return new URL(/^https?:/i.test(url) ? url : 'https://' + url).hostname; } catch { return ''; } }
  function tileIcon(t) {
    if (t.type === 'web') {
      const u = `https://www.google.com/s2/favicons?domain=${esc(hostOf(t.url))}&sz=128`;
      return `<span class="mono" style="width:48px;height:48px;font-size:20px;position:absolute">${esc((t.name || '?').charAt(0))}</span><img src="${u}" data-srcs="${attr([u])}" alt="" style="position:relative">`;
    }
    const p = progById(t.programId);
    return p && p.icon ? `<img src="${p.icon}" alt="">` : `<span class="mono" style="width:48px;height:48px;font-size:20px">${esc((t.name || '?').charAt(0))}</span>`;
  }

  function render() {
    if (!S.state) return;
    const now = new Date();
    const nr = myNr();
    const here = wins.filter((w) => w.mon === nr);
    const sys = S.sys;
    root.innerHTML = `
      <div class="comp-bg">${GXArt.hero('Bildschirm' + nr, true)}</div>
      <div class="comp">
        <header class="comp-head">
          <div class="brand" style="padding:0">${I.crest}<div><div class="brand-name">${esc(ownerName() || 'Meine')}</div><div class="brand-sub">Bibliothek · Bildschirm ${nr}</div></div></div>
          <span style="flex:1"></span>
          <button class="btn quiet" data-act="app-window" data-a="front">${I.home.replace('<svg ', '<svg width="18" height="18" ')}Bibliothek öffnen</button>
        </header>
        <div class="comp-body">
          <section class="comp-quick">
            <div class="comp-hello">
              ${GXArt.hero('Gruss' + nr, nr % 2 === 0)}
              <div class="comp-hello-body">
                <div class="eyebrow">${esc(greeting(now))}</div>
                <div class="comp-hello-name">${esc(ownerName() || 'Willkommen')}</div>
                <span style="flex:1"></span>
                <div class="comp-clock"><div class="t">${now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div><div class="d">${now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</div></div>
              </div>
            </div>
            <div class="section-head"><h2>Schnellstart</h2><span class="sub">Öffnet direkt auf diesem Bildschirm</span><span class="grow"></span></div>
            <div class="quick-grid">
              ${tiles().map((t, i) => `<button class="quick" data-act="q-open" data-i="${i}" title="${esc(t.type === 'web' ? t.url : t.name)}">
                <span class="qi">${tileIcon(t)}</span><span class="qn">${esc(t.name)}</span><span class="qs">${t.type === 'web' ? esc(hostOf(t.url).replace(/^www\./, '')) : 'Programm'}</span>
                <span class="rm" data-act="q-remove" data-i="${i}" title="Entfernen">${I.x}</span></button>`).join('')}
              <button class="quick add" data-act="q-add"><span class="qi" style="color:var(--gold)">${I.plus.replace('width="20" height="20"', 'width="34" height="34"')}</span><span class="qn">Hinzufügen</span><span class="qs">Website oder Programm</span></button>
            </div>
          </section>
          <aside class="comp-side">
            <section class="panel widget" style="flex:1;min-height:0">
              <div class="widget-head"><span class="eyebrow">Auf diesem Bildschirm</span><span class="r">${here.length || ''}</span></div>
              <div class="comp-wins">${here.length ? here.map((w) => `<button class="comp-win" data-act="win-focus" data-h="${w.h}">${S.winIcons[w.path] ? `<img src="${S.winIcons[w.path]}" alt="">` : '<span class="ph"></span>'}<span class="t">${esc(w.title)}</span><span class="x" data-act="cw-close" data-h="${w.h}" title="Schließen">${I.x}</span></button>`).join('')
                : '<div class="muted" style="font-size:13px;line-height:1.6">Hier ist gerade nichts geöffnet. Starte etwas aus dem Schnellstart – es landet direkt auf diesem Bildschirm.</div>'}</div>
            </section>
            ${sys ? `<section class="panel widget" style="gap:12px">
              <div class="widget-head"><span class="eyebrow">System</span></div>
              ${[['CPU', sys.cpu + ' %', sys.cpu], sys.gpu ? ['GPU', sys.gpu.util + ' % · ' + sys.gpu.temp + ' °C', sys.gpu.util] : null, ['RAM', (sys.ramUsed / 1073741824).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' / ' + Math.round(sys.ramTotal / 1073741824) + ' GB', 100 * sys.ramUsed / sys.ramTotal]].filter(Boolean).map(([l, v, p]) => `<div><div class="meter-row"><span>${l}</span><span>${v}</span></div><div class="meter"><div style="width:${Math.min(100, p)}%"></div></div></div>`).join('')}
            </section>` : ''}
          </aside>
        </div>
      </div>`;
  }
  window.renderCompanion = render;
  function greeting(d) {
    const h = d.getHours();
    return h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 14 ? 'Mahlzeit' : h < 18 ? 'Guten Tag' : 'Guten Abend';
  }

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
            <div style="max-height:46vh;overflow-y:auto;display:flex;flex-direction:column;gap:4px">${list.map((p) => `<button class="res" data-act="q-save-prog" data-id="${esc(p.id)}"><span class="mi-icon" style="width:30px;height:30px">${p.icon ? `<img src="${p.icon}" alt="" style="width:22px;height:22px">` : ''}</span><span class="t">${esc(p.name)}</span><span class="s">${esc(catLabel(p.category))}</span></button>`).join('')}</div>`}
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
        save(tiles().concat([{ id: 'w' + Date.now(), type: 'web', name, url: /^https?:/i.test(url) ? url : 'https://' + url }]));
      },
      'q-save-prog': (d) => { const p = progById(d.id); if (p) save(tiles().concat([{ id: 'p' + Date.now(), type: 'program', name: p.name, programId: p.id }])); },
    });
    draw();
  }
  async function save(list) { await act(gx.setConfig({ quickTiles: list })); closeOverlay(); }

  Object.assign(ACTIONS, {
    'q-open': (d) => { const t = tiles()[+d.i]; if (t) act(gx.openTile(t, displayId)); },
    'q-remove': (d) => save(tiles().filter((_, i) => i !== +d.i)),
    'q-add': () => addDialog(),
    'cw-close': (d) => { act(gx.closeWindow(+d.h)); setTimeout(refresh, 700); },
  });

  async function refresh() {
    const list = await gx.windows().catch(() => null);
    if (list) {
      wins = list;
      for (const w of list) {
        if (w.path && !(w.path in S.winIcons)) {
          S.winIcons[w.path] = null;
          gx.fileIcon(w.path).then((ic) => { S.winIcons[w.path] = ic; render(); }).catch(() => {});
        }
      }
    }
    S.sys = await gx.system().catch(() => S.sys);
    render();
  }

  (async function init() {
    S.state = await gx.state();
    render();
    refresh();
    setInterval(refresh, 3000);
  })();
})();
