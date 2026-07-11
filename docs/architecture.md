# Architecture

Seenstruments is organized as a monorepo with three primary boundaries:

- `apps/desktop` owns the user experience, native playback, local database, and job coordination.
- `services/analyzer` owns machine-learning inference and audio analysis pipelines.
- `packages/contracts` defines the messages exchanged across the process boundary.

The desktop application is the lifecycle owner. It starts the analyzer sidecar, sends versioned requests, receives progress events, persists final results, and terminates the sidecar during shutdown.

Audio playback must remain independent from analysis. Importing or analyzing a track must never block playback, and expensive operations such as source separation should run only as cancellable background jobs.

## Dependency direction

```text
Desktop UI -> Tauri commands -> application services
                                  |            |
                              audio engine   analyzer client
                                                   |
                                            shared contracts
                                                   |
                                           analysis sidecar
```

Neither the analyzer nor UI should access the desktop database directly. This keeps persistence decisions and model execution replaceable.

