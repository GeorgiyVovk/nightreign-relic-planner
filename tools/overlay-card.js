// The overlay card: what it shows and how it looks. Shared by the overlay window (tools/overlay.html) and the
// live preview in the planner's Settings, so the two can't drift apart. Every class starts with "oc".
//
// render(cfg, run, t, moving) -> { html, cls, empty, state, bga }
//   cfg: the overlay settings (timer, simple, showTime, showZone, showBar, barH, mk, zones, cycle, key, nl, nlName, bg)
//   run: this run's Nightlord as the planner sends it ({name, title, don, ev, weak: {dmg, st}}) or null
//   t:   seconds into the Dreglord cycle, or null before the first press
(function (g) {
  const CSS = `
.oc{--oc-fg:#DDE3EC;--oc-muted:#8E9AB0;--oc-accent:#AFC3E3;--oc-good:#6CC48C;--oc-mid:#E8C04A;--oc-bad:#E2685A;--oc-ev:#B48AE8;--oc-line:rgba(175,195,227,.22);
  font-family:"Inter",system-ui,"Segoe UI",sans-serif;font-size:14px;line-height:normal;text-align:left;color:var(--oc-fg);
  border-radius:8px;background:rgba(9,14,24,var(--oc-bga,.7));text-shadow:0 1px 3px rgba(0,0,0,calc((1 - var(--oc-bga,.7)) * .9));border:1px solid var(--oc-line);padding:10px 14px;display:flex;flex-direction:column;gap:10px;box-sizing:border-box}
.oc[hidden]{display:none}
.oc *{box-sizing:border-box}
.oc-sec{display:flex;flex-direction:column;gap:8px}
.oc-sec + .oc-sec{border-top:1px solid var(--oc-line);padding-top:10px}
.oc-nl{gap:7px}
.oc-name{font-family:"EB Garamond",Georgia,serif;font-size:23px;font-weight:600;line-height:1.05}
.oc-name .oc-ev{color:var(--oc-ev)}
.oc-id{display:flex;flex-direction:column;gap:1px}
.oc-sub{font-size:12px;color:var(--oc-muted)}
/* what the Nightlord is weak to, one row under the name: damage types | statuses, as the game's icons */
.oc-weak{display:flex;flex-wrap:wrap;align-items:flex-start;gap:4px}
.oc-sep{flex:none;width:1px;height:20px;margin:3px 5px 0;background:var(--oc-line)}
.oc-tag{display:flex;flex-direction:column;align-items:center;gap:3px;flex:none;color:var(--c)}
.oc-tag svg{width:26px;height:26px;fill:currentColor}
/* the icon zoomed past the game's own bevel, so the symbol fills the tile */
.oc-tag b{display:block;width:26px;height:26px;border-radius:4px;overflow:hidden;box-shadow:0 0 0 1px rgba(0,0,0,.5)}
.oc-tag b img{width:100%;height:100%;display:block;transform:scale(1.22)}
/* how easily a status builds up on it: a green bar under it if easily, yellow if slower, red if very slowly */
.oc-lv1::after,.oc-lv2::after,.oc-lv3::after{content:"";align-self:stretch;height:3px;margin:0 3px;border-radius:2px}
.oc-lv1::after{background:var(--oc-good)}
.oc-lv2::after{background:var(--oc-mid)}
.oc-lv3::after{background:var(--oc-bad)}
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
  // "Ctrl+Shift+KeyO" as people say it: Ctrl + Shift + O
  const keyName = k => String(k || '').split('+').filter(Boolean).map(t => t === 'Super' ? 'Win' : t.replace(/^Key(?=[A-Z]$)/, '').replace(/^Digit(?=\d$)/, '').replace(/^Numpad/, 'Num ').replace(/^Arrow/, '')).join(' + ');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // Our own icons for each damage type and status, drawn for the planner on a 24-unit grid in the type's colour.
  // They use the symbols the game uses for each one, not its art: weapons for the physical types, a glintstone
  // sparkle for magic, a halo for holy, a scarlet bloom for rot, a closed eye for sleep, a flame-crowned eye for madness.
  const ICON = {
    Physical: "<path d=\"M22 2 21.6 5.4 10.9 15.5 8.5 13.1 18.6 2.4Z M4.88 11.32 12.68 19.12 14.52 17.28 6.72 9.48Z M8.88 13.49 6.34 16.04 7.96 17.66 10.51 15.12Z M4.79 17.41a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0Z\"/>",
    Strike: "<path d=\"M22.26 11.07 17.87 15.46 8.54 6.13 12.93 1.74Z M12.71 9.45 2.18 19.98 4.02 21.82 14.55 11.29Z\"/>",
    Slash: "<path d=\"M22.4 1.6C20.6 9.6 14.6 15.6 8.6 18.4L5.6 15.4C12 12.4 17.4 8 22.4 1.6Z M2.68 14.72 9.08 21.12 10.92 19.28 4.52 12.88Z M5.79 16.79 2.19 20.39 3.81 22.01 7.41 18.41Z M1 21.6a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0Z\"/>",
    Pierce: "<path d=\"M22.4 1.6 20 9.4 14.6 10.6 13.4 10.2 13.8 9.4 14.6 4Z M13.72 8.52 1.32 20.92 3.08 22.68 15.48 10.28Z\"/>",
    Magic: "<path d=\"M10 1.5C11.44 9.06 11.44 9.06 19 10.5C11.44 11.94 11.44 11.94 10 19.5C8.56 11.94 8.56 11.94 1 10.5C8.56 9.06 8.56 9.06 10 1.5Z M19 15C19.64 18.36 19.64 18.36 23 19C19.64 19.64 19.64 19.64 19 23C18.36 19.64 18.36 19.64 15 19C18.36 18.36 18.36 18.36 19 15Z M19.4 1.6C19.88 3.52 19.88 3.52 21.8 4C19.88 4.48 19.88 4.48 19.4 6.4C18.92 4.48 18.92 4.48 17 4C18.92 3.52 18.92 3.52 19.4 1.6Z\"/>",
    Fire: "<path fill-rule=\"evenodd\" d=\"M12.6 1.2C13.4 5.6 20 8.6 20 15A8 8 0 0 1 4 15C4 11.4 6 8.8 8 7.4 8 9.8 8.8 11.4 10.4 12.2 9.6 8.2 10.6 4.4 12.6 1.2ZM12.4 13.2C13.6 15.4 16 16.6 16 19A4 4 0 0 1 8 19C8 17.4 8.9 16.2 9.9 15.6 10.3 16.7 10.9 17.3 11.6 17.5 11.3 15.8 11.6 14.4 12.4 13.2Z\"/>",
    Lightning: "<path d=\"M13.4 1 3.8 13.8H11L8.8 23 20.2 9.6H13L15.8 1Z\"/>",
    Holy: "<path fill-rule=\"evenodd\" d=\"M6.6 12a5.4 5.4 0 1 0 10.8 0a5.4 5.4 0 1 0 -10.8 0ZM8.8 12a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0 -6.4 0Z\"/><path d=\"M12 4.4L12 0.6M17.37 6.63L18.79 5.21M19.6 12L23.4 12M17.37 17.37L18.79 18.79M12 19.6L12 23.4M6.63 17.37L5.21 18.79M4.4 12L0.6 12M6.63 6.63L5.21 5.21\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
    Poison: "<path fill-rule=\"evenodd\" d=\"M8.2 1.4H15.8V3.8H14.6V8.4A7.4 7.4 0 1 1 9.4 8.4V3.8H8.2ZM7.5 16.6a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0 -3.8 0ZM12.8 14.6a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0ZM12.3 19.4a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0Z\"/>",
    Rot: "<ellipse cx=\"12\" cy=\"5\" rx=\"3.3\" ry=\"4.4\" transform=\"rotate(0 12 5)\"/><ellipse cx=\"18.66\" cy=\"9.84\" rx=\"3.3\" ry=\"4.4\" transform=\"rotate(72 18.66 9.84)\"/><ellipse cx=\"16.11\" cy=\"17.66\" rx=\"3.3\" ry=\"4.4\" transform=\"rotate(144 16.11 17.66)\"/><ellipse cx=\"7.89\" cy=\"17.66\" rx=\"3.3\" ry=\"4.4\" transform=\"rotate(216 7.89 17.66)\"/><ellipse cx=\"5.34\" cy=\"9.84\" rx=\"3.3\" ry=\"4.4\" transform=\"rotate(288 5.34 9.84)\"/><circle cx=\"12\" cy=\"12\" r=\"2.3\"/>",
    Bleed: "<path d=\"M10 1.6C13 6.4 16.2 9.8 16.2 13.8A6.2 6.2 0 0 1 3.8 13.8C3.8 9.8 7 6.4 10 1.6ZM17.7 6.6a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0 -3.4 0ZM17.7 15.4a2.1 2.1 0 1 0 4.2 0a2.1 2.1 0 1 0 -4.2 0ZM13.3 21.6a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0Z\"/>",
    Frost: "<path d=\"M12 12L12 2M12 5.6L9.72 3.07M12 5.6L14.28 3.07M12 12L20.66 7M17.54 8.8L18.59 5.57M17.54 8.8L20.87 9.51M12 12L20.66 17M17.54 15.2L20.87 14.49M17.54 15.2L18.59 18.43M12 12L12 22M12 18.4L14.28 20.93M12 18.4L9.72 20.93M12 12L3.34 17M6.46 15.2L5.41 18.43M6.46 15.2L3.13 14.49M12 12L3.34 7M6.46 8.8L3.13 9.51M6.46 8.8L5.41 5.57\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
    Sleep: "<path d=\"M2.5 11Q12 19 21.5 11M5.92 13.36L4.4 16.18M9.91 14.81L9.33 17.95M14.09 14.81L14.67 17.95M18.08 13.36L19.6 16.18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M15.5 1.8H20.6L15.5 6.6H20.6\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
    Madness: "<path d=\"M2 15.5Q12 6 22 15.5Q12 25 2 15.5Z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><circle cx=\"12\" cy=\"15.5\" r=\"3\"/><path d=\"M12 1C13.8 3.4 14.6 5.2 13.4 8.2H10.6C9.4 5.2 10.2 3.4 12 1ZM6.4 4.6C7.8 6.2 8.4 7.6 7.8 9.6L6 10.4C5 8.6 5.2 6.6 6.4 4.6ZM17.6 4.6C18.8 6.6 19 8.6 18 10.4L16.2 9.6C15.6 7.6 16.2 6.2 17.6 4.6Z\"/>",
    Blight: "<path fill-rule=\"evenodd\" d=\"M12 1.8C6.6 1.8 2.9 5.4 2.9 10c0 2.7 1.3 4.8 3.4 6v3.4c0 .9.6 1.5 1.5 1.5h8.4c.9 0 1.5-.6 1.5-1.5V16c2.1-1.2 3.4-3.3 3.4-6 0-4.6-3.7-8.2-9.1-8.2ZM5.8 10.4a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0 -4.6 0ZM13.6 10.4a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0 -4.6 0ZM12 13.6 13.3 16H10.7Z\"/>",
  };
  ICON.Standard = ICON.Physical;
  // the game's own damage type and status icons, inlined at build time (tools/game-icons); the drawings above
  // stand in without them
  const IMG = /*@game-icons*/{};
  IMG.Standard = IMG.Physical;
  // run.weak: {dmg: [{n, c}], st: [{n, c}]} (an older planner sends just the damage list)
  const col = c => /^#[0-9a-f]{6}$/i.test(c || '') ? c : '#C9D1DC';
  function weakHtml(w) {
    if (!w) return '';
    const dmg = Array.isArray(w) ? w : (w.dmg || []), st = Array.isArray(w) ? [] : (w.st || []);
    if (!dmg.length && !st.length) return '<div class="oc-weak"><span class="oc-none">No weakness</span></div>';
    // icons only; the name stays as the tag's title and for screen readers (a type with no icon shows its name)
    // a status may carry lv: 1 builds up easily, 2 slower, 3 very slowly (a green, yellow or red bar under it)
    const tag = (x, cls) => {
      const lv = [1, 2, 3].includes(x.lv) ? x.lv : 0, name = esc(x.n + ['', ', builds up easily', ', builds up slower', ', builds up very slowly'][lv]);
      cls += lv ? ' oc-lv' + lv : '';
      return IMG[x.n]
        ? `<span class="oc-tag${cls}" title="${name}" role="img" aria-label="${name}"><b><img src="${IMG[x.n]}" alt=""></b></span>`
        : `<span class="oc-tag${cls}" style="--c:${col(x.c)}" title="${name}" role="img" aria-label="${name}">${ICON[x.n] ? `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[x.n]}</svg>` : esc(x.n)}</span>`;
    };
    // damage types, a divider, then statuses, all in one row
    return `<div class="oc-weak">${dmg.map(x => tag(x, '')).join('')}${dmg.length && st.length ? '<i class="oc-sep"></i>' : ''}${st.map(x => tag(x, ' oc-st')).join('')}</div>`;
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
      // the playhead's colour (white or cyan)
      const mkc = /^#[0-9a-f]{6}$/i.test(cfg.mk || '') ? cfg.mk : '#ffffff';
      return `<div class="oc-trackw" style="--mk:${mk}px;--mkc:${mkc}"><div class="oc-track" style="height:${h}px">${segs.join('')}${at == null ? '' : `<s style="width:${at}%"></s>`}</div>${at == null ? '' : `<b style="left:${at}%"></b>`}</div>`;
    }
    // before the timer starts it says Ready and names the hotkey; after that there are no labels at all
    const ready = simple => `<div class="oc-sec oc-tm ${simple ? 'oc-simple ' : ''}oc-idle"><div class="oc-main"><span class="${simple ? 'oc-zbig' : 'oc-big'}">Ready</span></div><span class="oc-hint">${cfg.key === '' ? 'Set a timer hotkey in Settings' : `Double-press ${esc(keyName(cfg.key) || 'the hotkey')} when the status shows`}</span>`;
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
    // the Nightlord's name, its expedition's (cfg.nlName 'exp') or both, the expedition small under the name ('both');
    // what it's weak to in a row under that
    const ev = run && run.ev ? '<span class="oc-ev">Everdark</span> ' : '';
    if (cfg.nl !== false && run) html += `<div class="oc-sec oc-nl"><div class="oc-id"><div class="oc-name">${ev}${esc(cfg.nlName === 'exp' ? run.title : run.name)}</div>${cfg.nlName === 'both' ? `<div class="oc-sub">${esc(run.title)}</div>` : ''}</div>`
      + weakHtml(run.weak) + '</div>';
    if (cfg.timer !== false) { const r = cfg.simple === true ? simple(t) : full(t); html += r.html; state = r.state; }
    if (!html && moving) html = '<div class="oc-sec"><span class="oc-hint">Drag me</span></div>';
    const cls = 'oc' + (state === 'danger' ? ' oc-alert' : state === 'safe' ? ' oc-calm' : '') + (moving ? ' oc-move' : '');
    // how solid the card's dark background is, 0 to 1 (cfg.bg is 0 to 100); the host sets it as --oc-bga
    const bga = Math.min(100, Math.max(0, cfg.bg == null || isNaN(+cfg.bg) ? 70 : +cfg.bg)) / 100;
    return { html, cls, empty: !html, state, bga };
  }
  g.NROverlayCard = { css: CSS, render, icon: n => ICON[n] || '' };
})(window);
