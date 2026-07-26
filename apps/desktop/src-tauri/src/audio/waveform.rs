//! Waveform extraction for local audio files.
//!
//! The decoder is streamed: only a bounded collection of time-bucket peaks is
//! kept in memory, so generating a waveform does not require loading the full
//! uncompressed track into RAM.

use rodio::{Decoder, Source};
use serde::Serialize;
use std::{fs::File, path::Path};

const DEFAULT_WAVEFORM_POINTS: usize = 1_200;
const MAX_WAVEFORM_POINTS: usize = 4_096;

/// The minimum and maximum decoded amplitude inside one waveform time bucket.
#[derive(Clone, Copy, Debug, Serialize)]
pub struct WaveformPeak {
    min: f32,
    max: f32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioWaveform {
    duration_seconds: f64,
    peaks: Vec<f32>,
}

#[derive(Default)]
struct PeakAccumulator {
    min: f32,
    max: f32,
    frames: usize,
}

impl PeakAccumulator {
    fn push(&mut self, peak: WaveformPeak) {
        if self.frames == 0 {
            self.min = peak.min;
            self.max = peak.max;
        } else {
            self.min = self.min.min(peak.min);
            self.max = self.max.max(peak.max);
        }
        self.frames += 1;
    }

    fn take(&mut self) -> Option<WaveformPeak> {
        if self.frames == 0 {
            return None;
        }

        let peak = WaveformPeak {
            min: self.min,
            max: self.max,
        };
        *self = Self::default();
        Some(peak)
    }
}

/// Decode a local track away from the async IPC executor. Waveform work is
/// independent from the playback worker, so playback controls remain responsive.
#[tauri::command]
pub async fn get_audio_waveform(
    path: String,
    points: Option<usize>,
) -> Result<AudioWaveform, String> {
    let max_points = points
        .unwrap_or(DEFAULT_WAVEFORM_POINTS)
        .clamp(1, MAX_WAVEFORM_POINTS);

    tauri::async_runtime::spawn_blocking(move || decode_waveform(&path, max_points))
        .await
        .map_err(|error| format!("Could not finish waveform extraction: {error}"))?
}

fn decode_waveform(path: &str, max_points: usize) -> Result<AudioWaveform, String> {
    let source_path = Path::new(path);
    if !source_path.is_file() {
        return Err("The selected audio file does not exist".into());
    }

    let file = File::open(source_path).map_err(|error| format!("Could not open audio: {error}"))?;
    let source = Decoder::try_from(file)
        .map_err(|error| format!("Unsupported or invalid audio file: {error}"))?;
    let sample_rate = source.sample_rate();
    let channels = source.channels();
    let channel_count = usize::from(channels).max(1);
    let reported_duration = source.total_duration().unwrap_or_default().as_secs_f64();
    let estimated_frames = (reported_duration * f64::from(sample_rate)).ceil() as usize;
    let mut frames_per_bucket = estimated_frames.div_ceil(max_points).max(1);

    let mut peaks = Vec::with_capacity(max_points.min(estimated_frames));
    let mut bucket = PeakAccumulator::default();
    let mut frame_min = 0.0_f32;
    let mut frame_max = 0.0_f32;
    let mut samples_in_frame = 0_usize;
    let mut decoded_frames = 0_usize;

    for sample in source {
        // Rodio's decoded samples are normalized floats. Clamping guards the IPC
        // contract against malformed sources that contain out-of-range values.
        let sample = sample.clamp(-1.0, 1.0);
        if samples_in_frame == 0 {
            frame_min = sample;
            frame_max = sample;
        } else {
            frame_min = frame_min.min(sample);
            frame_max = frame_max.max(sample);
        }
        samples_in_frame += 1;

        if samples_in_frame == channel_count {
            bucket.push(WaveformPeak {
                min: frame_min,
                max: frame_max,
            });
            decoded_frames += 1;
            samples_in_frame = 0;

            if bucket.frames == frames_per_bucket {
                if let Some(peak) = bucket.take() {
                    peaks.push(peak);
                }

                // Some containers do not report a duration. Keep memory bounded
                // by progressively merging adjacent buckets as the file streams.
                if peaks.len() >= max_points.saturating_mul(2) {
                    peaks = reduce_peaks(&peaks, max_points);
                    frames_per_bucket = frames_per_bucket.saturating_mul(2);
                }
            }
        }
    }

    // Retain a final partial channel frame and time bucket when present.
    if samples_in_frame > 0 {
        bucket.push(WaveformPeak {
            min: frame_min,
            max: frame_max,
        });
        decoded_frames += 1;
    }
    if let Some(peak) = bucket.take() {
        peaks.push(peak);
    }

    if decoded_frames == 0 {
        return Err("The audio file contains no decodable samples".into());
    }
    if peaks.len() > max_points {
        peaks = reduce_peaks(&peaks, max_points);
    }

    Ok(AudioWaveform {
        duration_seconds: decoded_frames as f64 / f64::from(sample_rate),
        // The UI renders a mirrored waveform, so expose the larger absolute
        // excursion of each min/max pair as a compact, normalized amplitude.
        peaks: peaks
            .into_iter()
            .map(|peak| peak.min.abs().max(peak.max.abs()))
            .collect(),
    })
}

/// Merge proportional groups of buckets while retaining positive and negative
/// extrema. This is preferable to picking individual samples, which can hide
/// short transients such as drum hits.
fn reduce_peaks(source: &[WaveformPeak], target_len: usize) -> Vec<WaveformPeak> {
    if source.len() <= target_len {
        return source.to_vec();
    }

    (0..target_len)
        .map(|index| {
            let start = index * source.len() / target_len;
            let end = ((index + 1) * source.len() / target_len).max(start + 1);
            source[start..end]
                .iter()
                .copied()
                .reduce(|left, right| WaveformPeak {
                    min: left.min.min(right.min),
                    max: left.max.max(right.max),
                })
                .expect("every reduced waveform bucket is non-empty")
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{decode_waveform, reduce_peaks, WaveformPeak};
    use std::{fs, process, time::SystemTime};

    #[test]
    fn reduction_retains_extrema_from_each_time_range() {
        let peaks = [
            WaveformPeak {
                min: -0.2,
                max: 0.4,
            },
            WaveformPeak {
                min: -0.8,
                max: 0.3,
            },
            WaveformPeak {
                min: -0.1,
                max: 0.9,
            },
            WaveformPeak {
                min: -0.5,
                max: 0.2,
            },
        ];

        let reduced = reduce_peaks(&peaks, 2);

        assert_eq!(reduced.len(), 2);
        assert_eq!(reduced[0].min, -0.8);
        assert_eq!(reduced[0].max, 0.4);
        assert_eq!(reduced[1].min, -0.5);
        assert_eq!(reduced[1].max, 0.9);
    }

    #[test]
    fn decoder_extracts_real_peaks_from_pcm_wave() {
        let sample_rate = 8_000_u32;
        let samples = (0..800).map(|index| {
            let amplitude = if index < 400 { 8_192_i16 } else { 24_576_i16 };
            if index % 2 == 0 {
                amplitude
            } else {
                -amplitude
            }
        });
        let mut pcm = Vec::with_capacity(1_600);
        for sample in samples {
            pcm.extend_from_slice(&sample.to_le_bytes());
        }

        let mut wav = Vec::with_capacity(44 + pcm.len());
        wav.extend_from_slice(b"RIFF");
        wav.extend_from_slice(&(36_u32 + pcm.len() as u32).to_le_bytes());
        wav.extend_from_slice(b"WAVEfmt ");
        wav.extend_from_slice(&16_u32.to_le_bytes());
        wav.extend_from_slice(&1_u16.to_le_bytes());
        wav.extend_from_slice(&1_u16.to_le_bytes());
        wav.extend_from_slice(&sample_rate.to_le_bytes());
        wav.extend_from_slice(&(sample_rate * 2).to_le_bytes());
        wav.extend_from_slice(&2_u16.to_le_bytes());
        wav.extend_from_slice(&16_u16.to_le_bytes());
        wav.extend_from_slice(b"data");
        wav.extend_from_slice(&(pcm.len() as u32).to_le_bytes());
        wav.extend_from_slice(&pcm);

        let unique = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .expect("the test clock should follow the Unix epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "seenstruments-waveform-{}-{unique}.wav",
            process::id()
        ));
        fs::write(&path, wav).expect("the WAV fixture should be writable");

        let waveform = decode_waveform(path.to_str().expect("the test path should be UTF-8"), 8)
            .expect("the WAV fixture should decode");
        let _ = fs::remove_file(path);

        assert_eq!(waveform.peaks.len(), 8);
        assert!((waveform.duration_seconds - 0.1).abs() < 0.001);
        assert!(waveform.peaks[..4]
            .iter()
            .all(|peak| *peak > 0.2 && *peak < 0.3));
        assert!(waveform.peaks[4..]
            .iter()
            .all(|peak| *peak > 0.7 && *peak < 0.8));
    }
}
