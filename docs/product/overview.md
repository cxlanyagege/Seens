# Product Overview

Seens is a local-first desktop music player designed to help listeners
understand what they are hearing. Alongside playback controls, it identifies
instruments, shows when they appear, and is intended to support isolated stem
exploration in later releases.

## Audience

Seens is intended for:

- curious listeners who want to understand a song's arrangement;
- musicians learning instrumentation and production techniques;
- students training their ears;
- producers who want a quick structural overview of a track.

## Product capabilities

### Music playback

- Import and organize local audio files.
- Play, pause, seek, shuffle, and manage playlists.
- Support common formats such as MP3, FLAC, WAV, M4A, and OGG.
- Display track metadata and waveform previews.

### Instrument analysis

- Detect multiple instruments in a track.
- Display a time-aligned instrument activity timeline.
- Estimate musical attributes such as tempo and key.
- Cache analysis results so each track is processed only when necessary.

### Stem exploration

- Separate vocals, drums, bass, and accompaniment.
- Solo, mute, and adjust the volume of each stem.
- Display synchronized waveforms for separated tracks.
- Export stems for use in other music tools.

### Longer-term opportunities

- Note and pitch transcription.
- Piano-roll and MIDI visualization.
- Similarity search based on musical content.
- User corrections and personalized instrument recognition.
- Hardware-accelerated on-device inference.

## Current product status

The current prototype supports local library management, native playback,
waveform previews, experimental instrument analysis, a time-aligned activity
timeline, and cached results. Model output is probabilistic. The user interface
presents detected activity and duration without describing raw model scores as
calibrated confidence percentages.

See the [roadmap](roadmap.md) for delivery progress and the
[architecture overview](../architecture/overview.md) for implementation
boundaries.

## Privacy

Seens is designed to process music locally. Audio files and analysis results
should remain on the user's device unless an explicit online feature is
introduced and enabled by the user in the future.
