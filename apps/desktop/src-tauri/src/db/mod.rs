//! Persistent local music library and metadata extraction.

use base64::{engine::general_purpose::STANDARD, Engine};
use lofty::{
    file::{AudioFile, TaggedFileExt},
    picture::PictureType,
    prelude::Accessor,
    probe::read_from_path,
};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use std::{path::Path, sync::Mutex};
use tauri::State;

// rusqlite connections are not concurrently shareable. The mutex serializes
// short command-level reads and writes while satisfying Tauri's state bounds.
pub struct LibraryDb(Mutex<Connection>);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryTrack {
    id: i64,
    path: String,
    title: String,
    artist: String,
    album: String,
    year: String,
    duration_seconds: f64,
    cover_data_url: Option<String>,
    analyzed: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistSummary {
    id: i64,
    name: String,
    track_count: i64,
    duration_seconds: f64,
    created_at: String,
}

struct TrackMetadata {
    title: String,
    artist: String,
    album: String,
    year: String,
    duration_seconds: f64,
    cover_mime: Option<String>,
    cover_data: Option<Vec<u8>>,
}

impl LibraryDb {
    pub fn open(path: &Path) -> Result<Self, String> {
        let connection = Connection::open(path)
            .map_err(|error| format!("Could not open the music library: {error}"))?;
        // WAL keeps reads responsive while a later background analysis job is
        // writing results. The schema is intentionally created idempotently.
        connection
            .execute_batch(
                "PRAGMA journal_mode = WAL;
             PRAGMA foreign_keys = ON;
             CREATE TABLE IF NOT EXISTS tracks (
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               path TEXT NOT NULL UNIQUE,
               title TEXT NOT NULL, artist TEXT NOT NULL, album TEXT NOT NULL,
               year TEXT NOT NULL DEFAULT '', duration_seconds REAL NOT NULL DEFAULT 0,
               cover_mime TEXT, cover_data BLOB, analyzed INTEGER NOT NULL DEFAULT 0,
               imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
               updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
             );
             CREATE TABLE IF NOT EXISTS playlists (
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               name TEXT NOT NULL COLLATE NOCASE UNIQUE,
               created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
               updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
             );
             CREATE TABLE IF NOT EXISTS playlist_tracks (
               playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
               track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
               position INTEGER NOT NULL DEFAULT 0,
               added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
               PRIMARY KEY (playlist_id, track_id)
             );",
            )
            .map_err(|error| format!("Could not initialize the music library: {error}"))?;
        Ok(Self(Mutex::new(connection)))
    }

    fn connection(&self) -> Result<std::sync::MutexGuard<'_, Connection>, String> {
        self.0
            .lock()
            .map_err(|_| "The music library is unavailable".to_string())
    }
}

fn detect_image_mime(bytes: &[u8]) -> &'static str {
    // Some tag formats omit or misreport artwork MIME types, so prefer the
    // image signature before handing the value to the webview.
    if bytes.starts_with(b"\x89PNG") {
        "image/png"
    } else if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        "image/jpeg"
    } else if bytes.starts_with(b"GIF8") {
        "image/gif"
    } else if bytes.starts_with(b"RIFF") {
        "image/webp"
    } else {
        "application/octet-stream"
    }
}

fn data_url(mime: Option<String>, data: Option<Vec<u8>>) -> Option<String> {
    // Covers are returned as data URLs because the bytes already live in
    // SQLite and this avoids granting the webview access to arbitrary files.
    let bytes = data?;
    let mime = mime.unwrap_or_else(|| detect_image_mime(&bytes).to_string());
    Some(format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
}

fn row_to_track(row: &rusqlite::Row<'_>) -> rusqlite::Result<LibraryTrack> {
    // Column indexes intentionally mirror the SELECT lists in both commands.
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
        cover_data_url: data_url(mime, cover),
        analyzed: row.get::<_, i64>(9)? != 0,
    })
}

fn parse_metadata(path: &Path) -> Result<TrackMetadata, String> {
    let tagged_file =
        read_from_path(path).map_err(|error| format!("Could not read audio metadata: {error}"))?;
    // Prefer the container's canonical tag, but accept any available tag for
    // files that were written by less consistent encoders.
    let tag = tagged_file
        .primary_tag()
        .or_else(|| tagged_file.first_tag());
    let fallback_title = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("Unknown track");
    let title = tag
        .and_then(|value| value.title())
        .map(|value| value.into_owned())
        .unwrap_or_else(|| fallback_title.to_string());
    let artist = tag
        .and_then(|value| value.artist())
        .map(|value| value.into_owned())
        .unwrap_or_else(|| "Unknown artist".into());
    let album = tag
        .and_then(|value| value.album())
        .map(|value| value.into_owned())
        .unwrap_or_else(|| "Unknown album".into());
    let year = tag
        .and_then(|value| value.date())
        .map(|date| date.year.to_string())
        .unwrap_or_default();
    let duration_seconds = tagged_file.properties().duration().as_secs_f64();
    // Front cover is the best UI representation; the first embedded picture
    // is still more useful than a placeholder when it is not explicitly typed.
    let picture = tag.and_then(|value| {
        value
            .pictures()
            .iter()
            .find(|picture| picture.pic_type() == PictureType::CoverFront)
            .or_else(|| value.pictures().first())
    });
    let cover_data = picture.map(|picture| picture.data().to_vec());
    let cover_mime = cover_data
        .as_deref()
        .map(detect_image_mime)
        .map(str::to_string);
    Ok(TrackMetadata {
        title,
        artist,
        album,
        year,
        duration_seconds,
        cover_mime,
        cover_data,
    })
}

