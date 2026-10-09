//! 用户标注（标签/说明/链接）的权威源。
//!
//! 存库根 `.assethub/meta.json`，随 NAS 同步，支持团队协作；
//! `index_*.json` 只存扫描结果（缓存），用户标注一律以本文件为准。

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::models::Asset;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MetaEntry {
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub link: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Meta {
    #[serde(default)]
    pub version: u32,
    /// 键 = 资产相对路径（即 Asset.id）
    #[serde(default)]
    pub assets: HashMap<String, MetaEntry>,
}

fn meta_path(lib_root: &Path) -> PathBuf {
    lib_root.join(".assethub").join("meta.json")
}

pub fn load(lib_root: &Path) -> Meta {
    if let Ok(s) = fs::read_to_string(meta_path(lib_root)) {
        if let Ok(m) = serde_json::from_str(&s) {
            return m;
        }
    }
    Meta::default()
}

pub fn save(lib_root: &Path, meta: &Meta) -> Result<(), String> {
    let p = meta_path(lib_root);
    if let Some(dir) = p.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let s = serde_json::to_string_pretty(meta).map_err(|e| e.to_string())?;
    fs::write(&p, s).map_err(|e| e.to_string())
}

/// 把用户标注合并进资产列表（键 = 相对路径 id），覆盖索引里的缓存值。
pub fn apply(assets: &mut [Asset], meta: &Meta) {
    for a in assets.iter_mut() {
        if let Some(entry) = meta.assets.get(&a.id) {
            a.tags = entry.tags.clone();
            a.description = entry.description.clone();
            a.link = entry.link.clone();
            a.edited = true;
        }
    }
}

pub fn set_entry(
    lib_root: &Path,
    id: &str,
    tags: Vec<String>,
    description: String,
    link: String,
) -> Result<(), String> {
    let mut meta = load(lib_root);
    meta.assets
        .insert(id.to_string(), MetaEntry { tags, description, link });
    save(lib_root, &meta)
}

pub fn remove_entry(lib_root: &Path, id: &str) -> Result<(), String> {
    let mut meta = load(lib_root);
    meta.assets.remove(id);
    save(lib_root, &meta)
}

/// 重命名（移动）文件时迁移 meta 键。
pub fn rename_entry(lib_root: &Path, old_id: &str, new_id: &str) -> Result<(), String> {
    let mut meta = load(lib_root);
    if let Some(entry) = meta.assets.remove(old_id) {
        meta.assets.insert(new_id.to_string(), entry);
    }
    save(lib_root, &meta)
}
