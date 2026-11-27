// Nightreign Relic Planner: desktop shell.
// Shows the planner page and gives it read-only access to Nightreign save files:
// list them, read one, let the user pick one, and say when the game rewrites it.
// Settings > Updates checks GitHub for a newer release; the installed app downloads, checks the signature of and
// installs it (Tauri's updater), the portable one opens the release page.
// Also runs the overlay: a small click-through window on top of the game that shows this run's Nightlord
// (read from the save by the planner page) and a timer started by a global hotkey. It never touches the game itself.
// A tray icon opens the planner, shows or hides the overlay and quits; Settings > App can make the close and minimize
// buttons hide the planner there instead, so the overlay keeps working with the window out of the way.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Mutex,
    },
    thread,
    time::{Duration, UNIX_EPOCH},
};
use tauri::{
    ipc::Response,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_updater::UpdaterExt;
use tauri_plugin_window_state::StateFlags;

#[derive(Serialize, Clone)]
struct SaveInfo {
    path: String,
    file: String,
    folder: String,
    kind: String,
    mtime: f64,
    size: u64,
}

#[derive(Serialize)]
struct SaveList {
    root: String,
    saves: Vec<SaveInfo>,
}

#[derive(Default)]
struct AppState {
    picked: Mutex<Vec<PathBuf>>,
    watch_gen: AtomicU64,
    /// the overlay's hotkeys: the Dreglord timer's, the day timer's and the one that shows or hides the overlay ("" = off)
    hk_timer: Mutex<String>,
    hk_toggle: Mutex<String>,
    hk_day: Mutex<String>,
    toggle_sc: Mutex<Option<Shortcut>>,
    day_sc: Mutex<Option<Shortcut>>,
    /// Settings > App: the close button, or minimizing, hides the planner in the tray instead
    close_to_tray: AtomicBool,
    min_to_tray: AtomicBool,
}

/// %APPDATA%\Nightreign
fn save_root() -> PathBuf {
    let base = std::env::var_os("APPDATA").map(PathBuf::from).unwrap_or_else(|| {
        let home = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME")).unwrap_or_default();
        PathBuf::from(home).join("AppData").join("Roaming")
    });
    base.join("Nightreign")
}

fn has_save_ext(p: &Path) -> bool {
    matches!(p.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()).as_deref(), Some("sl2") | Some("co2"))
}

/// NR0000.sl2 (normal game) and NR0000.co2 (Seamless Co-op / alt saves); never .bak or other files.
fn is_save_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    let (stem, ext) = match lower.rsplit_once('.') {
        Some(x) => x,
        None => return false,
    };
    (ext == "sl2" || ext == "co2") && stem.len() == 6 && stem.starts_with("nr") && stem[2..].chars().all(|c| c.is_ascii_digit())
}

fn mtime_ms(meta: &fs::Metadata) -> f64 {
    meta.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_millis() as f64).unwrap_or(0.0)
}

fn describe(p: &Path) -> Option<SaveInfo> {
    let meta = fs::metadata(p).ok()?;
    if !meta.is_file() {
        return None;
    }
    let file = p.file_name()?.to_string_lossy().to_string();
    let folder = p.parent().and_then(|d| d.file_name()).map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
    let kind = if file.to_ascii_lowercase().ends_with(".co2") { "seamless" } else { "normal" };
    Some(SaveInfo { path: p.to_string_lossy().to_string(), file, folder, kind: kind.into(), mtime: mtime_ms(&meta), size: meta.len() })
}

/// Only saves under %APPDATA%\Nightreign, or files the user picked in the dialog, can be read.
fn readable(p: &Path, state: &AppState) -> bool {
    if !has_save_ext(p) {
        return false;
    }
    if let (Ok(full), Ok(root)) = (fs::canonicalize(p), fs::canonicalize(save_root())) {
        if full.starts_with(&root) {
            return true;
        }
    }
    state.picked.lock().map(|v| v.iter().any(|x| x == p)).unwrap_or(false)
}

fn picked_file(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join("picked-saves.json"))
}

