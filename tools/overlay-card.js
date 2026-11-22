// The overlay card: what it shows and how it looks. Shared by the overlay window (tools/overlay.html) and the
// live preview in the planner's Settings, so the two can't drift apart. Every class starts with "oc".
//
// render(cfg, run, t, moving) -> { html, cls, empty, state }
//   cfg: the overlay settings (timer, simple, showTime, showZone, showBar, barH, mk, zones, cycle, key, nl)
//   run: this run's Nightlord as the planner sends it ({name, title, don, ev, weak: {dmg, st}}) or null
//   t:   seconds into the Dreglord cycle, or null before the first press
(function (g) {
  const CSS = `
.oc{--oc-fg:#DDE3EC;--oc-muted:#8E9AB0;--oc-accent:#AFC3E3;--oc-good:#6CC48C;--oc-bad:#E2685A;--oc-ev:#B48AE8;--oc-line:rgba(175,195,227,.22);
  font-family:"Inter",system-ui,"Segoe UI",sans-serif;font-size:14px;line-height:normal;text-align:left;color:var(--oc-fg);
  border-radius:8px;background:rgba(9,14,24,.78);border:1px solid var(--oc-line);padding:10px 14px;display:flex;flex-direction:column;gap:10px;box-sizing:border-box}
.oc[hidden]{display:none}
.oc *{box-sizing:border-box}
.oc-sec{display:flex;flex-direction:column;gap:8px}
.oc-sec + .oc-sec{border-top:1px solid var(--oc-line);padding-top:10px}
.oc-nl{gap:2px}
.oc-name{font-family:"EB Garamond",Georgia,serif;font-size:24px;font-weight:600;line-height:1.05}
.oc-name .oc-ev{color:var(--oc-ev)}
.oc-sub{font-size:12px;color:var(--oc-muted)}
/* what the Nightlord is weak to: damage types, then statuses, as small tinted tags in their own colours */
.oc-weak{display:grid;grid-template-columns:auto minmax(0,1fr);gap:3px 6px;align-items:start;margin-top:6px}
.oc-wl{grid-row:1 / span 2;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--oc-muted);line-height:18px}
.oc-row{display:flex;flex-wrap:wrap;gap:3px}
.oc-tag{display:inline-flex;align-items:center;gap:3px;height:18px;padding:0 5px 0 4px;border-radius:3px;font-size:10.5px;font-weight:600;line-height:1;
  color:var(--c);background:color-mix(in srgb,var(--c) 16%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--c) 42%,transparent)}
.oc-tag.oc-st{border-radius:9px}
.oc-tag svg{width:11px;height:11px;flex:none;fill:currentColor}
.oc-none{font-size:12px;color:var(--oc-muted)}
.oc-main{display:flex;align-items:baseline;gap:8px}
.oc-big{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:38px;font-weight:600;line-height:1;font-variant-numeric:tabular-nums}
.oc-big small{font-size:16px;color:var(--oc-muted);margin-left:2px}
.oc-zl{margin-left:auto;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
.oc-zbig{font-size:26px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;line-height:38px}
.oc-hint{font-size:13px;color:var(--oc-muted)}
/* the cycle bar: flat blocks with a dark seam at each zone edge, the passed part dimmed, a playhead standing out */
.oc-trackw{position:relative;padding:4px 0}
.oc-track{position:relative;height:8px;border-radius:2px;background:rgba(255,255,255,.12);overflow:hidden}
.oc-track i{position:absolute;top:0;bottom:0;box-shadow:inset 1px 0 0 rgba(0,0,0,.55),inset -1px 0 0 rgba(0,0,0,.55)}
.oc-track i.oc-g{background:#4FAF72} .oc-track i.oc-r{background:#D2483A}
.oc-track s{position:absolute;top:0;bottom:0;left:0;background:rgba(6,9,16,.5);text-decoration:none}
.oc-trackw b{position:absolute;top:0;bottom:0;width:var(--mk,3px);margin-left:calc(var(--mk,3px) / -2);background:var(--mkc,#fff);border-radius:1px;box-shadow:0 0 0 1px rgba(0,0,0,.7)}
.oc-tm.oc-safe .oc-big,.oc-tm.oc-safe .oc-zl,.oc-tm.oc-safe .oc-zbig{color:var(--oc-good)}
.oc-tm.oc-danger .oc-big,.oc-tm.oc-danger .oc-zl,.oc-tm.oc-danger .oc-zbig{color:var(--oc-bad)}
.oc-idle .oc-big{font-size:22px;color:var(--oc-muted);font-weight:500}
.oc-idle .oc-main{min-height:38px;align-items:center}
/* the frame takes the zone's colour, thick enough to read without the bar; drawn inside, so nothing moves */
.oc.oc-alert{border-color:var(--oc-bad);box-shadow:inset 0 0 0 2px var(--oc-bad)}
.oc.oc-calm{border-color:var(--oc-good);box-shadow:inset 0 0 0 2px var(--oc-good)}
.oc.oc-move{border:1px dashed var(--oc-accent);cursor:move}
/* simple mode: the timer part is filled with the zone's colour, out to the card's edges */
.oc-simple{margin:0 -14px -10px;padding:10px 14px;border-radius:0 0 7px 7px}
.oc > .oc-simple:first-child{margin-top:-10px;border-radius:7px}
.oc-sec + .oc-simple{border-top:0}
.oc-simple.oc-safe{background:#3E9B60} .oc-simple.oc-danger{background:#D2483A} .oc-simple.oc-run{background:#F2F4F8}
.oc-tm.oc-simple.oc-safe .oc-zbig,.oc-tm.oc-simple.oc-danger .oc-zbig{color:#fff}
.oc-simple .oc-main{min-height:38px;align-items:center}
.oc-simple.oc-idle .oc-zbig{color:var(--oc-muted);font-weight:500;letter-spacing:0;text-transform:none;font-size:22px}
`;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // Our own small icons for each damage type and status (not the game's art), drawn on a 16-unit grid in the
  // tag's colour. Lines use stroke, shapes use fill.
  const L = d => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
  const ICON = {
    Physical: '<path d="M14.6 1.4 14 4 6.6 11.4 4.6 9.4 12 2z"/><path d="M2.6 8.6 7.4 13.4 6.4 14.4 1.6 9.6z"/><path d="M3.4 11.6 4.4 12.6 2.2 14.8 1.2 13.8z"/>',
    Strike: '<path d="M9.6 1.2 14.8 6.4 12.6 8.6 7.4 3.4z"/><path d="M9.1 6.5 9.5 6.9 3.4 15 1 12.6 9.1 4.5z"/>',
    Slash: L('M2 11.5 10.5 2M5 14 14 4M8.5 14.5 14.5 8'),
    Pierce: '<path d="M15 1 13.4 7.8 11.1 6 3.2 13.9 2.1 12.8 10 4.9 8.2 2.6z"/>',
    Magic: '<path d="M7 .8c.6 3.4 1.8 4.6 5.2 5.2C8.8 6.6 7.6 7.8 7 11.2 6.4 7.8 5.2 6.6 1.8 6 5.2 5.4 6.4 4.2 7 .8z"/><path d="M12.4 9.6c.3 1.6.8 2.1 2.4 2.4-1.6.3-2.1.8-2.4 2.4-.3-1.6-.8-2.1-2.4-2.4 1.6-.3 2.1-.8 2.4-2.4z"/>',
    Fire: '<path d="M8.4.8c2.6 2.4 5.1 5 5.1 8.6a5.5 5.5 0 0 1-11 0c0-2.1 1-3.6 2.4-4.8.1 1.4.7 2.5 1.8 3C6.7 5.3 7.3 2.9 8.4.8z"/>',
    Lightning: '<path d="M10 .8 2.8 9.2h4.4L5.6 15.2 13.2 6.6H8.9z"/>',
    Holy: '<circle cx="8" cy="8" r="3"/>' + L('M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3'),
    Poison: '<circle cx="6" cy="10.2" r="3.9"/><circle cx="12" cy="5" r="2.6"/><circle cx="12.6" cy="12.2" r="1.6"/><circle cx="4.6" cy="3" r="1.5"/>',
    Rot: '<path d="M8 1.6c.9 1.8 1.7 2 3.3 1.1-.4 1.8 0 2.4 2 2.7-1.5 1.1-1.5 1.8-.3 3.3-2 .1-2.4.7-2.1 2.7-1.7-1-2.4-.9-3.2 1-.9-1.9-1.6-2-3.3-1 .3-2-.1-2.6-2.1-2.7 1.3-1.5 1.3-2.2-.3-3.3 2-.3 2.4-.9 2-2.7 1.6.9 2.4.7 3.3-1.1z"/>',
    Bleed: '<path d="M8 1c2.9 3.9 5.1 6.6 5.1 9.4a5.1 5.1 0 0 1-10.2 0C2.9 7.6 5.1 4.9 8 1z"/>',
    Frost: L('M8 1v14M1.9 4.5l12.2 7M1.9 11.5l12.2-7M6.3 2.3 8 3.6l1.7-1.3M6.3 13.7 8 12.4l1.7 1.3'),
    Sleep: '<path d="M9.6 1.2A6.6 6.6 0 1 0 14.8 11 5.2 5.2 0 0 1 9.6 1.2z"/>',
    Madness: '<path d="M.8 8C2.9 4.5 5.3 2.9 8 2.9s5.1 1.6 7.2 5.1c-2.1 3.5-4.5 5.1-7.2 5.1S2.9 11.5.8 8z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="2.5"/>',
    Blight: '<path fill-rule="evenodd" d="M8 1.2c-3.6 0-6.1 2.4-6.1 5.5 0 1.8.9 3.2 2.3 4V13c0 .6.4 1 1 1h5.6c.6 0 1-.4 1-1v-2.3c1.4-.8 2.3-2.2 2.3-4 0-3.1-2.5-5.5-6.1-5.5zM5.4 6.3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm5.2 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/>',
  };
  ICON.Standard = ICON.Physical;
  // run.weak: {dmg: [{n, c}], st: [{n, c}]} (an older planner sends just the damage list)
  const col = c => /^#[0-9a-f]{6}$/i.test(c || '') ? c : '#C9D1DC';
  function weakHtml(w) {
    if (!w) return '';
    const dmg = Array.isArray(w) ? w : (w.dmg || []), st = Array.isArray(w) ? [] : (w.st || []);
    if (!dmg.length && !st.length) return '<div class="oc-weak"><span class="oc-none">No weakness in the game data</span></div>';
    const tag = (x, cls) => `<span class="oc-tag${cls}" style="--c:${col(x.c)}">${ICON[x.n] ? `<svg viewBox="0 0 16 16" aria-hidden="true">${ICON[x.n]}</svg>` : ''}${esc(x.n)}</span>`;
    // damage types on the first line, statuses (rounded) on the next, both after one "Weak" label
    return `<div class="oc-weak"><span class="oc-wl">Weak</span>${dmg.length ? `<div class="oc-row">${dmg.map(x => tag(x, '')).join('')}</div>` : ''}${st.length ? `<div class="oc-row">${st.map(x => tag(x, ' oc-st')).join('')}</div>` : ''}</div>`;
  }
  function render(cfg, run, t, moving) {
    cfg = cfg || {};
    // The cycle counts from the start point up to the cycle length, then from 0 again. Zones colour parts of it:
    // green safe, red danger, white where no zone is set. A zone may wrap past the end (15 to 2).
    const C = Math.max(1, +cfg.cycle || 20), zones = Array.isArray(cfg.zones) ? cfg.zones : [];
    const inZone = (z, x) => z.a === z.b ? false : z.a < z.b ? (x >= z.a && x < z.b) : (x >= z.a || x < z.b);
    const zoneAt = x => zones.find(z => inZone(z, x)) || null;
    const zname = z => z ? (z.c === 'r' ? 'Danger' : 'Safe') : '';
    const stateOf = z => z ? (z.c === 'r' ? 'danger' : 'safe') : 'run';
    function nextChange(x) {
      const cur = zoneAt(x); let best = null;
      for (const z of zones) for (const e of [z.a, z.b]) { let d = (e - x + C) % C; if (d < 0.05) d += C; if (best === null || d < best) best = d; }
      if (best === null || best >= C) return null;
      const nx = zoneAt((x + best + 0.01) % C);
      if (nx === cur) return null;
      return nx ? `${zname(nx)} in ${best.toFixed(1)} s` : `${zname(cur)} ends in ${best.toFixed(1)} s`;
    }
    function track(x) {
      const segs = [];
      for (const z of zones) {
        const parts = z.a === z.b ? [] : z.a < z.b ? [[z.a, z.b - z.a]] : [[z.a, C - z.a], [0, z.b]];
        for (const [p, w] of parts) segs.push(`<i class="oc-${z.c === 'r' ? 'r' : 'g'}" style="left:${(p / C * 100).toFixed(2)}%;width:${(w / C * 100).toFixed(2)}%"></i>`);
      }
      // the bar can be made much taller, so it reads at a glance; the playhead grows with it
      const h = Math.max(4, Math.min(80, +cfg.barH || 8)), mk = h >= 28 ? 5 : h >= 16 ? 4 : 3, at = x == null ? null : (x / C * 100).toFixed(2);
      // 'danger' turns the playhead yellow only while inside a danger zone
      const dz = x != null && (zoneAt(x) || {}).c === 'r';
      const mkc = cfg.mk === 'danger' ? (dz ? '#ffd43b' : '#ffffff') : /^#[0-9a-f]{6}$/i.test(cfg.mk || '') ? cfg.mk : '#ffffff';
      return `<div class="oc-trackw" style="--mk:${mk}px;--mkc:${mkc}"><div class="oc-track" style="height:${h}px">${segs.join('')}${at == null ? '' : `<s style="width:${at}%"></s>`}</div>${at == null ? '' : `<b style="left:${at}%"></b>`}</div>`;
    }
    // before the first press the timer says Ready and names the hotkey; after that there are no labels at all
    const ready = simple => `<div class="oc-sec oc-tm ${simple ? 'oc-simple ' : ''}oc-idle"><div class="oc-main"><span class="${simple ? 'oc-zbig' : 'oc-big'}">Ready</span></div><span class="oc-hint">Press ${esc(cfg.key || 'the hotkey')} when the status shows</span>`;
    function full(x) {
      const bar = cfg.showBar !== false, nums = cfg.showTime !== false, names = cfg.showZone !== false;
      if (x == null) return { state: 'idle', html: ready(false) + (bar ? track(null) : '') + '</div>' };
      const z = zoneAt(x), nx = nextChange(x), state = stateOf(z);
      // without the seconds, the zone name takes the big line (nothing there outside a zone)
      const main = nums ? `<div class="oc-main"><span class="oc-big">${x.toFixed(1)}<small>s</small></span>${z && names ? `<span class="oc-zl">${zname(z)}</span>` : ''}</div><span class="oc-hint">${nx || '&nbsp;'}</span>`
        : z && names ? `<div class="oc-main"><span class="oc-zbig">${zname(z)}</span></div>` : '';
      return { state, html: `<div class="oc-sec oc-tm oc-${state}">${main}${bar ? track(x) : ''}</div>` };
    }
    function simple(x) {
      if (x == null) return { state: 'idle', html: ready(true) + '</div>' };
      const z = zoneAt(x), state = stateOf(z);
      return { state, html: `<div class="oc-sec oc-tm oc-simple oc-${state}"><div class="oc-main"><span class="oc-zbig">${cfg.showZone !== false ? zname(z) : ''}</span></div></div>` };
    }
    let html = '', state = null;
    if (cfg.nl !== false && run) html += `<div class="oc-sec oc-nl"><div class="oc-name">${run.ev ? '<span class="oc-ev">Everdark</span> ' : ''}${esc(run.name)}</div><div class="oc-sub">${esc(run.title)}</div>`
      + weakHtml(run.weak) + '</div>';
    if (cfg.timer !== false) { const r = cfg.simple === true ? simple(t) : full(t); html += r.html; state = r.state; }
    if (!html && moving) html = '<div class="oc-sec"><span class="oc-hint">Drag me</span></div>';
    const cls = 'oc' + (state === 'danger' ? ' oc-alert' : state === 'safe' ? ' oc-calm' : '') + (moving ? ' oc-move' : '');
    return { html, cls, empty: !html, state };
  }
  g.NROverlayCard = { css: CSS, render, icon: n => ICON[n] || '' };
})(window);
