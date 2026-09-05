//! Background import orchestration. Filesystem work never holds the database lock.

use super::{
    metadata,
    models::{LibraryImportResult, LibraryTrack},
    tracks, LibraryDb,
};
use std::{
    fs,
    path::{Path, PathBuf},
};

const AUDIO_EXTENSIONS: [&str; 6] = ["mp3", "flac", "wav", "m4a", "aac", "ogg"];

/// Move the complete import, including directory traversal, off the IPC executor.
pub(super) async fn run<T: Send + 'static>(
    library: LibraryDb,
    operation: impl FnOnce(&LibraryDb) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(move || operation(&library))
        .await
        .map_err(|error| format!("The library import stopped unexpectedly: {error}"))?
}

pub(super) fn import_track(path: &str, library: &LibraryDb) -> Result<LibraryTrack, String> {
    let path = Path::new(path);
    let parsed = metadata::parse(path)?;
    persist(path, parsed, library)
}

pub(super) fn import_tracks(
    paths: Vec<String>,
    library: &LibraryDb,
) -> Result<LibraryImportResult, String> {
    import_paths(
        paths.into_iter().map(PathBuf::from).collect(),
        library,
        metadata::parse,
    )
}

pub(super) fn import_folder(
    path: &str,
    library: &LibraryDb,
) -> Result<LibraryImportResult, String> {
    let folder = Path::new(path);
    if !folder.is_dir() {
        return Err("The selected music folder does not exist".into());
    }
    let mut paths = Vec::new();
    collect_audio_files(folder, &mut paths)?;
    paths.sort_by_key(|path| path.to_string_lossy().to_lowercase());
    import_paths(paths, library, metadata::parse)
}

fn import_paths(
    paths: Vec<PathBuf>,
    library: &LibraryDb,
    read_metadata: impl Fn(&Path) -> Result<metadata::TrackMetadata, String>,
) -> Result<LibraryImportResult, String> {
    let mut imported = Vec::new();
    let mut skipped_count = 0;
    for path in paths {
        if !is_supported_audio(&path) {
            skipped_count += 1;
            continue;
        }
        let result = read_metadata(&path).and_then(|parsed| persist(&path, parsed, library));
        match result {
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

fn persist(
    path: &Path,
    parsed: metadata::TrackMetadata,
    library: &LibraryDb,
) -> Result<LibraryTrack, String> {
    // Each parsed track commits independently, preserving partial-import behavior
    // while allowing other commands to use the database between files.
    let mut connection = library.connection()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start saving the track: {error}"))?;
    let track = tracks::save_library_track(path, parsed, &transaction)?;
    transaction
        .commit()
        .map_err(|error| format!("Could not finish saving the track: {error}"))?;
    Ok(track)
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

#[cfg(test)]
#[path = "imports_tests.rs"]
mod tests;
