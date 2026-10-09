mod commands;
mod config;
#[cfg(target_os = "windows")]
mod drag;
#[cfg(target_os = "windows")]
mod icon;
mod matcher;
mod meta;
mod models;
mod scanner;
mod store;

use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

use tauri::Manager;

use crate::models::Config;

pub struct AppState {
    pub app_data_dir: PathBuf,
    pub config: Mutex<Config>,
    pub cancel_flag: Arc<AtomicBool>,
    pub pause_flag: Arc<AtomicBool>,
    pub scanning_flag: Arc<AtomicBool>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir).ok();
            let cfg = config::load(&dir);
            app.manage(AppState {
                app_data_dir: dir,
                config: Mutex::new(cfg),
                cancel_flag: Arc::new(AtomicBool::new(false)),
                pause_flag: Arc::new(AtomicBool::new(false)),
                scanning_flag: Arc::new(AtomicBool::new(false)),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_config,
            commands::set_config,
            commands::add_board,
            commands::remove_board,
            commands::start_scan,
            commands::cancel_scan,
            commands::pause_scan,
            commands::resume_scan,
            commands::list_assets,
            commands::update_asset,
            commands::rename_asset,
            commands::delete_asset,
            commands::reveal_in_folder,
            commands::check_path,
            commands::open_url,
            commands::save_rules_file,
            commands::load_rules_file,
            commands::list_rules_files,
            commands::get_thumbnail,
            commands::get_full_image,
            commands::get_file_icon,
            commands::start_drag,
            commands::clear_cache
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
