//! Playlist queries and membership mutations.

use super::{models::LibraryTrack, models::PlaylistSummary, tracks::row_to_track, LibraryDb};
use rusqlite::params;
use tauri::State;

pub(super) fn list_playlists(
    library: State<'_, LibraryDb>,
) -> Result<Vec<PlaylistSummary>, String> {
    let connection = library.connection()?;
    let mut statement = connection.prepare(
        "SELECT p.id, p.name, COUNT(pt.track_id), COALESCE(SUM(t.duration_seconds), 0), p.created_at
         FROM playlists p
         LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
         LEFT JOIN tracks t ON t.id = pt.track_id
         GROUP BY p.id
         ORDER BY p.updated_at DESC, p.name COLLATE NOCASE",
    ).map_err(|error| format!("Could not query playlists: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(PlaylistSummary {
                id: row.get(0)?,
                name: row.get(1)?,
                track_count: row.get(2)?,
                duration_seconds: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|error| format!("Could not read playlists: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not read a playlist: {error}"))
}

pub(super) fn create_playlist(name: String, library: State<'_, LibraryDb>) -> Result<i64, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("Playlist name cannot be empty".into());
    }
    let connection = library.connection()?;
    connection
        .execute("INSERT INTO playlists (name) VALUES (?1)", params![name])
        .map_err(|error| {
            if error.to_string().contains("UNIQUE") {
                "A playlist with this name already exists".into()
            } else {
                format!("Could not create playlist: {error}")
            }
        })?;
    Ok(connection.last_insert_rowid())
}

pub(super) fn delete_playlist(
    playlist_id: i64,
    library: State<'_, LibraryDb>,
) -> Result<(), String> {
    let connection = library.connection()?;
    connection
        .execute("DELETE FROM playlists WHERE id = ?1", params![playlist_id])
        .map_err(|error| format!("Could not delete playlist: {error}"))?;
    Ok(())
}

pub(super) fn list_playlist_tracks(
    playlist_id: i64,
    library: State<'_, LibraryDb>,
) -> Result<Vec<LibraryTrack>, String> {
    let connection = library.connection()?;
    let mut statement = connection
        .prepare(
            "SELECT t.id, t.path, t.title, t.artist, t.album, t.year, t.duration_seconds,
                    t.cover_mime, t.cover_data, t.analyzed
             FROM playlist_tracks pt JOIN tracks t ON t.id = pt.track_id
             WHERE pt.playlist_id = ?1 ORDER BY pt.position, pt.added_at, t.id",
        )
        .map_err(|error| format!("Could not query playlist tracks: {error}"))?;
    let rows = statement
        .query_map(params![playlist_id], row_to_track)
        .map_err(|error| format!("Could not read playlist tracks: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not read a playlist track: {error}"))
}

pub(super) fn add_track_to_playlist(
    playlist_id: i64,
    track_id: i64,
    library: State<'_, LibraryDb>,
) -> Result<(), String> {
    let connection = library.connection()?;
    connection.execute(
        "INSERT INTO playlist_tracks (playlist_id, track_id, position)
         VALUES (?1, ?2, COALESCE((SELECT MAX(position) + 1 FROM playlist_tracks WHERE playlist_id = ?1), 0))
         ON CONFLICT(playlist_id, track_id) DO NOTHING",
        params![playlist_id, track_id],
    ).map_err(|error| format!("Could not add the track to the playlist: {error}"))?;
    touch_playlist(&connection, playlist_id)
}

pub(super) fn remove_track_from_playlist(
    playlist_id: i64,
    track_id: i64,
    library: State<'_, LibraryDb>,
) -> Result<(), String> {
    let connection = library.connection()?;
    connection
        .execute(
            "DELETE FROM playlist_tracks WHERE playlist_id = ?1 AND track_id = ?2",
            params![playlist_id, track_id],
        )
        .map_err(|error| format!("Could not remove the track from the playlist: {error}"))?;
    touch_playlist(&connection, playlist_id)
}

fn touch_playlist(connection: &rusqlite::Connection, playlist_id: i64) -> Result<(), String> {
    connection
        .execute(
            "UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            params![playlist_id],
        )
        .map_err(|error| format!("Could not update the playlist: {error}"))?;
    Ok(())
}
