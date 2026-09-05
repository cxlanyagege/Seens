use super::*;
use std::{sync::mpsc, thread, time::Duration};

fn metadata(title: &str) -> metadata::TrackMetadata {
    metadata::TrackMetadata {
        title: title.into(),
        artist: "Artist".into(),
        album: "Album".into(),
        year: String::new(),
        duration_seconds: 10.0,
        cover_mime: None,
        cover_data: None,
    }
}

#[test]
fn slow_metadata_runs_in_background_without_blocking_library_reads() {
    let library = LibraryDb::open(Path::new(":memory:")).unwrap();
    let reader = library.clone();
    let caller = thread::current().id();
    let (started_tx, started_rx) = mpsc::channel();
    let (release_tx, release_rx) = mpsc::channel();
    let observer = thread::spawn(move || {
        let worker = started_rx.recv_timeout(Duration::from_secs(5)).unwrap();
        assert_ne!(worker, caller);
        // This must succeed while the metadata adapter is deliberately blocked.
        let connection = reader
            .0
            .try_lock()
            .expect("metadata must not hold the database lock");
        let count: i64 = connection
            .query_row("SELECT COUNT(*) FROM tracks", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0);
        drop(connection);
        release_tx.send(()).unwrap();
    });
    let result = tauri::async_runtime::block_on(run(library, move |library| {
        import_paths(vec![PathBuf::from("/music/slow.wav")], library, |_| {
            started_tx.send(thread::current().id()).unwrap();
            release_rx.recv_timeout(Duration::from_secs(5)).unwrap();
            Ok(metadata("Slow"))
        })
    }))
    .unwrap();
    observer.join().unwrap();
    assert_eq!(result.tracks.len(), 1);
}

#[test]
fn partial_imports_and_reimports_preserve_library_identity() {
    let library = LibraryDb::open(Path::new(":memory:")).unwrap();
    let paths = vec![
        "/music/one.wav",
        "/music/broken.wav",
        "/music/skip.txt",
        "/music/two.flac",
    ];
    let result = import_paths(
        paths.into_iter().map(PathBuf::from).collect(),
        &library,
        |path| {
            if path.ends_with("broken.wav") {
                return Err("Unreadable".into());
            }
            Ok(metadata(path.file_stem().unwrap().to_str().unwrap()))
        },
    )
    .unwrap();
    assert_eq!(result.skipped_count, 2);
    assert_eq!(result.tracks.len(), 2);
    assert_eq!(result.tracks[0].title, "two");
    let original_id = result.tracks[1].id;
    let updated = import_paths(vec![PathBuf::from("/music/one.wav")], &library, |_| {
        Ok(metadata("Updated"))
    })
    .unwrap();
    assert_eq!(updated.tracks[0].id, original_id);
    assert_eq!(updated.tracks[0].title, "Updated");
    let count: i64 = library
        .connection()
        .unwrap()
        .query_row("SELECT COUNT(*) FROM tracks", [], |row| row.get(0))
        .unwrap();
    assert_eq!(count, 2);
}
