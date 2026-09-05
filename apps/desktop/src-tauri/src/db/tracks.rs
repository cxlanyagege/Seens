//! Library track queries and persistence of previously parsed metadata.

use super::{metadata, models::LibraryTrack, LibraryDb};
use rusqlite::{params, params_from_iter, OptionalExtension};
use std::path::Path;
use tauri::State;

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

pub(super) fn save_library_track(
    source_path: &Path,
    metadata: metadata::TrackMetadata,
    connection: &rusqlite::Connection,
) -> Result<LibraryTrack, String> {
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