#[tauri::command]
pub fn list_library(library: State<'_, LibraryDb>) -> Result<Vec<LibraryTrack>, String> {
    let connection = library.connection()?;
    let mut statement = connection.prepare(
        "SELECT id, path, title, artist, album, year, duration_seconds, cover_mime, cover_data, analyzed FROM tracks ORDER BY imported_at DESC, id DESC"
    ).map_err(|error| format!("Could not query the music library: {error}"))?;
    let rows = statement
        .query_map([], row_to_track)
        .map_err(|error| format!("Could not read the music library: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not read a track: {error}"))
}

#[tauri::command]
pub fn import_library_track(
    path: String,
    library: State<'_, LibraryDb>,
) -> Result<LibraryTrack, String> {
    let source_path = Path::new(&path);
    if !source_path.is_file() {
        return Err("The selected audio file does not exist".into());
    }
    let metadata = parse_metadata(source_path)?;
    let connection = library.connection()?;
    // The absolute path is the stable identity for the MVP. Re-importing a
    // file refreshes its metadata without creating a duplicate library row.
    connection.execute(
        "INSERT INTO tracks (path, title, artist, album, year, duration_seconds, cover_mime, cover_data)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(path) DO UPDATE SET title = excluded.title, artist = excluded.artist,
         album = excluded.album, year = excluded.year, duration_seconds = excluded.duration_seconds,
         cover_mime = excluded.cover_mime, cover_data = excluded.cover_data, updated_at = CURRENT_TIMESTAMP",
        params![path, metadata.title, metadata.artist, metadata.album, metadata.year, metadata.duration_seconds, metadata.cover_mime, metadata.cover_data],
    ).map_err(|error| format!("Could not save the track: {error}"))?;
    connection.query_row(
        "SELECT id, path, title, artist, album, year, duration_seconds, cover_mime, cover_data, analyzed FROM tracks WHERE path = ?1",
        params![path], row_to_track,
    ).optional().map_err(|error| format!("Could not reload the saved track: {error}"))?.ok_or_else(|| "The saved track could not be found".to_string())
}

#[tauri::command]
pub fn list_playlists(library: State<'_, LibraryDb>) -> Result<Vec<PlaylistSummary>, String> {
    let connection = library.connection()?;
    let mut statement = connection.prepare(
        "SELECT p.id, p.name, COUNT(pt.track_id), COALESCE(SUM(t.duration_seconds), 0), p.created_at
         FROM playlists p
         LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
         LEFT JOIN tracks t ON t.id = pt.track_id
         GROUP BY p.id
         ORDER BY p.updated_at DESC, p.name COLLATE NOCASE"
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

#[tauri::command]
pub fn create_playlist(name: String, library: State<'_, LibraryDb>) -> Result<i64, String> {
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

#[tauri::command]
pub fn delete_playlist(playlist_id: i64, library: State<'_, LibraryDb>) -> Result<(), String> {
    let connection = library.connection()?;
    connection
        .execute("DELETE FROM playlists WHERE id = ?1", params![playlist_id])
        .map_err(|error| format!("Could not delete playlist: {error}"))?;
    Ok(())
}

#[tauri::command]
pub fn list_playlist_tracks(
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

#[tauri::command]
pub fn add_track_to_playlist(
    playlist_id: i64,
    track_id: i64,
    library: State<'_, LibraryDb>,
) -> Result<(), String> {
    let connection = library.connection()?;
    connection.execute(
        "INSERT INTO playlist_tracks (playlist_id, track_id, position)
         VALUES (?1, ?2, COALESCE((SELECT MAX(position) + 1 FROM playlist_tracks WHERE playlist_id = ?1), 0))
         ON CONFLICT(playlist_id, track_id) DO NOTHING", params![playlist_id, track_id]
    ).map_err(|error| format!("Could not add the track to the playlist: {error}"))?;
    connection
        .execute(
            "UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            params![playlist_id],
        )
        .map_err(|error| format!("Could not update the playlist: {error}"))?;
    Ok(())
}

#[tauri::command]
pub fn remove_track_from_playlist(
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
    connection
        .execute(
            "UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            params![playlist_id],
        )
        .map_err(|error| format!("Could not update the playlist: {error}"))?;
    Ok(())
}
