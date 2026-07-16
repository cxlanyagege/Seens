//! Values serialized across the Tauri IPC boundary.

use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryTrack {
    pub(super) id: i64,
    pub(super) path: String,
    pub(super) title: String,
    pub(super) artist: String,
    pub(super) album: String,
    pub(super) year: String,
    pub(super) duration_seconds: f64,
    pub(super) cover_data_url: Option<String>,
    pub(super) analyzed: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistSummary {
    pub(super) id: i64,
    pub(super) name: String,
    pub(super) track_count: i64,
    pub(super) duration_seconds: f64,
    pub(super) created_at: String,
}
