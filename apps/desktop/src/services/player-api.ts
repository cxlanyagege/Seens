import { invoke } from "@tauri-apps/api/core";
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

export async function chooseAudioFile(): Promise<LoadedTrack | null> {
  const path = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "Audio", extensions: ["mp3", "flac", "wav", "m4a", "aac", "ogg"] }],
  });
  // Loading validates/decodes the file but leaves playback paused until the UI
  // has persisted the new library entry.
  return path ? invoke<LoadedTrack>("load_audio", { path }) : null;
}

export const loadAudio = (path: string) => invoke<LoadedTrack>("load_audio", { path });
export const playAudio = () => invoke<void>("play_audio");
export const pauseAudio = () => invoke<void>("pause_audio");
export const seekAudio = (seconds: number) => invoke<void>("seek_audio", { seconds });
export const changeVolume = (volume: number) => invoke<void>("set_volume", { volume });
export const getPlayerStatus = () => invoke<PlayerStatus>("player_status");

