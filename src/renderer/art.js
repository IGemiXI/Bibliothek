'use strict';
/* Erzeugt stimmungsvolle Landschaftsszenen als Ersatz-Cover, wenn ein Spiel kein Bild hat. */
(function () {
  const PALETTES = [
    ['#1a0f12', '#a8602c', '#ffd9a0', '#6a3a24', '#3a2016', '#140c09'],
    ['#0f0d10', '#4a3a3a', '#e8d6b8', '#3a2e2e', '#221a1a', '#0e0b0b'],
    ['#160d0a', '#7a3a1c', '#ffb070', '#5a2a18', '#2e1610', '#100907'],
    ['#130a10', '#5a2436', '#f0b8a8', '#43202c', '#26121a', '#0f080b'],
    ['#0c100b', '#3c4a2a', '#e8e0a8', '#2c3820', '#182014', '#0a0d08'],
    ['#141008', '#6a5426', '#ffe2a0', '#4e3e1e', '#2a2212', '#0f0c07'],
    ['#0d0f0c', '#2e3a30', '#d8e2c0', '#243028', '#151c17', '#0a0c0a'],
    ['#120c0d', '#5e3a2c', '#ffd0a8', '#462a22', '#281914', '#0e0a09'],
  ];

  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return Math.abs(h) || 1;
  }
  function rng(seed) {
    let s = seed % 2147483647 || 1;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }
  function ridge(r, w, h, base, amp, step) {
    let d = 'M0 ' + h + ' L0 ' + base;
    for (let x = step; x <= w + step; x += step) d += ' L' + Math.min(x, w) + ' ' + (base - r() * amp).toFixed(1);
    return d + ' L' + w + ' ' + h + ' Z';
  }

  let uid = 0;
  /** Kleines Hochformat-Cover (144×196) */
  function cover(name) {
    const h = hash(name);
    const p = PALETTES[h % PALETTES.length];
    const r = rng(h);
    const id = 'gxs' + (uid++);
    const sx = (30 + r() * 84).toFixed(0);
    const sy = (50 + r() * 40).toFixed(0);
    return `<svg class="scene" viewBox="0 0 144 196" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[0]}"/><stop offset="1" stop-color="${p[1]}"/></linearGradient></defs>
      <rect width="144" height="196" fill="url(#${id})"/>
      <circle cx="${sx}" cy="${sy}" r="34" fill="${p[2]}" opacity="0.12"/>
      <circle cx="${sx}" cy="${sy}" r="16" fill="${p[2]}" opacity="0.8"/>
      <path d="${ridge(r, 144, 196, 128, 38, 18)}" fill="${p[3]}"/>
      <path d="${ridge(r, 144, 196, 150, 26, 14)}" fill="${p[4]}"/>
      <path d="${ridge(r, 144, 196, 172, 16, 10)}" fill="${p[5]}"/>
    </svg>`;
  }

  /** Breites Titelbild; mit castle=true die Burg für World of Warcraft */
  function hero(name, castle) {
    const r = rng(castle ? 7 : hash(name));
    const W = 920, H = 340;
    const id = 'gxh' + (uid++);
    const castlePaths = castle ? `
      <path d="M590 262 V176 h7 v-9 h7 v9 h7 v-9 h7 v9 h7 V262 Z M625 262 V206 h70 V262 Z M642 206 V146 h8 v-11 h7 v11 h8 v-11 h7 v11 h8 V206 Z M655 135 L661 98 L667 135 Z M695 262 V184 h7 v-9 h7 v9 h7 v-9 h7 v9 h7 V262 Z" fill="#140d0a"/>
      <rect x="658" y="160" width="4" height="7" rx="1" fill="#ffd27a"/>
      <rect x="604" y="196" width="3" height="6" rx="1" fill="#ffd27a" opacity="0.8"/>
      <rect x="708" y="200" width="3" height="6" rx="1" fill="#ffd27a" opacity="0.7"/>` : '';
    const far = ridge(r, W, H, 230, 70, 46);
    const mid = ridge(r, W, H, 262, 40, 30);
    const near = ridge(r, W, H, 300, 30, 22);
    return `<svg class="scene" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a0f12"/><stop offset="0.55" stop-color="#4a2a1c"/><stop offset="0.8" stop-color="#9a5a2a"/><stop offset="1" stop-color="#d89a4a"/></linearGradient>
        <radialGradient id="${id}g" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffe2a6" stop-opacity="0.9"/><stop offset="0.35" stop-color="#f0b860" stop-opacity="0.35"/><stop offset="1" stop-color="#f0b860" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#${id}s)"/>
      <circle cx="700" cy="215" r="170" fill="url(#${id}g)"/>
      <circle cx="700" cy="215" r="26" fill="#ffe7b8" opacity="0.85"/>
      <path d="${far}" fill="#5a3322" opacity="0.75"/>
      <path d="${mid}" fill="#2a1912"/>
      ${castlePaths}
      <path d="${near}" fill="#0d0907"/>
    </svg>`;
  }

  window.GXArt = { cover, hero, hash };
})();
