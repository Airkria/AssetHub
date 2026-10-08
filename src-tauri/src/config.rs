use std::fs;
use std::path::{Path, PathBuf};

use crate::models::Config;

pub fn config_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("config.json")
}

pub fn load(app_data_dir: &Path) -> Config {
    let p = config_path(app_data_dir);
    if let Ok(s) = fs::read_to_string(&p) {
        if let Ok(c) = serde_json::from_str(&s) {
            return c;
        }
    }
    Config::default()
}

pub fn save(app_data_dir: &Path, cfg: &Config) -> Result<(), String> {
    fs::create_dir_all(app_data_dir).map_err(|e| e.to_string())?;
    let s = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    fs::write(config_path(app_data_dir), s).map_err(|e| e.to_string())
}
