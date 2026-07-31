//! Library track queries and imports.

use super::{
    metadata,
    models::{LibraryImportResult, LibraryTrack},
    LibraryDb,
};
use rusqlite::{params, params_from_iter, OptionalExtension};
use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::State;

const AUDIO_EXTENSIONS: [&str; 6] = ["mp3", "flac", "wav", "m4a", "aac", "ogg"];

pub(super) fn row_to_track(row: &rusqlite::Row<'_>) -> rusqlite::Result<LibraryTrack> {
    // Column indexes intentionally mirror the shared track SELECT projection.
    let mime: Option<String> = row.get(7)?;
    let cover: Option<Vec<u8>> = row.get(8)?;
    Ok(LibraryTrack {
        id: row.get(0)?,
        path: row.get(1)?,
        title: row.get(2)?,
        artist: row.get(3)?,
        album: row.get(4)?,
        year: row.get(5)?,
        duration_seconds: row.get(6)?,
        cover_data_url: metadata::cover_data_url(mime, cover),
        analyzed: row.get::<_, i64>(9)? != 0,
    })
}

pub(super) fn list_library(library: State<'_, LibraryDb>) -> Result<Vec<LibraryTrack>, String> {
    let connection = library.connection()?;
    let mut statement = connection.prepare(
        "SELECT id, path, title, artist, album, year, duration_seconds, cover_mime, cover_data, analyzed
         FROM tracks ORDER BY imported_at DESC, id DESC",
    ).map_err(|error| format!("Could not query the music library: {error}"))?;
    let rows = statement
        .query_map([], row_to_track)
        .map_err(|error| format!("Could not read the music library: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not read a track: {error}"))
}

pub(super) fn import_library_track(
    path: String,
    library: State<'_, LibraryDb>,
) -> Result<LibraryTrack, String> {
    let connection = library.connection()?;
    save_library_track(Path::new(&path), &connection)
}

pub(super) fn import_library_tracks(
    paths: Vec<String>,
    library: State<'_, LibraryDb>,
) -> Result<LibraryImportResult, String> {
    let paths = paths.into_iter().map(PathBuf::from).collect();
    import_paths(paths, library)
}

pub(super) fn import_library_folder(
    path: String,
    library: State<'_, LibraryDb>,
) -> Result<LibraryImportResult, String> {
    let folder = Path::new(&path);
    if !folder.is_dir() {
        return Err("The selected music folder does not exist".into());
    }
    let mut paths = Vec::new();
    collect_audio_files(folder, &mut paths)?;
    paths.sort_by_key(|path| path.to_string_lossy().to_lowercase());
    import_paths(paths, library)
}

fn import_paths(
    paths: Vec<PathBuf>,
    library: State<'_, LibraryDb>,
) -> Result<LibraryImportResult, String> {
    let connection = library.connection()?;
    let mut imported = Vec::new();
    let mut skipped_count = 0;

    for path in paths {
        if !is_supported_audio(&path) {
            skipped_count += 1;
            continue;
        }
        match save_library_track(&path, &connection) {
            Ok(track) => imported.push(track),
            Err(_) => skipped_count += 1,
        }
    }

    if imported.is_empty() && skipped_count > 0 {
        return Err("No supported audio files could be imported".into());
    }
    imported.reverse();
    Ok(LibraryImportResult {
        tracks: imported,
        skipped_count,
    })
}

fn save_library_track(
    source_path: &Path,
    connection: &rusqlite::Connection,
) -> Result<LibraryTrack, String> {
    if !source_path.is_file() {
        return Err("The selected audio file does not exist".into());
    }
    let metadata = metadata::parse(source_path)?;
    let path = source_path.to_string_lossy().to_string();

    // The absolute path is the stable identity for the MVP. Re-importing a
    // file refreshes its metadata without creating a duplicate library row.
    connection.execute(
        "INSERT INTO tracks (path, title, artist, album, year, duration_seconds, cover_mime, cover_data)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(path) DO UPDATE SET title = excluded.title, artist = excluded.artist,
         album = excluded.album, year = excluded.year, duration_seconds = excluded.duration_seconds,
         cover_mime = excluded.cover_mime, cover_data = excluded.cover_data,
         updated_at = CURRENT_TIMESTAMP",
        params![
            &path,
            &metadata.title,
            &metadata.artist,
            &metadata.album,
            &metadata.year,
            metadata.duration_seconds,
            &metadata.cover_mime,
            &metadata.cover_data
        ],
    ).map_err(|error| format!("Could not save the track: {error}"))?;

    connection
        .query_row(
            "SELECT id, path, title, artist, album, year, duration_seconds, cover_mime, cover_data, analyzed
             FROM tracks WHERE path = ?1",
            params![&path],
            row_to_track,
        )
        .optional()
        .map_err(|error| format!("Could not reload the saved track: {error}"))?
        .ok_or_else(|| "The saved track could not be found".to_string())
}

fn collect_audio_files(folder: &Path, paths: &mut Vec<PathBuf>) -> Result<(), String> {
    let entries = fs::read_dir(folder)
        .map_err(|error| format!("Could not read the selected music folder: {error}"))?;
    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_dir() {
            let _ = collect_audio_files(&entry.path(), paths);
        } else if file_type.is_file() && is_supported_audio(&entry.path()) {
            paths.push(entry.path());
        }
    }
    Ok(())
}

fn is_supported_audio(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            AUDIO_EXTENSIONS.contains(&extension.to_ascii_lowercase().as_str())
        })
}

pub(super) fn remove_library_tracks(
    track_ids: Vec<i64>,
    library: State<'_, LibraryDb>,
) -> Result<(), String> {
    if track_ids.is_empty() {
        return Ok(());
    }

    let mut connection = library.connection()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start removing tracks: {error}"))?;

    for chunk in track_ids.chunks(500) {
        let placeholders = std::iter::repeat_n("?", chunk.len())
            .collect::<Vec<_>>()
            .join(", ");
        transaction
            .execute(
                &format!("DELETE FROM tracks WHERE id IN ({placeholders})"),
                params_from_iter(chunk),
            )
            .map_err(|error| format!("Could not remove tracks from the library: {error}"))?;
    }

    transaction
        .commit()
        .map_err(|error| format!("Could not finish removing tracks: {error}"))
}
