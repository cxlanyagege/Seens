import { invoke } from "@tauri-apps/api/core";

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

export const loadAudio = (path: string) => invoke<LoadedTrack>("load_audio", { path });
export const playAudio = () => invoke<void>("play_audio");
export const pauseAudio = () => invoke<void>("pause_audio");
export const stopAudio = () => invoke<void>("stop_audio");
export const seekAudio = (seconds: number) => invoke<void>("seek_audio", { seconds });
export const changeVolume = (volume: number) => invoke<void>("set_volume", { volume });
export const getPlayerStatus = () => invoke<PlayerStatus>("player_status");