#[tauri::command]
fn list_saves(state: State<AppState>) -> SaveList {
    let root = save_root();
    let mut saves: Vec<SaveInfo> = Vec::new();
    if let Ok(dirs) = fs::read_dir(&root) {
        for d in dirs.flatten() {
            if !d.path().is_dir() {
                continue;
            }
            if let Ok(files) = fs::read_dir(d.path()) {
                for f in files.flatten() {
                    if is_save_name(&f.file_name().to_string_lossy()) {
                        if let Some(info) = describe(&f.path()) {
                            saves.push(info);
                        }
                    }
                }
            }
        }
    }
    if let Ok(picked) = state.picked.lock() {
        for p in picked.iter() {
            let s = p.to_string_lossy().to_string();
            if !saves.iter().any(|x| x.path == s) {
                if let Some(info) = describe(p) {
                    saves.push(info);
                }
            }
        }
    }
    saves.sort_by(|a, b| b.mtime.partial_cmp(&a.mtime).unwrap_or(std::cmp::Ordering::Equal));
    SaveList { root: root.to_string_lossy().to_string(), saves }
}

#[tauri::command]
fn read_save(path: String, state: State<AppState>) -> Result<Response, String> {
    let p = PathBuf::from(&path);
    if !readable(&p, &state) {
        return Err("Not allowed".into());
    }
    fs::read(&p).map(Response::new).map_err(|e| e.to_string())
}

#[tauri::command]
async fn pick_save(app: AppHandle, state: State<'_, AppState>) -> Result<Option<SaveInfo>, String> {
    let mut dlg = app.dialog().file().set_title("Pick a Nightreign save").add_filter("Nightreign save", &["sl2", "co2"]);
    let root = save_root();
    if root.is_dir() {
        dlg = dlg.set_directory(root);
    }
    let Some(chosen) = dlg.blocking_pick_file() else { return Ok(None) };
    let p = chosen.into_path().map_err(|e| e.to_string())?;
    if !has_save_ext(&p) {
        return Err("Pick a .sl2 or .co2 save".into());
    }
    if let Ok(mut picked) = state.picked.lock() {
        if !picked.contains(&p) {
            picked.push(p.clone());
        }
        if let Some(file) = picked_file(&app) {
            let _ = fs::create_dir_all(file.parent().unwrap_or(Path::new(".")));
            let list: Vec<String> = picked.iter().map(|x| x.to_string_lossy().to_string()).collect();
            let _ = fs::write(file, serde_json::to_string(&list).unwrap_or_default());
        }
    }
    Ok(describe(&p))
}

/// Polls the save every 2 s; when the game rewrites it, waits for the writes to settle and tells the page.
#[tauri::command]
fn watch_save(path: String, app: AppHandle, state: State<AppState>) -> bool {
    let p = PathBuf::from(&path);
    if !readable(&p, &state) {
        return false;
    }
    let gen = state.watch_gen.fetch_add(1, Ordering::SeqCst) + 1;
    thread::spawn(move || {
        let stamp = |p: &Path| fs::metadata(p).map(|m| (mtime_ms(&m), m.len())).unwrap_or((0.0, 0));
        let mut last = stamp(&p);
        loop {
            thread::sleep(Duration::from_secs(2));
            if app.state::<AppState>().watch_gen.load(Ordering::SeqCst) != gen {
                return; // a newer watch replaced this one
            }
            let now = stamp(&p);
            if now != last {
                thread::sleep(Duration::from_millis(1500));
                last = stamp(&p);
                let _ = app.emit("saves:changed", path.clone());
            }
        }
    });
    true
}

const OVERLAY_W: f64 = 240.0;

#[derive(Serialize)]
struct OverlayPos {
    x: f64,
    y: f64,
}

/// Opens the overlay window (or shows it again): borderless, transparent, always on top, clicks pass through.
/// Async because creating a window from a synchronous command can deadlock on Windows.
#[tauri::command]
async fn overlay_show(app: AppHandle, x: Option<f64>, y: Option<f64>) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("overlay") {
        return w.show().map_err(|e| e.to_string());
    }
    let mut b = WebviewWindowBuilder::new(&app, "overlay", WebviewUrl::App("overlay.html".into()))
        .title("Nightreign overlay")
        .inner_size(OVERLAY_W, 112.0)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .shadow(false)
        .focused(false);
    b = match (x, y) {
        (Some(x), Some(y)) => b.position(x, y),
        _ => b.position(40.0, 40.0),
    };
    let w = b.build().map_err(|e| e.to_string())?;
    w.set_ignore_cursor_events(true).map_err(|e| e.to_string())
}

