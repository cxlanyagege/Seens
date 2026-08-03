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
