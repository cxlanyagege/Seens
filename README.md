# Seens

**See what you hear.**

Seens (Codename Seenstruments) is a local-first desktop music player that helps listeners explore the instruments inside a song. Alongside familiar playback controls, it aims to identify which instruments are present, show when they appear, and eventually let users isolate and inspect individual stems.

> [!NOTE]
> Seens currently has a functional local-player prototype and an experimental instrument-analysis path. Instrument scores and timeline thresholds are not yet calibrated against a product-quality validation set.

## Why Seens?

Most music players tell you what is playing. Seens is designed to help explain **what you are hearing**.

It is intended for:

- curious listeners who want to understand a song's arrangement;
- musicians learning instrumentation and production techniques;
- students training their ears;
- producers who want a quick structural overview of a track.

## Planned Features

### Music playback

- Import and organize local audio files
- Play, pause, seek, shuffle, and manage playlists
- Support common formats such as MP3, FLAC, WAV, M4A, and OGG
- Display track metadata and waveform previews

### Instrument analysis

- Detect multiple instruments in a track
- Display a time-aligned instrument activity timeline
- Estimate musical attributes such as tempo and key
- Cache analysis results so each track is processed only when necessary

### Stem exploration

- Separate vocals, drums, bass, and accompaniment
- Solo, mute, and adjust the volume of each stem
- Display synchronized waveforms for separated tracks
- Export stems for use in other music tools

### Future ideas

- Note and pitch transcription
- Piano-roll and MIDI visualization
- Similarity search based on musical content
- User corrections and personalized instrument recognition
- Hardware-accelerated on-device inference

## Proposed Architecture

Seens is planned as a cross-platform, local-first application:

```text
React + TypeScript
Player UI, waveforms, spectrum, and instrument timeline
          |
       Tauri 2
          |
   +------+----------------+
   |                       |
Rust audio engine      Python analysis service
Decode and playback    Classification and separation
   |                       |
   +-----------+-----------+
               |
             SQLite
      Metadata and analysis cache
```

### Technology choices

| Area | Planned technology | Purpose |
| --- | --- | --- |
| Desktop application | Tauri 2 | Cross-platform application shell |
| User interface | React + TypeScript | Player and analysis visualizations |
| Audio engine | Rust, Symphonia, and CPAL | Decoding and low-level playback |
| Instrument recognition | Python, ONNX Runtime, and MTG models | Multi-label instrument analysis |
| Source separation | Demucs-compatible models | Vocal and instrument stems |
| Note transcription | Basic Pitch | Optional audio-to-MIDI analysis |
| Local storage | SQLite | Library metadata, jobs, and cached results |

The prototype invokes the local Python analyzer as a one-shot process for each uncached request. A persistent bundled sidecar with lifecycle, cancellation, and progress reporting remains planned.

## Repository Layout

```text
apps/desktop/          Tauri desktop application and React interface
services/analyzer/     Local Python music-analysis sidecar
packages/contracts/    Versioned schemas shared across languages
docs/                  Architecture and engineering documentation
scripts/               Development and packaging utilities
```

See [`docs/architecture.md`](docs/architecture.md) for the current component boundaries and dependency direction.

## Analysis Pipeline

The intended workflow is:

1. Import a local track and make it immediately available for playback.
2. Extract metadata and generate a waveform preview.
3. Analyze the audio in short overlapping windows.
4. Smooth and merge model predictions into readable instrument segments.
5. Save results together with the model version in the local database.
6. Run computationally expensive stem separation only when requested.

Model output is probabilistic. The current UI presents detected activity and duration without converting raw model scores into confidence percentages.

## Roadmap

### Phase 1: Player and analysis prototype

- [x] Scaffold the Tauri and React application
- [x] Import and play local audio
- [x] Build a music library backed by SQLite
- [x] Generate waveform previews
- [x] Detect instruments across an entire track with the experimental ONNX pipeline
- [x] Display and cache a time-aligned instrument activity timeline
- [ ] Calibrate per-instrument thresholds and validate onset and offset quality
- [ ] Add cancellable jobs and progress reporting
- [ ] Estimate tempo and key

### Phase 2: Stem player

- [ ] Add on-demand source separation
- [ ] Build a synchronized multi-stem player
- [ ] Add solo, mute, and per-stem volume controls
- [ ] Support stem export

### Phase 3: Deeper musical insight

- [ ] Add note and pitch transcription
- [ ] Visualize MIDI and piano-roll data
- [ ] Explore content-based music search
- [ ] Optimize inference for Apple Silicon and supported GPUs

## Privacy

Seens is designed to process music locally. Audio files and analysis results should remain on the user's device unless an explicit online feature is introduced and enabled by the user in the future.

## Development

Prepare the analyzer, then run the native desktop application:

```sh
cd services/analyzer
uv sync --extra dev --python 3.12
.venv/bin/python scripts/fetch_models.py

cd ../../apps/desktop
npm install
npm run tauri:dev
```

`npm run dev` provides a browser-only UI preview. File access, playback, and instrument inference require the Tauri application.
