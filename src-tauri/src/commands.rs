use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::models::{Asset, Config, Library, MatchRules};
use crate::{config, scanner, store, AppState};

#[derive(Clone, Serialize)]
struct ScanProgress {
    scanned: usize,
    current_dir: String,
}

#[derive(Clone, Serialize)]
struct ScanDone {
    count: usize,
}

#[derive(Clone, Serialize)]
struct ScanError {
    message: String,
}

/// 把绝对路径转成相对库根的路径（不在库根下则返回空串）
fn to_rel(root: &Path, abs: &str) -> String {
    if abs.is_empty() {
        return String::new();
    }
    let root_s = root
        .to_string_lossy()
        .replace('\\', "/")
        .trim_end_matches('/')
        .to_string();
    let abs_s = abs.replace('\\', "/");
    match abs_s.strip_prefix(&root_s) {
        Some(rel) => rel.trim_start_matches('/').to_string(),
        None => String::new(),
    }
}

#[tauri::command]
pub fn get_config(state: State<AppState>) -> Config {
    state.config.lock().unwrap().clone()
}

#[tauri::command]
pub fn set_config(state: State<AppState>, cfg: Config) -> Result<(), String> {
    *state.config.lock().unwrap() = cfg.clone();
    config::save(&state.app_data_dir, &cfg)
}