#[tauri::command]
async fn overlay_hide(app: AppHandle) -> Result<(), String> {
    match app.get_webview_window("overlay") {
        Some(w) => w.close().map_err(|e| e.to_string()),
        None => Ok(()),
    }
}

/// Unlocked, the overlay takes the mouse so it can be dragged; locked, clicks go through to the game.
/// Returns where it sits now, in logical pixels, so the page can remember it.
#[tauri::command]
async fn overlay_lock(app: AppHandle, locked: bool) -> Result<Option<OverlayPos>, String> {
    let Some(w) = app.get_webview_window("overlay") else { return Ok(None) };
    w.set_ignore_cursor_events(locked).map_err(|e| e.to_string())?;
    let _ = app.emit("overlay:locked", locked);
    let p = w.outer_position().map_err(|e| e.to_string())?;
    let s = w.scale_factor().map_err(|e| e.to_string())?;
    Ok(Some(OverlayPos { x: p.x as f64 / s, y: p.y as f64 / s }))
}

const RELEASES: &str = "https://github.com/GeorgiyVovk/nightreign-relic-planner/releases/latest";

/// Opens the app's latest release page in the default browser, for Settings > Updates.
/// The address is fixed here; the page passes nothing.
#[tauri::command]
fn open_releases() -> Result<(), String> {
    #[cfg(windows)]
    let r = std::process::Command::new("explorer").arg(RELEASES).spawn();
    #[cfg(target_os = "macos")]
    let r = std::process::Command::new("open").arg(RELEASES).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let r = std::process::Command::new("xdg-open").arg(RELEASES).spawn();
    r.map(|_| ()).map_err(|e| e.to_string())
}

/// The installer puts an uninstaller next to the app; the portable exe has none, and can't update itself.
#[tauri::command]
fn app_installed() -> bool {
    std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.join("uninstall.exe").is_file())).unwrap_or(false)
}

#[derive(Serialize)]
struct UpdateInfo {
    version: String,
    notes: Option<String>,
}

/// Asks the release's latest.json whether a newer, signed version is out.
#[tauri::command]
async fn update_check(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
    let found = app.updater().map_err(|e| e.to_string())?.check().await.map_err(|e| e.to_string())?;
    Ok(found.map(|u| UpdateInfo { version: u.version.clone(), notes: u.body.clone() }))
}

/// Downloads the new version, checks its signature against the key built into the app, and runs its installer;
/// the page hears the download's progress as "update:progress" (bytes so far, total). Windows closes the app
/// to install; elsewhere it restarts.
#[tauri::command]
async fn update_install(app: AppHandle) -> Result<(), String> {
    let found = app.updater().map_err(|e| e.to_string())?.check().await.map_err(|e| e.to_string())?;
    let Some(update) = found else { return Err("No update to install".into()) };
    let (tx, mut got) = (app.clone(), 0u64);
    update
        .download_and_install(
            move |chunk, total| {
                got += chunk as u64;
                let _ = tx.emit("update:progress", (got, total));
            },
            || {},
        )
        .await
        .map_err(|e| e.to_string())?;
    app.restart();
}

/// The overlay page asks for the size its card needs: always the height, and the width only for
/// simple mode's bare square (otherwise the usual width).
#[tauri::command]
async fn overlay_fit(app: AppHandle, h: f64, w: Option<f64>) -> Result<(), String> {
    let Some(win) = app.get_webview_window("overlay") else { return Ok(()) };
    let w = w.unwrap_or(OVERLAY_W).clamp(24.0, 400.0);
    win.set_size(tauri::LogicalSize::new(w, h.clamp(8.0, 400.0))).map_err(|e| e.to_string())
}

/// One global hotkey (e.g. "F8"); an empty string turns it off.
#[tauri::command]
fn overlay_hotkey(app: AppHandle, key: String) -> Result<(), String> {
    if let Ok(mut g) = app.state::<AppState>().hk_timer.lock() {
        *g = key;
    }
    register_hotkeys(&app)
}

/// The key that shows or hides the overlay (e.g. "F9"); an empty string turns it off. It stays registered while the
/// overlay is hidden, so it can bring it back.
#[tauri::command]
fn overlay_toggle_key(app: AppHandle, key: String) -> Result<(), String> {
    if let Ok(mut g) = app.state::<AppState>().hk_toggle.lock() {
        *g = key;
    }
    register_hotkeys(&app)
}

