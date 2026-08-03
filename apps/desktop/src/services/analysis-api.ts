import { invoke } from "@tauri-apps/api/core";

export type InstrumentSummary = {
  instrument: string;
  confidence: number;
  activeSeconds: number;
};

export type InstrumentSegment = {
  instrument: string;
  startSeconds: number;
  endSeconds: number;
  confidence: number;
  peakConfidence: number;
};

export type InstrumentAnalysis = {
  modelId: string;
  modelVersion: string;
  durationSeconds: number;
  predictionIntervalSeconds: number;
  instruments: InstrumentSummary[];
  segments: InstrumentSegment[];
};

export const getInstrumentAnalysis = (trackId: number) =>
  invoke<InstrumentAnalysis | null>("get_instrument_analysis", { trackId });

export const analyzeTrackInstruments = (trackId: number) =>
  invoke<InstrumentAnalysis>("analyze_track_instruments", { trackId });
