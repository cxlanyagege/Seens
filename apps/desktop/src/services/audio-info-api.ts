import { invoke } from "@tauri-apps/api/core";

export type AudioFileInfo = {
  format: string;
  codec: string | null;
  sampleRateHz: number | null;
  channels: number | null;
  bitDepth: number | null;
  audioBitrateKbps: number | null;
  overallBitrateKbps: number | null;
  lossless: boolean | null;
};

export const getAudioInfo = (path: string) => invoke<AudioFileInfo>("get_audio_info", { path });