/// The day timer's key (e.g. "F7"); an empty string turns it off.
#[tauri::command]
fn overlay_day_key(app: AppHandle, key: String) -> Result<(), String> {
    if let Ok(mut g) = app.state::<AppState>().hk_day.lock() {
        *g = key;
    }
    register_hotkeys(&app)
}

/// Registers the overlay hotkeys afresh: the show/hide key, the timer's key and the day timer's key, each unless it
/// is the same key as one before it.
fn register_hotkeys(app: &AppHandle) -> Result<(), String> {
    let st = app.state::<AppState>();
    let timer = st.hk_timer.lock().map(|g| g.clone()).unwrap_or_default();
    let toggle = st.hk_toggle.lock().map(|g| g.clone()).unwrap_or_default();
    let day = st.hk_day.lock().map(|g| g.clone()).unwrap_or_default();
    let gs = app.global_shortcut();
    gs.unregister_all().map_err(|e| e.to_string())?;
    let mut toggle_sc = None;
    if !toggle.is_empty() {
        let sc: Shortcut = toggle.parse().map_err(|_| format!("Unknown key: {toggle}"))?;
        gs.register(sc).map_err(|e| e.to_string())?;
        toggle_sc = Some(sc);
    }
    if let Ok(mut g) = st.toggle_sc.lock() {
        *g = toggle_sc;
    }
    if !timer.is_empty() && timer != toggle {
        let sc: Shortcut = timer.parse().map_err(|_| format!("Unknown key: {timer}"))?;
        gs.register(sc).map_err(|e| e.to_string())?;
    }
    let mut day_sc = None;
    if !day.is_empty() && day != toggle && day != timer {
        let sc: Shortcut = day.parse().map_err(|_| format!("Unknown key: {day}"))?;
        gs.register(sc).map_err(|e| e.to_string())?;
        day_sc = Some(sc);
    }
    if let Ok(mut g) = st.day_sc.lock() {
        *g = day_sc;
    }
    Ok(())
}

/// The page says what the close and minimize buttons should do (Settings > App), at start and when it changes.
#[tauri::command]
fn app_tray(app: AppHandle, close: bool, min: bool) {
    let st = app.state::<AppState>();
    st.close_to_tray.store(close, Ordering::SeqCst);
    st.min_to_tray.store(min, Ordering::SeqCst);
}

