# Desktop Application

The desktop component in `apps/desktop` contains the Tauri 2 application, React
user interface, native playback engine, local persistence, and analyzer process
coordination.

## Structure

```text
apps/desktop/
  src/                 React and TypeScript user interface
    components/        Reusable presentation components
    features/          Feature modules such as player and analysis
      player/          Playback session, React subscription, and player controls
    lib/               Frontend utilities
    services/          Typed Tauri command clients
    styles/            Global styles and design tokens
  src-tauri/           Native Tauri application
    src/audio/         Decoding, playback, and audio output
    src/db/            SQLite library and analysis persistence
      imports.rs      Background file scanning and metadata import orchestration
      migrations/     Ordered, transactional SQLite schema migrations
    src/analyzer.rs   Local analyzer process bridge
```

## Responsibilities

- Present the music library, playback controls, playlists, waveforms, and
  instrument timeline.
- Decode and play supported audio on a dedicated Rust thread.
- Own the SQLite library and analysis cache.
- Start the local analyzer without blocking playback or the React interface.
- Validate and persist versioned analysis results.

## Playback and import execution

`PlaybackSession` owns the selected native track, transport command ordering,
and playback snapshots independently of React. The player hook subscribes to
these snapshots and retains queue and repeat behavior. Startup restoration and
album or artist selection prepare the native track before changing its displayed
identity. A failed load preserves the previous selection.

Native load results and status snapshots include a session identifier. Polling
checks this identifier, the track path, and the command revision before applying
a response or advancing the queue. Replaced subscriptions discard outstanding
responses, and polling requests do not overlap.

Rust owns the volume for the lifetime of the audio worker, including when no
track is loaded. New sinks are paused and configured with that volume before
receiving audio. Audio command adapters dispatch away from the main thread while
the dedicated audio worker continues to own the output stream.

File and folder imports run on blocking workers. Metadata parsing takes place
without the database mutex; each parsed track is persisted in a short transaction.
Cloned database handles share the existing connection and its lock. A partially
successful batch retains successful imports and reports the skipped count.

Use **Add music** to select multiple MP3, FLAC, WAV, M4A, AAC, or OGG files or a
music folder. Native file import and playback are intentionally unavailable in
the browser-only preview.

See [local development](../development/local-development.md) for startup and
verification commands. Schema changes must follow the
[database migration workflow](../development/database-migrations.md).
