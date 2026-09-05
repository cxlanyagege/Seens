//! Persistent local music library.
//!
//! This module exposes the same command surface used by the webview while the
//! implementation is split by responsibility: schema setup, metadata parsing,
//! track persistence, playlist persistence, and serialized response models.

mod analysis;
mod imports;
mod metadata;
mod models;
mod playlists;
mod schema;
mod tracks;

use rusqlite::Connection;
use std::{
    path::Path,
    sync::{Arc, Mutex},
};
use tauri::State;

use crate::analyzer::InstrumentAnalysis;
use models::{LibraryImportResult, LibraryTrack, PlaylistSummary};

/// Application-managed handle to the local music library.
///
/// `rusqlite::Connection` is not concurrently shareable. The mutex serializes
/// the short command-level reads and writes issued by Tauri handlers.
#[derive(Clone)]
pub struct LibraryDb(Arc<Mutex<Connection>>);

impl LibraryDb {
    pub fn open(path: &Path) -> Result<Self, String> {
        let mut connection = Connection::open(path)
            .map_err(|error| format!("Could not open the music library: {error}"))?;
        schema::initialize(&mut connection)?;
        Ok(Self(Arc::new(Mutex::new(connection))))
    }

    pub(super) fn connection(&self) -> Result<std::sync::MutexGuard<'_, Connection>, String> {
        self.0
            .lock()
            .map_err(|_| "The music library is unavailable".to_string())
    }
}

// Keep command definitions in this module so `lib.rs` can retain the stable
// `db::<command>` registration paths expected by Tauri's generated wrappers.
// The implementations themselves live in the feature-focused modules below.
#[tauri::command]
pub fn list_library(library: State<'_, LibraryDb>) -> Result<Vec<LibraryTrack>, String> {
    tracks::list_library(library)
}

#[tauri::command]
pub async fn import_library_track(
    path: String,
    library: State<'_, LibraryDb>,
) -> Result<LibraryTrack, String> {
    imports::run(library.inner().clone(), move |library| {
        imports::import_track(&path, library)
    })
    .await
}

#[tauri::command]
pub async fn import_library_tracks(
    paths: Vec<String>,
    library: State<'_, LibraryDb>,
) -> Result<LibraryImportResult, String> {
    imports::run(library.inner().clone(), move |library| {
        imports::import_tracks(paths, library)
    })
    .await
}

#[tauri::command]
pub async fn import_library_folder(
    path: String,
    library: State<'_, LibraryDb>,
) -> Result<LibraryImportResult, String> {
    imports::run(library.inner().clone(), move |library| {
        imports::import_folder(&path, library)
    })
    .await
}

#[tauri::command]
pub fn remove_library_tracks(
    track_ids: Vec<i64>,
    library: State<'_, LibraryDb>,
) -> Result<(), String> {
    tracks::remove_library_tracks(track_ids, library)
}

#[tauri::command]
pub fn list_playlists(library: State<'_, LibraryDb>) -> Result<Vec<PlaylistSummary>, String> {
    playlists::list_playlists(library)
}

#[tauri::command]
pub fn create_playlist(name: String, library: State<'_, LibraryDb>) -> Result<i64, String> {
    playlists::create_playlist(name, library)
}

#[tauri::command]
pub fn delete_playlist(playlist_id: i64, library: State<'_, LibraryDb>) -> Result<(), String> {
    playlists::delete_playlist(playlist_id, library)
}

#[tauri::command]
pub fn list_playlist_tracks(
    playlist_id: i64,
    library: State<'_, LibraryDb>,
) -> Result<Vec<LibraryTrack>, String> {
    playlists::list_playlist_tracks(playlist_id, library)
}

#[tauri::command]
pub fn add_track_to_playlist(
    playlist_id: i64,
    track_id: i64,
    library: State<'_, LibraryDb>,
) -> Result<(), String> {
    playlists::add_track_to_playlist(playlist_id, track_id, library)
}

#[tauri::command]
pub fn remove_track_from_playlist(
    playlist_id: i64,
    track_id: i64,
    library: State<'_, LibraryDb>,
) -> Result<(), String> {
    playlists::remove_track_from_playlist(playlist_id, track_id, library)
}

#[tauri::command]
pub fn get_instrument_analysis(
    track_id: i64,
    library: State<'_, LibraryDb>,
) -> Result<Option<InstrumentAnalysis>, String> {
    analysis::get(&library, track_id)
}

#[tauri::command]
pub async fn analyze_track_instruments(
    track_id: i64,
    library: State<'_, LibraryDb>,
) -> Result<InstrumentAnalysis, String> {
    let path = analysis::track_path(&library, track_id)?;
    let result = tauri::async_runtime::spawn_blocking(move || crate::analyzer::analyze(path))
        .await
        .map_err(|error| format!("The instrument analysis task stopped unexpectedly: {error}"))??;
    analysis::save(&library, track_id, &result)?;
    Ok(result)
}
