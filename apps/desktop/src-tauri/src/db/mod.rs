//! Persistent local music library.
//!
//! This module exposes the same command surface used by the webview while the
//! implementation is split by responsibility: schema setup, metadata parsing,
//! track persistence, playlist persistence, and serialized response models.

mod metadata;
mod models;
mod playlists;
mod schema;
mod tracks;

use rusqlite::Connection;
use std::{path::Path, sync::Mutex};
use tauri::State;

use models::{LibraryImportResult, LibraryTrack, PlaylistSummary};

/// Application-managed handle to the local music library.
///
/// `rusqlite::Connection` is not concurrently shareable. The mutex serializes
/// the short command-level reads and writes issued by Tauri handlers.
pub struct LibraryDb(Mutex<Connection>);

impl LibraryDb {
    pub fn open(path: &Path) -> Result<Self, String> {
        let connection = Connection::open(path)
            .map_err(|error| format!("Could not open the music library: {error}"))?;
        schema::initialize(&connection)?;
        Ok(Self(Mutex::new(connection)))
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
pub fn import_library_track(
    path: String,
    library: State<'_, LibraryDb>,
) -> Result<LibraryTrack, String> {
    tracks::import_library_track(path, library)
}

#[tauri::command]
pub fn import_library_tracks(
    paths: Vec<String>,
    library: State<'_, LibraryDb>,
) -> Result<LibraryImportResult, String> {
    tracks::import_library_tracks(paths, library)
}

#[tauri::command]
pub fn import_library_folder(
    path: String,
    library: State<'_, LibraryDb>,
) -> Result<LibraryImportResult, String> {
    tracks::import_library_folder(path, library)
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
