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
    // the overlay: a click-through window on top of the game with this run's Nightlord and the Dreglord timer
    overlay: {
      show: (x, y) => invoke('overlay_show', { x: x ?? null, y: y ?? null }),
      hide: () => invoke('overlay_hide'),
      lock: (locked) => invoke('overlay_lock', { locked }),
      hotkey: (key) => invoke('overlay_hotkey', { key }),
      config: (cfg) => T.event.emit('overlay:config', cfg),
      run: (run) => T.event.emit('overlay:run', run),
      test: () => T.event.emit('overlay:hotkey'),
    },
  };
})();
