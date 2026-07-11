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

Framework-generated files will be added when the application is initialized.

