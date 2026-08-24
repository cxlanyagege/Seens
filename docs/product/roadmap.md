# Product Roadmap

The roadmap is organized around independently useful product increments. Items
marked as complete describe the current repository baseline; remaining items
represent planned work rather than committed release dates.

## Phase 1: Player and analysis prototype

- [x] Scaffold the Tauri and React application.
- [x] Import and play local audio.
- [x] Build a music library backed by SQLite.
- [x] Generate waveform previews.
- [x] Detect instruments across an entire track with the experimental ONNX
  pipeline.
- [x] Display and cache a time-aligned instrument activity timeline.
- [ ] Calibrate per-instrument thresholds and validate onset and offset quality.
- [ ] Add cancellable jobs and progress reporting.
- [ ] Estimate tempo and key.

## Phase 2: Stem player

- [ ] Add on-demand source separation.
- [ ] Build a synchronized multi-stem player.
- [ ] Add solo, mute, and per-stem volume controls.
- [ ] Support stem export.

## Phase 3: Deeper musical insight

- [ ] Add note and pitch transcription.
- [ ] Visualize MIDI and piano-roll data.
- [ ] Explore content-based music search.
- [ ] Optimize inference for Apple Silicon and supported GPUs.

The [product overview](overview.md) describes the intended user experience. The
[architecture overview](../architecture/overview.md) distinguishes current
implementation boundaries from planned infrastructure.
