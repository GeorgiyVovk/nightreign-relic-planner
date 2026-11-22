// The overlay card: what it shows and how it looks. Shared by the overlay window (tools/overlay.html) and the
// live preview in the planner's Settings, so the two can't drift apart. Every class starts with "oc".
//
// render(cfg, run, t, moving) -> { html, cls, empty, state }
//   cfg: the overlay settings (timer, simple, showTime, showZone, showBar, barH, mk, zones, cycle, key, nl)
//   run: this run's Nightlord as the planner sends it ({name, title, don, ev, weak: [{n, c}]}) or null
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
.oc-weak{font-size:12px;color:var(--oc-muted);margin-top:4px}
.oc-weak b{font-weight:600}
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
      // what it's weak to, coloured by damage type
      + (Array.isArray(run.weak) ? `<div class="oc-weak">${run.weak.length ? 'Weak to ' + run.weak.map(w => `<b style="color:${/^#[0-9a-f]{6}$/i.test(w.c || '') ? w.c : 'inherit'}">${esc(w.n)}</b>`).join(', ') : 'No damage type it is weak to'}</div>` : '') + '</div>';
    if (cfg.timer !== false) { const r = cfg.simple === true ? simple(t) : full(t); html += r.html; state = r.state; }
    if (!html && moving) html = '<div class="oc-sec"><span class="oc-hint">Drag me</span></div>';
    const cls = 'oc' + (state === 'danger' ? ' oc-alert' : state === 'safe' ? ' oc-calm' : '') + (moving ? ' oc-move' : '');
    return { html, cls, empty: !html, state };
  }
  g.NROverlayCard = { css: CSS, render };
})(window);
