import { invoke } from "@tauri-apps/api/core";

export type PlaylistSummary = {
  id: number;
  name: string;
  trackCount: number;
  durationSeconds: number;
  createdAt: string;
};

export const listPlaylists = () => invoke<PlaylistSummary[]>("list_playlists");
export const createPlaylist = (name: string) => invoke<number>("create_playlist", { name });
export const deletePlaylist = (playlistId: number) => invoke<void>("delete_playlist", { playlistId });
export const listPlaylistTracks = (playlistId: number) => invoke<import("./library-api").LibraryTrack[]>("list_playlist_tracks", { playlistId });
export const addTrackToPlaylist = (playlistId: number, trackId: number) => invoke<void>("add_track_to_playlist", { playlistId, trackId });
export const removeTrackFromPlaylist = (playlistId: number, trackId: number) => invoke<void>("remove_track_from_playlist", { playlistId, trackId });

