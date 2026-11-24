// Desktop app bridge: gives the planner page window.nrApp on top of Tauri's IPC.
// Loaded before the page script, so the page sees it on its first run.
(function () {
  const T = window.__TAURI__;
  if (!T) return;
  const { invoke } = T.core;
  const { listen } = T.event;
  window.nrApp = {
    listSaves: () => invoke('list_saves'),
    readSave: async (path) => new Uint8Array(await invoke('read_save', { path })),
    pickSave: () => invoke('pick_save'),
    watchSave: (path) => invoke('watch_save', { path }),
    onSaveChanged: (cb) => {
      let stop = null;
      listen('saves:changed', (e) => cb(e.payload)).then((f) => { stop = f; });
      return () => { if (stop) stop(); };
    },
    version: () => T.app.getVersion(),
    // the latest release page on GitHub, in the default browser (the address is fixed in the app)
    openReleases: () => invoke('open_releases'),
    // updates: the installed app downloads, verifies and installs a new version itself; the portable exe can't
    installed: () => invoke('app_installed'),
    updateCheck: () => invoke('update_check'),
    updateInstall: () => invoke('update_install'),
    onUpdateProgress: (cb) => {
      let stop = null;
      listen('update:progress', (e) => cb(e.payload)).then((f) => { stop = f; });
      return () => { if (stop) stop(); };
    },
    // the overlay: a click-through window on top of the game with this run's Nightlord and the Dreglord cycle timer
    overlay: {
      show: (x, y) => invoke('overlay_show', { x: x ?? null, y: y ?? null }),
      hide: () => invoke('overlay_hide'),
      lock: (locked) => invoke('overlay_lock', { locked }),
      hotkey: (key) => invoke('overlay_hotkey', { key }),
      toggleKey: (key) => invoke('overlay_toggle_key', { key }),   // the key that shows or hides the overlay
      onToggle: (cb) => { listen('overlay:toggle', () => cb()); },
      config: (cfg) => T.event.emit('overlay:config', cfg),
      run: (run) => T.event.emit('overlay:run', run),
      example: (run) => T.event.emit('overlay:example', run),   // what the card shows while you move it with no run going on
      test: () => T.event.emit('overlay:restart'),
      stop: () => T.event.emit('overlay:stop'),
    },
  };
})();
