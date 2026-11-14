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
  };
})();
