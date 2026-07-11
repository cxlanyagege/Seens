# Seenstruments

**See what you hear.**

Codename Seenstruments is a local-first desktop music player that helps listeners explore the instruments inside a song. Alongside familiar playback controls, it aims to identify which instruments are present, show when they appear, and eventually let users isolate and inspect individual stems.

> [!NOTE]
> Seenstruments is currently in the planning and early development stage. The features and architecture described below represent the intended direction of the project and may evolve as the first prototype is built.

## Why Seenstruments?

Most music players tell you what is playing. Seenstruments is designed to help explain **what you are hearing**.

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
- Display an instrument timeline with confidence scores
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

Seenstruments is planned as a cross-platform, local-first application:

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
| Instrument recognition | Python and Essentia models | Multi-label instrument analysis |
| Source separation | Demucs-compatible models | Vocal and instrument stems |
| Note transcription | Basic Pitch | Optional audio-to-MIDI analysis |
| Local storage | SQLite | Library metadata, jobs, and cached results |

The analysis layer will initially run as a bundled local sidecar process. This keeps model integration flexible while ensuring that users do not need to upload their music to a remote service.

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

Model output is probabilistic. Seenstruments will expose confidence where useful and avoid presenting uncertain classifications as absolute facts.

## Roadmap

### Phase 1: Player and analysis prototype

- [ ] Scaffold the Tauri and React application
- [ ] Import and play local audio
- [ ] Build a music library backed by SQLite
- [ ] Generate waveform previews
- [ ] Detect instruments across an entire track
- [ ] Display a time-aligned instrument timeline
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

Seenstruments is designed to process music locally. Audio files and analysis results should remain on the user's device unless an explicit online feature is introduced and enabled by the user in the future.

## Development

Build and development instructions will be added once the initial application scaffold is in place.

## Contributing

The project is at an early stage, so architecture discussions, model evaluations, interface experiments, and focused pull requests are welcome. Please open an issue before beginning a large change so that implementation work can stay aligned with the project direction.

## License

A project license has not been selected yet. Until one is added, the source code is not offered under an open-source license.
