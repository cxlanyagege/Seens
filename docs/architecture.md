# Architecture

Seens is organized as a monorepo with three primary boundaries:

- `apps/desktop` owns the user experience, native playback, local database, and job coordination.
- `services/analyzer` owns machine-learning inference and audio analysis pipelines.
- `packages/contracts` defines the messages exchanged across the process boundary.

The desktop application is the persistence and orchestration owner. The current prototype starts a one-shot Python analyzer process for an uncached track, parses a versioned JSON result, and persists it in SQLite. A persistent sidecar lifecycle, progress events, cancellation, and retryable job records remain future work.

Audio playback remains independent from analysis. Tauri dispatches the current analyzer process on a blocking worker so playback and the React interface can continue. Expensive future operations such as source separation should run only as cancellable background jobs.

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

Neither the analyzer nor UI accesses the desktop database directly. Rust owns persistence, and the Python process only reads the requested audio file and writes its JSON response to standard output.
