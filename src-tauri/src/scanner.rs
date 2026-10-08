use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use ignore::WalkBuilder;

use crate::matcher::categorize_asset;
use crate::models::{Asset, MatchRules};

const PREVIEW_EXTS: [&str; 6] = ["png", "jpg", "jpeg", "webp", "gif", "bmp"];
/// 并行遍历线程数（慢 NAS 上过高的并发会互相挤占 IO，8 是较稳的默认值）
const SCAN_THREADS: usize = 8;

/// 并行递归扫描库根目录（ignore 的 WalkParallel）。
/// - `cancel` / `pause`：取消与暂停标志，各线程周期检查。
/// - `on_progress`：约每 150ms 回调一次（已扫描文件数、当前目录）。
/// 返回 `Ok(None)` 表示被取消；`Ok(Some(assets))` 表示完成（已含预览图关联）。
pub fn scan(
    root: &Path,
    rules: &MatchRules,
    extra_dirs: &[String],
    cancel: &Arc<AtomicBool>,
    pause: &Arc<AtomicBool>,
    on_progress: impl Fn(usize, String) + Send + Sync,
) -> Result<Option<Vec<Asset>>, String> {
    let assets: Arc<Mutex<Vec<Asset>>> = Arc::new(Mutex::new(Vec::new()));
    let count = Arc::new(AtomicUsize::new(0));
    let last_emit = Arc::new(AtomicU64::new(0));
    let cancelled = Arc::new(AtomicBool::new(false));

    let cancel = Arc::clone(cancel);
    let pause = Arc::clone(pause);
    let rules = Arc::new(rules.clone());
    let extra_dirs = extra_dirs.to_vec();
    let root = root.to_path_buf();
    let on_progress = Arc::new(on_progress);

    // 确定扫描根：有 include 范围时只遍历那些目录（+ 模块文件夹），否则遍历整个库根
    let mut builder = if rules.include_dirs.is_empty() {
        WalkBuilder::new(&root)
    } else {
        let mut b = WalkBuilder::new(root.join(&rules.include_dirs[0]));
        for inc in rules.include_dirs.iter().skip(1) {
            b.add(root.join(inc));
        }
        for extra in &extra_dirs {
            if !extra.is_empty() {
                b.add(root.join(extra));
            }
        }
        b
    };
    let walker = builder
        .follow_links(false)
        .threads(SCAN_THREADS)
        .build_parallel();

    walker.run(|| {
        let assets = Arc::clone(&assets);
        let count = Arc::clone(&count);
        let last_emit = Arc::clone(&last_emit);
        let cancelled = Arc::clone(&cancelled);
        let cancel = Arc::clone(&cancel);
        let pause = Arc::clone(&pause);
        let rules = Arc::clone(&rules);
        let extra_dirs = extra_dirs.clone();
        let root = root.clone();
        let on_progress = Arc::clone(&on_progress);

        Box::new(move |result| {
            if cancel.load(Ordering::Relaxed) {
                cancelled.store(true, Ordering::Relaxed);
                return ignore::WalkState::Quit;
            }
            while pause.load(Ordering::Relaxed) {
                if cancel.load(Ordering::Relaxed) {
                    cancelled.store(true, Ordering::Relaxed);
                    return ignore::WalkState::Quit;
                }
                std::thread::sleep(Duration::from_millis(100));
            }

            let entry = match result {
                Ok(e) => e,
                Err(_) => return ignore::WalkState::Continue,
            };
            let ft = entry.file_type();

            // 进入目录：仅刷新"当前目录"进度（不增加计数），避免读大目录时进度卡住
            if ft.as_ref().map(|t| t.is_dir()).unwrap_or(false) {
                let now = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);
                let last = last_emit.load(Ordering::Relaxed);
                if now.saturating_sub(last) >= 150
                    && last_emit
                        .compare_exchange(last, now, Ordering::Relaxed, Ordering::Relaxed)
                        .is_ok()
                {
                    let dir_str = entry.path().to_string_lossy().replace('\\', "/");
                    on_progress(count.load(Ordering::Relaxed), dir_str);
                }
                return ignore::WalkState::Continue;
            }
            if !ft.map(|t| t.is_file()).unwrap_or(false) {
                return ignore::WalkState::Continue;
            }

            let path = entry.path();
            let rel = match path.strip_prefix(&root) {
                Ok(r) => r,
                Err(_) => return ignore::WalkState::Continue,
            };
            let rel_str = rel.to_string_lossy().replace('\\', "/");
            // 模块文件夹（美术设定/工具）始终扫描，即使不在 include 范围内
            let in_extra = extra_dirs
                .iter()
                .any(|d| !d.is_empty() && rel_str.starts_with(d.as_str()));
            if !rules.is_included(rel) && !in_extra {
                return ignore::WalkState::Continue;
            }

            // 用遍历时已缓存的 metadata，避免每文件一次额外 stat（NAS 上很贵）
            let meta = entry.metadata().ok();
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            let stem = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();
            let name = path
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();
            let rel_dir = rel
                .parent()
                .map(|p| p.to_string_lossy().replace('\\', "/"))
                .unwrap_or_default();
            let category = categorize_asset(&ext, rel, &rules.category_rules);
            let mtime = meta
                .as_ref()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);

            assets.lock().unwrap().push(Asset {
                id: rel_str.clone(),
                path: path.to_string_lossy().to_string(),
                name,
                stem,
                ext,
                category,
                rel_dir: rel_dir.clone(),
                size: meta.as_ref().map(|m| m.len()).unwrap_or(0),
                mtime,
                is_preview: false,
                preview_paths: vec![],
                tags: vec![],
                edited: false,
                description: String::new(),
                link: String::new(),
            });

            let c = count.fetch_add(1, Ordering::Relaxed) + 1;
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            let last = last_emit.load(Ordering::Relaxed);
            if now.saturating_sub(last) >= 150
                && last_emit
                    .compare_exchange(last, now, Ordering::Relaxed, Ordering::Relaxed)
                    .is_ok()
            {
                on_progress(c, rel_dir);
            }

            ignore::WalkState::Continue
        })
    });

    if cancelled.load(Ordering::Relaxed) {
        return Ok(None);
    }

    // 安全取出扫描结果（不用 try_unwrap，避免线程未完全退出时静默丢数据）
    let mut assets = {
        let mut guard = assets.lock().unwrap();
        std::mem::take(&mut *guard)
    };
    link_previews(&mut assets, &rules);
    // 预览图不参与分类（它只作为包体的缩略图/预览图）
    for a in assets.iter_mut() {
        if a.is_preview {
            a.category = String::new();
        }
    }
    Ok(Some(assets))
}

