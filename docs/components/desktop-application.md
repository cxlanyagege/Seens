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
    lib/               Frontend utilities
    services/          Typed Tauri command clients
    styles/            Global styles and design tokens
  src-tauri/           Native Tauri application
    src/audio/         Decoding, playback, and audio output
    src/db/            SQLite library and analysis persistence
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

Use **Add music** to select multiple MP3, FLAC, WAV, M4A, AAC, or OGG files or a
music folder. Native file import and playback are intentionally unavailable in
the browser-only preview.

See [local development](../development/local-development.md) for startup and
verification commands. Schema changes must follow the
[database migration workflow](../development/database-migrations.md).
