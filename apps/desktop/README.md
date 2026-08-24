# Desktop Application

This directory contains the Tauri 2 desktop application.

```text
src/                 React and TypeScript user interface
  components/        Reusable presentation components
  features/          Feature modules such as player and analysis
  lib/               Frontend utilities
  services/          Typed Tauri command clients
  styles/            Global styles and design tokens
src-tauri/            Native Tauri application
  src/audio/          Decoding, playback, and audio output
  src/db/             SQLite library and analysis persistence
    migrations/       Ordered, transactional SQLite schema migrations
  src/analyzer.rs     Local analyzer process bridge
```

## Run locally

Install dependencies and start the native desktop application:

```bash
npm install
npm run tauri:dev
```

Use **Add music** to select multiple MP3, FLAC, WAV, M4A, AAC, or OGG files or a music folder. Audio decoding and playback run on a dedicated Rust thread so native audio work does not block the Tauri command handler or React interface.

Instrument analysis also requires the Python environment and model files described in `services/analyzer/README.md`. The Tauri command runs inference on a blocking worker and stores the versioned result in SQLite while playback remains independent.

`npm run dev` starts the browser-only UI preview. Native file import and playback are intentionally unavailable in that mode.

## Database migrations

The desktop database uses SQLite `PRAGMA user_version` as its schema version.
Startup applies every pending migration from `src-tauri/src/db/migrations` in
order and records each version in the same transaction as its schema changes.

To change the persisted schema:

1. Add the next zero-padded SQL file to the migrations directory.
2. Register it in the ordered `MIGRATIONS` list in `src-tauri/src/db/schema.rs`.
3. Add an upgrade test that starts from the previous schema version and verifies
   both the new structure and preservation of existing data.

Migration files are append-only after release. Never edit a migration that may
already have been applied to a user database.
