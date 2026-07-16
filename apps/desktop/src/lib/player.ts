import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

// Types in this file mirror the camelCase payloads serialized by Rust. Keeping
// the IPC boundary here prevents Tauri-specific calls from leaking into UI code.
export type LoadedTrack = {
  path: string;
  fileName: string;
  durationSeconds: number;
};

export type PlayerStatus = {
  loaded: boolean;
  playing: boolean;
  finished: boolean;
  positionSeconds: number;
  durationSeconds: number;
};

export type LibraryTrack = {
  id: number;
  path: string;
  title: string;
  artist: string;
  album: string;
  year: string;
  durationSeconds: number;
  coverDataUrl: string | null;
  analyzed: boolean;
};

export type PlaylistSummary = {
  id: number;
  name: string;
  trackCount: number;
  durationSeconds: number;
  createdAt: string;
};

export const isDesktopApp = () => isTauri();

export async function chooseAudioFile(): Promise<LoadedTrack | null> {
  const path = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "Audio", extensions: ["mp3", "flac", "wav", "m4a", "aac", "ogg"] }],
  });
  // Loading validates/decodes the chosen file but leaves it paused. The UI
  // decides when playback should begin after persisting the library entry.
  return path ? invoke<LoadedTrack>("load_audio", { path }) : null;
}

export const loadAudio = (path: string) => invoke<LoadedTrack>("load_audio", { path });
export const playAudio = () => invoke<void>("play_audio");
export const pauseAudio = () => invoke<void>("pause_audio");
export const stopAudio = () => invoke<void>("stop_audio");
export const seekAudio = (seconds: number) => invoke<void>("seek_audio", { seconds });
export const changeVolume = (volume: number) => invoke<void>("set_volume", { volume });
export const getPlayerStatus = () => invoke<PlayerStatus>("player_status");
export const listLibrary = () => invoke<LibraryTrack[]>("list_library");
export const importLibraryTrack = (path: string) => invoke<LibraryTrack>("import_library_track", { path });
export const listPlaylists = () => invoke<PlaylistSummary[]>("list_playlists");
export const createPlaylist = (name: string) => invoke<number>("create_playlist", { name });
export const deletePlaylist = (playlistId: number) => invoke<void>("delete_playlist", { playlistId });
export const listPlaylistTracks = (playlistId: number) => invoke<LibraryTrack[]>("list_playlist_tracks", { playlistId });
export const addTrackToPlaylist = (playlistId: number, trackId: number) => invoke<void>("add_track_to_playlist", { playlistId, trackId });
export const removeTrackFromPlaylist = (playlistId: number, trackId: number) => invoke<void>("remove_track_from_playlist", { playlistId, trackId });
