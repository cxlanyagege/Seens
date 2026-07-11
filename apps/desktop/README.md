# Desktop Application

This directory will contain the Tauri 2 desktop application.

```text
src/                 React and TypeScript user interface
  components/        Reusable presentation components
  features/          Feature modules such as player and analysis
  lib/               Frontend utilities and service clients
  stores/            Client-side application state
  styles/            Global styles and design tokens
src-tauri/            Native Tauri application
  src/audio/          Decoding, playback, and audio output
  src/commands/       Commands exposed to the frontend
  src/db/             SQLite access and migrations
  src/jobs/           Background analysis job coordination
```

## Run locally

Install dependencies and start the native desktop application:

```bash
npm install
npm run tauri:dev
```

Use **Import music** to select an MP3, FLAC, WAV, M4A, AAC, or OGG file. Audio decoding and playback run on a dedicated Rust thread so native audio work does not block the Tauri command handler or React interface.

`npm run dev` starts the browser-only UI preview. Native file import and playback are intentionally unavailable in that mode.