#[tauri::command]
pub fn add_library(state: State<AppState>, name: String, path: String) -> Result<Library, String> {
    let mut cfg = state.config.lock().unwrap().clone();
    let id = format!(
        "lib-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    );
    let lib = Library {
        id: id.clone(),
        name,
        path,
    };
    cfg.libraries.push(lib.clone());
    if cfg.active_library_id.is_none() {
        cfg.active_library_id = Some(id);
    }
    config::save(&state.app_data_dir, &cfg)?;
    *state.config.lock().unwrap() = cfg;
    Ok(lib)
}

#[tauri::command]
pub fn remove_library(state: State<AppState>, id: String) -> Result<(), String> {
    let mut cfg = state.config.lock().unwrap().clone();
    cfg.libraries.retain(|l| l.id != id);
    if cfg.active_library_id.as_deref() == Some(id.as_str()) {
        cfg.active_library_id = cfg.libraries.first().map(|l| l.id.clone());
    }
    config::save(&state.app_data_dir, &cfg)?;
    *state.config.lock().unwrap() = cfg;
    store::remove(&state.app_data_dir, &id);
    Ok(())
}

#[tauri::command]
pub fn set_active_library(state: State<AppState>, id: String) -> Result<(), String> {
    let mut cfg = state.config.lock().unwrap().clone();
    cfg.active_library_id = Some(id);
    config::save(&state.app_data_dir, &cfg)?;
    *state.config.lock().unwrap() = cfg;
    Ok(())
}

/// 启动后台扫描（立即返回），进度/完成/取消通过事件回报。
#[tauri::command]
pub fn start_scan(app: AppHandle, state: State<AppState>, lib_id: String) -> Result<(), String> {
    if state.scanning_flag.load(Ordering::SeqCst) {
        return Err("正在扫描中".into());
    }
    let cfg = state.config.lock().unwrap().clone();
    let lib = cfg
        .libraries
        .iter()
        .find(|l| l.id == lib_id)
        .ok_or("库不存在")?
        .clone();
    let root = PathBuf::from(&lib.path);
    if !root.exists() {
        return Err(format!("路径不存在: {}", lib.path));
    }

    let rules = cfg.match_rules.clone();
    let art_rel = to_rel(&root, &cfg.art_folder);
    let tools_rel = to_rel(&root, &cfg.tools_folder);
    let extra_dirs: Vec<String> = [art_rel, tools_rel]
        .into_iter()
        .filter(|s| !s.is_empty())
        .collect();
    let app_data_dir = state.app_data_dir.clone();
    let cancel = state.cancel_flag.clone();
    let pause = state.pause_flag.clone();
    let scanning = state.scanning_flag.clone();

    state.scanning_flag.store(true, Ordering::SeqCst);
    state.cancel_flag.store(false, Ordering::SeqCst);
    state.pause_flag.store(false, Ordering::SeqCst);

    std::thread::spawn(move || {
        run_scan(app, lib_id, root, rules, extra_dirs, app_data_dir, cancel, pause, scanning);
    });

    Ok(())
}

fn run_scan(
    app: AppHandle,
    lib_id: String,
    root: PathBuf,
    rules: MatchRules,
    extra_dirs: Vec<String>,
    app_data_dir: PathBuf,
    cancel: Arc<AtomicBool>,
    pause: Arc<AtomicBool>,
    scanning: Arc<AtomicBool>,
) {
    let result = scanner::scan(&root, &rules, &extra_dirs, &cancel, &pause, |count, dir| {
        let _ = app.emit(
            "scan://progress",
            ScanProgress {
                scanned: count,
                current_dir: dir,
            },
        );
    });

    match result {
        Ok(Some(mut assets)) => {
            let count = assets.len();
            // 增量：保留未变文件的用户元数据（标签/说明/链接），避免重扫清空标注
            merge_metadata(&mut assets, &store::load(&app_data_dir, &lib_id));
            match store::save(&app_data_dir, &lib_id, &assets) {
                Ok(()) => {
                    let _ = app.emit("scan://done", ScanDone { count });
                }
                Err(e) => {
                    let _ = app.emit("scan://error", ScanError { message: e });
                }
            }
        }
        Ok(None) => {
            let _ = app.emit("scan://cancelled", ());
        }
        Err(e) => {
            let _ = app.emit("scan://error", ScanError { message: e });
        }
    }
    scanning.store(false, Ordering::SeqCst);
}

#[tauri::command]
pub fn cancel_scan(state: State<AppState>) {
    state.cancel_flag.store(true, Ordering::SeqCst);
}

/// 增量：把旧索引里未变文件的用户元数据（标签/说明/链接）合并到新扫描结果。
fn merge_metadata(new_assets: &mut [Asset], old_assets: &[Asset]) {
    use std::collections::HashMap;
    let old: HashMap<&str, &Asset> = old_assets.iter().map(|a| (a.id.as_str(), a)).collect();
    for a in new_assets.iter_mut() {
        if let Some(o) = old.get(a.id.as_str()) {
            a.tags = o.tags.clone();
            a.description = o.description.clone();
            a.link = o.link.clone();
            a.edited = o.edited;
        }
    }
}

#[tauri::command]
pub fn pause_scan(state: State<AppState>) {
    state.pause_flag.store(true, Ordering::SeqCst);
}

#[tauri::command]
pub fn resume_scan(state: State<AppState>) {
    state.pause_flag.store(false, Ordering::SeqCst);
}

#[tauri::command]
pub fn list_assets(state: State<AppState>, lib_id: String) -> Vec<Asset> {
    store::load(&state.app_data_dir, &lib_id)
}

#[tauri::command]
pub fn update_asset(
    state: State<AppState>,
    lib_id: String,
    id: String,
    tags: Vec<String>,
    description: String,
    link: String,
) -> Result<(), String> {
    let mut assets = store::load(&state.app_data_dir, &lib_id);
    if let Some(a) = assets.iter_mut().find(|a| a.id == id) {
        a.tags = tags;
        a.description = description;
        a.link = link;
        a.edited = true;
    }
    store::save(&state.app_data_dir, &lib_id, &assets)
}

#[tauri::command]
pub fn rename_asset(
    state: State<AppState>,
    lib_id: String,
    id: String,
    new_stem: String,
) -> Result<Asset, String> {
    let mut assets = store::load(&state.app_data_dir, &lib_id);
    let (old_path, ext) = {
        let a = assets.iter().find(|a| a.id == id).ok_or("资产不存在")?;
        (std::path::PathBuf::from(&a.path), a.ext.clone())
    };
    // 只改文件名（stem），后缀保持不变
    let new_name = if ext.is_empty() {
        new_stem.clone()
    } else {
        format!("{}.{}", new_stem, ext)
    };
    let parent = old_path.parent().ok_or("无法定位父目录")?;
    let new_path = parent.join(&new_name);
    if new_path.exists() {
        return Err("目标文件已存在".into());
    }
    std::fs::rename(&old_path, &new_path).map_err(|e| e.to_string())?;

    let rel_dir = assets
        .iter()
        .find(|a| a.id == id)
        .map(|a| a.rel_dir.clone())
        .unwrap_or_default();
    let new_id = if rel_dir.is_empty() {
        new_name.clone()
    } else {
        format!("{}/{}", rel_dir, new_name)
    };

    let mut updated = None;
    for a in assets.iter_mut() {
        if a.id == id {
            a.name = new_name.clone();
            a.stem = new_stem.clone();
            a.id = new_id.clone();
            a.path = new_path.to_string_lossy().to_string();
            updated = Some(a.clone());
        }
    }
    store::save(&state.app_data_dir, &lib_id, &assets)?;
    updated.ok_or("更新失败".into())
}

#[tauri::command]
pub fn delete_asset(
    state: State<AppState>,
    lib_id: String,
    id: String,
) -> Result<(), String> {
    let mut assets = store::load(&state.app_data_dir, &lib_id);
    let path = {
        let a = assets.iter().find(|a| a.id == id).ok_or("资产不存在")?;
        a.path.clone()
    };
    std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    assets.retain(|a| a.id != id);
    store::save(&state.app_data_dir, &lib_id, &assets)
}

#[tauri::command]
pub fn reveal_in_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg("/select,")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn check_path(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn save_rules_file(path: String, rules: MatchRules) -> Result<(), String> {
    let s = serde_json::to_string_pretty(&rules).map_err(|e| e.to_string())?;
    std::fs::write(&path, s).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_rules_file(path: String) -> Result<MatchRules, String> {
    let s = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&s).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_rules_files(dir: String) -> Vec<String> {
    let mut files = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for e in entries.flatten() {
            let name = e.file_name().to_string_lossy().to_string();
            if name.ends_with(".json")
                && (name.starts_with("public_") || name.starts_with("personal_"))
            {
                files.push(name);
            }
        }
    }
    files.sort();
    files
}

/// 生成/返回图片缩略图（本地缓存，避免每次从 NAS 读原图）。
/// 返回缓存缩略图的路径；生成失败则返回原路径。
#[tauri::command]
pub fn get_thumbnail(state: State<AppState>, path: String) -> Result<String, String> {
    let cache_dir = state.app_data_dir.join("thumbnails");
    std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;

    let mtime = std::fs::metadata(&path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let key = {
        use std::hash::{Hash, Hasher};
        let mut h = std::collections::hash_map::DefaultHasher::new();
        path.hash(&mut h);
        mtime.hash(&mut h);
        format!("{:016x}", h.finish())
    };
    let thumb_path = cache_dir.join(format!("{}.png", key));

    if thumb_path.exists() {
        return Ok(thumb_path.to_string_lossy().to_string());
    }

    match image::open(&path) {
        Ok(img) => {
            let thumb = img.thumbnail(320, 320);
            thumb.save(&thumb_path).map_err(|e| e.to_string())?;
            Ok(thumb_path.to_string_lossy().to_string())
        }
        Err(_) => Ok(path), // 无法解码（如超大/特殊格式）则回退原图
    }
}
