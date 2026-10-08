use std::fs;
use std::path::{Path, PathBuf};

use crate::models::Asset;

/// 每个库一个索引文件。当前用 JSON；后续可在此模块内换成 SQLite，接口不变。
pub fn index_path(app_data_dir: &Path, lib_id: &str) -> PathBuf {
    app_data_dir.join(format!("index_{}.json", lib_id))
}

pub fn load(app_data_dir: &Path, lib_id: &str) -> Vec<Asset> {
    if let Ok(s) = fs::read_to_string(index_path(app_data_dir, lib_id)) {
        if let Ok(v) = serde_json::from_str(&s) {
            return v;
        }
    }
    vec![]
}

pub fn save(app_data_dir: &Path, lib_id: &str, assets: &[Asset]) -> Result<(), String> {
    fs::create_dir_all(app_data_dir).map_err(|e| e.to_string())?;
    let s = serde_json::to_string(assets).map_err(|e| e.to_string())?;
    fs::write(index_path(app_data_dir, lib_id), s).map_err(|e| e.to_string())
}

pub fn remove(app_data_dir: &Path, lib_id: &str) {
    let _ = fs::remove_file(index_path(app_data_dir, lib_id));
}
