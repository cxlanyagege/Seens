//! Audio tag parsing and embedded artwork conversion.

use base64::{engine::general_purpose::STANDARD, Engine};
use lofty::{
    file::{AudioFile, TaggedFileExt},
    picture::PictureType,
    prelude::Accessor,
    probe::read_from_path,
};
use std::path::Path;

pub(super) struct TrackMetadata {
    pub(super) title: String,
    pub(super) artist: String,
    pub(super) album: String,
    pub(super) year: String,
    pub(super) duration_seconds: f64,
    pub(super) cover_mime: Option<String>,
    pub(super) cover_data: Option<Vec<u8>>,
}

fn detect_image_mime(bytes: &[u8]) -> &'static str {
    // Some tag formats omit or misreport artwork MIME types, so prefer the
    // image signature before handing the value to the webview.
    if bytes.starts_with(b"\x89PNG") {
        "image/png"
    } else if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        "image/jpeg"
    } else if bytes.starts_with(b"GIF8") {
        "image/gif"
    } else if bytes.starts_with(b"RIFF") {
        "image/webp"
    } else {
        "application/octet-stream"
    }
}

pub(super) fn cover_data_url(mime: Option<String>, data: Option<Vec<u8>>) -> Option<String> {
    // Covers are returned as data URLs because the bytes already live in
    // SQLite and this avoids granting the webview access to arbitrary files.
    let bytes = data?;
    let mime = mime.unwrap_or_else(|| detect_image_mime(&bytes).to_string());
    Some(format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
}

pub(super) fn parse(path: &Path) -> Result<TrackMetadata, String> {
    let tagged_file =
        read_from_path(path).map_err(|error| format!("Could not read audio metadata: {error}"))?;

    // Prefer the container's canonical tag, but accept any available tag for
    // files that were written by less consistent encoders.
    let tag = tagged_file
        .primary_tag()
        .or_else(|| tagged_file.first_tag());
    let fallback_title = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("Unknown track");
    let title = tag
        .and_then(|value| value.title())
        .map(|value| value.into_owned())
        .unwrap_or_else(|| fallback_title.to_string());
    let artist = tag
        .and_then(|value| value.artist())
        .map(|value| value.into_owned())
        .unwrap_or_else(|| "Unknown artist".into());
    let album = tag
        .and_then(|value| value.album())
        .map(|value| value.into_owned())
        .unwrap_or_else(|| "Unknown album".into());
    let year = tag
        .and_then(|value| value.date())
        .map(|date| date.year.to_string())
        .unwrap_or_default();
    let duration_seconds = tagged_file.properties().duration().as_secs_f64();

    // Front cover is the best UI representation; the first embedded picture
    // is still more useful than a placeholder when it is not explicitly typed.
    let picture = tag.and_then(|value| {
        value
            .pictures()
            .iter()
            .find(|picture| picture.pic_type() == PictureType::CoverFront)
            .or_else(|| value.pictures().first())
    });
    let cover_data = picture.map(|picture| picture.data().to_vec());
    let cover_mime = cover_data
        .as_deref()
        .map(detect_image_mime)
        .map(str::to_string);

    Ok(TrackMetadata {
        title,
        artist,
        album,
        year,
        duration_seconds,
        cover_mime,
        cover_data,
    })
}
