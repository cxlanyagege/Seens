# Local Development

The native desktop application depends on both the JavaScript/Tauri toolchain
and the local Python analyzer environment. Prepare the analyzer before launching
instrument analysis from the desktop application.

## Analyzer setup

From the repository root:

```sh
cd services/analyzer
uv sync --extra dev --python 3.12
.venv/bin/python scripts/fetch_models.py
.venv/bin/python -m pytest
```

Run the analyzer directly against a local track with:

```sh
.venv/bin/seens-analyzer analyze \
  --audio /path/to/track.mp3 \
  --model-dir models/instrument-v1
```

FFmpeg must be available to decode input audio. Model files are downloaded into
the ignored `services/analyzer/models` directory.

## Desktop application

In a separate terminal, from the repository root:

```sh
cd apps/desktop
npm install
npm run tauri:dev
```

The Tauri application provides native file access, playback, SQLite persistence,
and instrument inference. `npm run dev` starts a browser-only user-interface
preview where native capabilities are intentionally unavailable.

## Verification

Run the frontend type checks and production build with:

```sh
cd apps/desktop
npm run build
```

Run native Rust tests with:

```sh
cd apps/desktop/src-tauri
cargo test
```

Run analyzer tests with:

```sh
cd services/analyzer
.venv/bin/python -m pytest
```

For component responsibilities, see the
[desktop application](../components/desktop-application.md) and
[analyzer service](../components/analyzer-service.md) documentation.
