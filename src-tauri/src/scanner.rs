use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant, UNIX_EPOCH};

use walkdir::WalkDir;

use crate::matcher::categorize_asset;
use crate::models::{Asset, MatchRules};

const PREVIEW_EXTS: [&str; 6] = ["png", "jpg", "jpeg", "webp", "gif", "bmp"];

/// 递归扫描库根目录。
/// - `cancel` / `pause`：取消与暂停标志，扫描循环周期检查。
/// - `on_progress`：约每 150ms 回调一次（已扫描文件数、当前目录）。
/// 返回 `Ok(None)` 表示被取消；`Ok(Some(assets))` 表示完成（已含预览图关联）。
pub fn scan(
    root: &Path,
    rules: &MatchRules,
    extra_dirs: &[String],
    cancel: &AtomicBool,
    pause: &AtomicBool,
    mut on_progress: impl FnMut(usize, String),
) -> Result<Option<Vec<Asset>>, String> {
    let mut assets: Vec<Asset> = Vec::new();
    let mut count = 0usize;
    let mut last_emit = Instant::now();

    for entry in WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if cancel.load(Ordering::Relaxed) {
            return Ok(None);
        }
        while pause.load(Ordering::Relaxed) {
            if cancel.load(Ordering::Relaxed) {
                return Ok(None);
            }
            std::thread::sleep(Duration::from_millis(100));
        }

        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        let rel = path.strip_prefix(root).map_err(|e| e.to_string())?;
        let rel_str = rel.to_string_lossy().replace('\\', "/");
        // 模块文件夹（美术设定/工具）始终扫描，即使不在 include 范围内
        let in_extra = extra_dirs
            .iter()
            .any(|d| !d.is_empty() && rel_str.starts_with(d.as_str()));
        if !rules.is_included(rel) && !in_extra {
            continue;
        }

        // 用 walkdir 已缓存的 metadata，避免每文件一次额外 stat（NAS 上很贵）
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

        assets.push(Asset {
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

        count += 1;
        if last_emit.elapsed() >= Duration::from_millis(150) {
            on_progress(count, rel_dir);
            last_emit = Instant::now();
        }
    }

    link_previews(&mut assets, rules);
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
    // 收集所有图片：(rel_dir, stem) → path
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
        // 同名排最前（作为主缩略图）
        previews.sort_by_key(|p| {
            let stem = Path::new(p)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("");
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
