mod audio;
mod db;

use audio::AudioPlayer;
use db::LibraryDb;
use std::fs;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AudioPlayer::default())
        .setup(|app| {
            let app_data = app.path().app_data_dir().map_err(|error| format!("Could not locate application data: {error}"))?;
            fs::create_dir_all(&app_data)?;
            app.manage(LibraryDb::open(&app_data.join("library.db"))?);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            audio::load_audio,
            audio::play_audio,
            audio::pause_audio,
            audio::stop_audio,
            audio::seek_audio,
            audio::set_volume,
            audio::player_status,
            db::list_library,
            db::import_library_track,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Seenstruments");
}
