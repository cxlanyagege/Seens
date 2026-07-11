use base64::{engine::general_purpose::STANDARD, Engine};
use lofty::{file::{AudioFile, TaggedFileExt}, picture::PictureType, prelude::Accessor, probe::read_from_path};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use std::{path::Path, sync::Mutex};
use tauri::State;

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

struct TrackMetadata {
    title: String, artist: String, album: String, year: String, duration_seconds: f64,
    cover_mime: Option<String>, cover_data: Option<Vec<u8>>,
}

impl LibraryDb {
    pub fn open(path: &Path) -> Result<Self, String> {
        let connection = Connection::open(path).map_err(|error| format!("Could not open the music library: {error}"))?;
        connection.execute_batch(
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
             );"
        ).map_err(|error| format!("Could not initialize the music library: {error}"))?;
        Ok(Self(Mutex::new(connection)))
    }

    fn connection(&self) -> Result<std::sync::MutexGuard<'_, Connection>, String> {
        self.0.lock().map_err(|_| "The music library is unavailable".to_string())
    }
}

fn detect_image_mime(bytes: &[u8]) -> &'static str {
    if bytes.starts_with(b"\x89PNG") { "image/png" }
    else if bytes.starts_with(&[0xff, 0xd8, 0xff]) { "image/jpeg" }
    else if bytes.starts_with(b"GIF8") { "image/gif" }
    else if bytes.starts_with(b"RIFF") { "image/webp" }
    else { "application/octet-stream" }
}

fn data_url(mime: Option<String>, data: Option<Vec<u8>>) -> Option<String> {
    let bytes = data?;
    let mime = mime.unwrap_or_else(|| detect_image_mime(&bytes).to_string());
    Some(format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
}

fn row_to_track(row: &rusqlite::Row<'_>) -> rusqlite::Result<LibraryTrack> {
    let mime: Option<String> = row.get(7)?;
    let cover: Option<Vec<u8>> = row.get(8)?;
    Ok(LibraryTrack {
        id: row.get(0)?, path: row.get(1)?, title: row.get(2)?, artist: row.get(3)?,
        album: row.get(4)?, year: row.get(5)?, duration_seconds: row.get(6)?,
        cover_data_url: data_url(mime, cover), analyzed: row.get::<_, i64>(9)? != 0,
    })
}

fn parse_metadata(path: &Path) -> Result<TrackMetadata, String> {
    let tagged_file = read_from_path(path).map_err(|error| format!("Could not read audio metadata: {error}"))?;
    let tag = tagged_file.primary_tag().or_else(|| tagged_file.first_tag());
    let fallback_title = path.file_stem().and_then(|value| value.to_str()).unwrap_or("Unknown track");
    let title = tag.and_then(|value| value.title()).map(|value| value.into_owned()).unwrap_or_else(|| fallback_title.to_string());
    let artist = tag.and_then(|value| value.artist()).map(|value| value.into_owned()).unwrap_or_else(|| "Unknown artist".into());
    let album = tag.and_then(|value| value.album()).map(|value| value.into_owned()).unwrap_or_else(|| "Unknown album".into());
    let year = tag.and_then(|value| value.date()).map(|date| date.year.to_string()).unwrap_or_default();
    let duration_seconds = tagged_file.properties().duration().as_secs_f64();
    let picture = tag.and_then(|value| value.pictures().iter().find(|picture| picture.pic_type() == PictureType::CoverFront).or_else(|| value.pictures().first()));
    let cover_data = picture.map(|picture| picture.data().to_vec());
    let cover_mime = cover_data.as_deref().map(detect_image_mime).map(str::to_string);
    Ok(TrackMetadata { title, artist, album, year, duration_seconds, cover_mime, cover_data })
}

#[tauri::command]
pub fn list_library(library: State<'_, LibraryDb>) -> Result<Vec<LibraryTrack>, String> {
    let connection = library.connection()?;
    let mut statement = connection.prepare(
        "SELECT id, path, title, artist, album, year, duration_seconds, cover_mime, cover_data, analyzed FROM tracks ORDER BY imported_at DESC, id DESC"
    ).map_err(|error| format!("Could not query the music library: {error}"))?;
    let rows = statement.query_map([], row_to_track).map_err(|error| format!("Could not read the music library: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|error| format!("Could not read a track: {error}"))
}

#[tauri::command]
pub fn import_library_track(path: String, library: State<'_, LibraryDb>) -> Result<LibraryTrack, String> {
    let source_path = Path::new(&path);
    if !source_path.is_file() { return Err("The selected audio file does not exist".into()); }
    let metadata = parse_metadata(source_path)?;
    let connection = library.connection()?;
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
