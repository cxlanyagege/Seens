import { invoke } from "@tauri-apps/api/core";

export type AudioWaveform = {
  durationSeconds: number;
  peaks: number[];
};

export const DEFAULT_WAVEFORM_POINTS = 960;

export const getAudioWaveform = (path: string, points = DEFAULT_WAVEFORM_POINTS) =>
  invoke<AudioWaveform>("get_audio_waveform", { path, points });
