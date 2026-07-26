//! Lightweight technical information for a local audio file.
//!
//! Unlike waveform extraction, this command reads only the container metadata
//! and can therefore update the player quality badge without decoding the
//! entire track or requiring the file to be re-imported into SQLite.

use lofty::{
    file::{AudioFile, FileType, TaggedFileExt},
    probe::read_from_path,
};
use serde::Serialize;
use std::path::Path;

/// Technical properties exposed to the webview for the currently selected
/// track. Optional fields serialize as `null` when a container cannot report a
/// value reliably (for example, MP4 does not identify AAC versus ALAC here).
#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioFileInfo {
    format: String,
    codec: Option<String>,
    sample_rate_hz: Option<u32>,
    channels: Option<u8>,
    bit_depth: Option<u8>,
    audio_bitrate_kbps: Option<u32>,
    overall_bitrate_kbps: Option<u32>,
    lossless: Option<bool>,
}

#[derive(Debug, PartialEq, Eq)]
struct FormatInfo {
    format: String,
    codec: Option<String>,
    lossless: Option<bool>,
}

/// Read technical audio properties away from Tauri's asynchronous IPC thread.
/// The operation is header-only and is intentionally separate from waveform
/// extraction, which is lazy and only runs while the timeline is visible.
#[tauri::command]
pub async fn get_audio_info(path: String) -> Result<AudioFileInfo, String> {
    tauri::async_runtime::spawn_blocking(move || read_audio_info(&path))
        .await
        .map_err(|error| format!("Could not finish reading audio information: {error}"))?
}

fn read_audio_info(path: &str) -> Result<AudioFileInfo, String> {
    let source_path = Path::new(path);
    if !source_path.is_file() {
        return Err("The selected audio file does not exist".into());
    }

    let tagged_file = read_from_path(source_path)
        .map_err(|error| format!("Could not read audio information: {error}"))?;
    let properties = tagged_file.properties();
    let format_info = describe_format(tagged_file.file_type(), source_path);

    Ok(AudioFileInfo {
        format: format_info.format,
        codec: format_info.codec,
        sample_rate_hz: properties.sample_rate().filter(|value| *value > 0),
        channels: properties.channels().filter(|value| *value > 0),
        bit_depth: properties.bit_depth().filter(|value| *value > 0),
        audio_bitrate_kbps: properties.audio_bitrate().filter(|value| *value > 0),
        overall_bitrate_kbps: properties.overall_bitrate().filter(|value| *value > 0),
        lossless: format_info.lossless,
    })
}

/// Lofty identifies a file family, which is also the codec for several audio
/// formats. Container-only formats remain unknown rather than guessing (e.g.
/// an M4A file may contain either AAC or ALAC).
fn describe_format(file_type: FileType, path: &Path) -> FormatInfo {
    let known = match file_type {
        FileType::Aac => ("ADTS", Some("AAC"), Some(false)),
        FileType::Aiff => ("AIFF", None, None),
        FileType::Ape => ("APE", Some("Monkey's Audio"), Some(true)),
        FileType::Flac => ("FLAC", Some("FLAC"), Some(true)),
        FileType::Mpeg => {
            let codec = match path
                .extension()
                .and_then(|extension| extension.to_str())
                .map(str::to_ascii_lowercase)
                .as_deref()
            {
                Some("mp1") => "MP1",
                Some("mp2") => "MP2",
                _ => "MP3",
            };
            ("MPEG Audio", Some(codec), Some(false))
        }
        FileType::Mp4 => ("MPEG-4", None, None),
        FileType::Mpc => ("Musepack", Some("Musepack"), Some(false)),
        FileType::Opus => ("Ogg", Some("Opus"), Some(false)),
        FileType::Vorbis => ("Ogg", Some("Vorbis"), Some(false)),
        FileType::Speex => ("Ogg", Some("Speex"), Some(false)),
        FileType::Wav => ("WAV", None, None),
        FileType::WavPack => ("WavPack", Some("WavPack"), None),
        FileType::Custom(name) => (name, None, None),
        _ => ("Unknown", None, None),
    };

    FormatInfo {
        format: known.0.to_string(),
        codec: known.1.map(str::to_string),
        lossless: known.2,
    }
}

#[cfg(test)]
mod tests {
    use super::{describe_format, read_audio_info};
    use lofty::file::FileType;
    use std::{fs, path::Path, process, time::SystemTime};

    fn pcm_wave(sample_rate: u32, channels: u16, bit_depth: u16, frames: u32) -> Vec<u8> {
        let bytes_per_sample = u32::from(bit_depth / 8);
        let block_align = u32::from(channels) * bytes_per_sample;
        let data_len = frames * block_align;
        let mut wav = Vec::with_capacity(44 + data_len as usize);
        wav.extend_from_slice(b"RIFF");
        wav.extend_from_slice(&(36 + data_len).to_le_bytes());
        wav.extend_from_slice(b"WAVEfmt ");
        wav.extend_from_slice(&16_u32.to_le_bytes());
        wav.extend_from_slice(&1_u16.to_le_bytes());
        wav.extend_from_slice(&channels.to_le_bytes());
        wav.extend_from_slice(&sample_rate.to_le_bytes());
        wav.extend_from_slice(&(sample_rate * block_align).to_le_bytes());
        wav.extend_from_slice(&(block_align as u16).to_le_bytes());
        wav.extend_from_slice(&bit_depth.to_le_bytes());
        wav.extend_from_slice(b"data");
        wav.extend_from_slice(&data_len.to_le_bytes());
        wav.resize(44 + data_len as usize, 0);
        wav
    }

    #[test]
    fn reads_concrete_properties_from_pcm_wave() {
        let unique = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .expect("the test clock should follow the Unix epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "seenstruments-audio-info-{}-{unique}.wav",
            process::id()
        ));
        fs::write(&path, pcm_wave(48_000, 2, 24, 4_800))
            .expect("the WAV fixture should be writable");

        let info = read_audio_info(path.to_str().expect("the test path should be UTF-8"))
            .expect("the WAV fixture should be readable");
        let _ = fs::remove_file(path);

        assert_eq!(info.format, "WAV");
        assert_eq!(info.codec, None);
        assert_eq!(info.sample_rate_hz, Some(48_000));
        assert_eq!(info.channels, Some(2));
        assert_eq!(info.bit_depth, Some(24));
        assert_eq!(info.audio_bitrate_kbps, Some(2_304));
        assert_eq!(info.lossless, None);
    }

    #[test]
    fn does_not_guess_the_codec_inside_mp4() {
        let info = describe_format(FileType::Mp4, Path::new("track.m4a"));

        assert_eq!(info.format, "MPEG-4");
        assert_eq!(info.codec, None);
        assert_eq!(info.lossless, None);
    }

    #[test]
    fn reports_known_lossless_and_lossy_codecs() {
        let flac = describe_format(FileType::Flac, Path::new("track.flac"));
        let mp3 = describe_format(FileType::Mpeg, Path::new("track.mp3"));

        assert_eq!(flac.codec.as_deref(), Some("FLAC"));
        assert_eq!(flac.lossless, Some(true));
        assert_eq!(mp3.codec.as_deref(), Some("MP3"));
        assert_eq!(mp3.lossless, Some(false));
    }
}
