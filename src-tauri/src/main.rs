// Nightreign Relic Planner: desktop shell.
// Shows the planner page and gives it read-only access to Nightreign save files:
// list them, read one, let the user pick one, and say when the game rewrites it.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
    thread,
    time::{Duration, UNIX_EPOCH},
};
use tauri::{ipc::Response, AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .setup(|app| {
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
        .invoke_handler(tauri::generate_handler![list_saves, read_save, pick_save, watch_save])
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
