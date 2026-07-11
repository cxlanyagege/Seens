import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

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

export const isDesktopApp = () => isTauri();

export async function chooseAudioFile(): Promise<LoadedTrack | null> {
  const path = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "Audio", extensions: ["mp3", "flac", "wav", "m4a", "aac", "ogg"] }],
  });
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