/// 包体 ↔ 预览图匹配：同目录下，图片 stem 命中规则即视为该包体的预览图（可多张）。
fn link_previews(assets: &mut [Asset], rules: &MatchRules) {
    let mut images: HashMap<(String, String), String> = HashMap::new();
    for a in assets.iter() {
        if PREVIEW_EXTS.contains(&a.ext.as_str()) {
            images
                .entry((a.rel_dir.clone(), a.stem.clone()))
                .or_insert(a.path.clone());
        }
    }

    let mut referenced: Vec<String> = Vec::new();
    for a in assets.iter_mut() {
        if PREVIEW_EXTS.contains(&a.ext.as_str()) {
            continue;
        }
        let mut previews: Vec<String> = Vec::new();
        for ((dir, stem), path) in &images {
            if *dir == a.rel_dir && is_preview_stem(stem, &a.stem, rules) {
                previews.push(path.clone());
            }
        }
        previews.sort_by_key(|p| {
            let stem = PathBuf::from(p)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();
            if stem == a.stem {
                0
            } else {
                1
            }
        });
        a.preview_paths = previews.clone();
        referenced.extend(previews);
    }

    for a in assets.iter_mut() {
        if referenced.contains(&a.path) {
            a.is_preview = true;
        }
    }
}

/// 判断图片 stem 是否为该包体的预览图：
/// 同名 / 精确后缀（_preview 等）/ 数字后缀（_1、_2…）。
fn is_preview_stem(img_stem: &str, asset_stem: &str, rules: &MatchRules) -> bool {
    if img_stem == asset_stem {
        return true;
    }
    for suffix in &rules.preview_suffixes {
        if !suffix.is_empty() && img_stem == format!("{}{}", asset_stem, suffix) {
            return true;
        }
    }
    if let Some(rest) = img_stem.strip_prefix(asset_stem) {
        if let Some(num) = rest.strip_prefix('_') {
            if !num.is_empty() && num.chars().all(|c| c.is_ascii_digit()) {
                return true;
            }
        }
    }
    false
}
