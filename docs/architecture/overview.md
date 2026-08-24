# Architecture Overview

Seens is a cross-platform, local-first application organized as a monorepo with
three primary component boundaries:

- `apps/desktop` owns the user experience, native playback, local database, and
  job coordination.
- `services/analyzer` owns machine-learning inference and audio analysis
  pipelines.
- `packages/contracts` defines the language-neutral messages exchanged across
  the process boundary.

The desktop application is the persistence and orchestration owner. The current
prototype starts a one-shot Python analyzer process for an uncached track,
parses a versioned JSON result, and persists it in SQLite. A persistent sidecar
lifecycle, progress events, cancellation, and retryable job records remain
future work.

## System context

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

## Dependency direction

```text
Desktop UI -> typed clients -> Tauri commands
                                  |       |
                             audio worker SQLite cache
                                  |
                          analyzer process bridge
                                  |
                         Python ONNX pipeline
```

Neither the analyzer nor the user interface accesses the desktop database
directly. Rust owns persistence, and the Python process only reads the requested
audio file and writes its JSON response to standard output.

Audio playback remains independent from analysis. Tauri dispatches the current
analyzer process on a blocking worker so playback and the React interface can
continue. Expensive future operations such as source separation should run only
as cancellable background jobs.

## Technology choices

| Area | Technology | Purpose |
| --- | --- | --- |
| Desktop application | Tauri 2 | Cross-platform application shell |
| User interface | React and TypeScript | Player and analysis visualizations |
| Audio engine | Rust, Symphonia, and CPAL | Decoding and low-level playback |
| Instrument recognition | Python, ONNX Runtime, and MTG models | Multi-label instrument analysis |
| Source separation | Demucs-compatible models | Planned vocal and instrument stems |
| Note transcription | Basic Pitch | Planned audio-to-MIDI analysis |
| Local storage | SQLite | Library metadata, jobs, and cached results |

## Analysis workflow

1. Import a local track and make it immediately available for playback.
2. Extract metadata and generate a waveform preview.
3. Analyze the audio in short overlapping windows.
4. Smooth and merge model predictions into readable instrument segments.
5. Save results together with the model version in the local database.
6. Run computationally expensive stem separation only when requested.

## Component documentation

- [Desktop application](../components/desktop-application.md)
- [Analyzer service](../components/analyzer-service.md)
- [Shared contracts](../components/shared-contracts.md)