/// Brings the planner back from the tray (or the taskbar) to the front.
fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// The tray icon: a left click opens the planner; the menu opens it, shows or hides the overlay (as its hotkey does)
/// and quits, which closes the app for real whatever the close button does.
fn make_tray(app: &tauri::App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open the planner", true, None::<&str>)?;
    let overlay = MenuItem::with_id(app, "overlay", "Show or hide the overlay", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &overlay, &PredefinedMenuItem::separator(app)?, &quit])?;
    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("Nightreign Relic Planner")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, ev| match ev.id().as_ref() {
            "open" => show_main(app),
            "overlay" => {
                let _ = app.emit("overlay:toggle", ());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, ev| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = ev {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

/// Keeps the planner window inside its screen's usable area, so the taskbar stays visible. A window too big for the
/// screen (the default size on a small or scaled screen) shrinks to fit and is centred; one that only hangs over an
/// edge moves back in.
fn fit_to_screen(win: &tauri::WebviewWindow) {
    if win.is_maximized().unwrap_or(false) || win.is_fullscreen().unwrap_or(false) {
        return;
    }
    let mon = match win.current_monitor() {
        Ok(Some(m)) => m,
        _ => match win.primary_monitor() {
            Ok(Some(m)) => m,
            _ => return,
        },
    };
    let wa = *mon.work_area();
    let (Ok(outer), Ok(inner), Ok(pos)) = (win.outer_size(), win.inner_size(), win.outer_position()) else { return };
    let (ax, ay, aw, ah) = (wa.position.x, wa.position.y, wa.size.width as i32, wa.size.height as i32);
    if aw <= 0 || ah <= 0 {
        return;
    }
    let (w, h) = (outer.width as i32, outer.height as i32);
    if w > aw || h > ah {
        let (w, h) = (w.min(aw * 94 / 100), h.min(ah * 94 / 100));
        // set_size takes the inner size: take off the title bar and borders
        let (fw, fh) = (outer.width as i32 - inner.width as i32, outer.height as i32 - inner.height as i32);
        let _ = win.set_size(tauri::PhysicalSize::new((w - fw).max(1) as u32, (h - fh).max(1) as u32));
        let _ = win.set_position(tauri::PhysicalPosition::new(ax + (aw - w) / 2, ay + (ah - h) / 2));
        return;
    }
    let (x, y) = (pos.x.clamp(ax, ax + aw - w), pos.y.clamp(ay, ay + ah - h));
    if (x, y) != (pos.x, pos.y) {
        let _ = win.set_position(tauri::PhysicalPosition::new(x, y));
    }
}

fn main() {
    tauri::Builder::default()
        // starting the app again while it runs (say, hidden in the tray) brings back the one that's open
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(tauri_plugin_dialog::init())
        // the planner window opens where and as big as you left it (maximized too); the overlay places itself
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED)
                .with_denylist(&["overlay"])
                .build(),
        )
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                // the show/hide key goes to the planner (it keeps the overlay's on/off), the timers' keys to the overlay
                .with_handler(|app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        let st = app.state::<AppState>();
                        let toggle = st.toggle_sc.lock().map(|g| *g == Some(*shortcut)).unwrap_or(false);
                        let day = st.day_sc.lock().map(|g| *g == Some(*shortcut)).unwrap_or(false);
                        let _ = app.emit(if toggle { "overlay:toggle" } else if day { "overlay:day" } else { "overlay:hotkey" }, ());
                    }
                })
                .build(),
        )
        // closing the planner closes the overlay too, unless Settings > App sends it to the tray
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            let st = window.app_handle().state::<AppState>();
            match event {
                WindowEvent::CloseRequested { api, .. } if st.close_to_tray.load(Ordering::SeqCst) => {
                    api.prevent_close();
                    let _ = window.hide();
                }
                WindowEvent::Resized(_) if st.min_to_tray.load(Ordering::SeqCst) && window.is_minimized().unwrap_or(false) => {
                    let _ = window.hide();
                }
                WindowEvent::Destroyed => window.app_handle().exit(0),
                _ => {}
            }
        })
        .manage(AppState::default())
        .setup(|app| {
            if let Some(win) = app.get_webview_window("main") {
                fit_to_screen(&win);
            }
            make_tray(app)?;
            if let Some(file) = picked_file(app.handle()) {
                if let Ok(text) = fs::read_to_string(file) {
                    if let Ok(list) = serde_json::from_str::<Vec<String>>(&text) {
                        if let Ok(mut picked) = app.state::<AppState>().picked.lock() {
                            picked.extend(list.into_iter().map(PathBuf::from));
                        }
                    }
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![list_saves, read_save, pick_save, watch_save, overlay_show, overlay_hide, overlay_lock, overlay_fit, overlay_hotkey, overlay_toggle_key, overlay_day_key, app_tray, open_releases, app_installed, update_check, update_install])
        .run(tauri::generate_context!())
        .expect("error while running Nightreign Relic Planner");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn save_names() {
        assert!(is_save_name("NR0000.sl2"));
        assert!(is_save_name("NR0000.co2"));
        assert!(is_save_name("nr0001.SL2"));
        assert!(!is_save_name("NR0000.sl2.bak"));
        assert!(!is_save_name("NRBossArenaProgression.sl2"));
        assert!(!is_save_name("steam_autocloud.vdf"));
    }

    #[test]
    fn finds_and_guards_saves() {
        let tmp = std::env::temp_dir().join(format!("nrp-test-{}", std::process::id()));
        let dir = tmp.join("Nightreign").join("76561190000000000");
        fs::create_dir_all(&dir).unwrap();
        for f in ["NR0000.sl2", "NR0000.co2", "NR0000.sl2.bak", "NRBossArenaProgression.sl2"] {
            fs::write(dir.join(f), b"x").unwrap();
        }
        let outside = tmp.join("other.sl2");
        fs::write(&outside, b"x").unwrap();
        std::env::set_var("APPDATA", &tmp);
        let state = AppState::default();
        assert!(readable(&dir.join("NR0000.co2"), &state));
        assert!(!readable(&outside, &state), "files outside the save folder need to be picked first");
        assert!(!readable(&dir.join("..").join("..").join("other.sl2"), &state));
        state.picked.lock().unwrap().push(outside.clone());
        assert!(readable(&outside, &state));
        let _ = fs::remove_dir_all(&tmp);
    }
}
