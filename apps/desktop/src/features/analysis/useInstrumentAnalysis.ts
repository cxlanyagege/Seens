import { useCallback, useEffect, useRef, useState } from "react";
import {
  analyzeTrackInstruments,
  getInstrumentAnalysis,
  type InstrumentAnalysis,
} from "../../services/analysis-api";
import { isDesktopApp } from "../../services/runtime";

type AnalysisStatus = "idle" | "loading" | "analyzing" | "ready" | "error";

type AnalysisState = {
  trackId: number | null;
  status: AnalysisStatus;
  data: InstrumentAnalysis | null;
  error: string | null;
};

const analysisCache = new Map<number, InstrumentAnalysis | null>();
const analysisEvent = "seens:instrument-analysis-updated";

function publishAnalysis(trackId: number, analysis: InstrumentAnalysis) {
  analysisCache.set(trackId, analysis);
  window.dispatchEvent(new CustomEvent(analysisEvent, { detail: { trackId, analysis } }));
}

export function useInstrumentAnalysis(trackId: number, path: string | undefined, enabled = true) {
  const requestId = useRef(0);
  const [state, setState] = useState<AnalysisState>({ trackId: null, status: "idle", data: null, error: null });

  useEffect(() => {
    const currentRequest = ++requestId.current;
    if (!enabled || !path || trackId <= 0) {
      setState({ trackId: null, status: "idle", data: null, error: null });
      return;
    }
    if (!isDesktopApp()) {
      setState({ trackId, status: "idle", data: null, error: null });
      return;
    }
    if (analysisCache.has(trackId)) {
      const data = analysisCache.get(trackId) ?? null;
      setState({ trackId, status: data ? "ready" : "idle", data, error: null });
      return;
    }

    setState({ trackId, status: "loading", data: null, error: null });
    void getInstrumentAnalysis(trackId).then(
      (data) => {
        analysisCache.set(trackId, data);
        if (requestId.current === currentRequest) setState({ trackId, status: data ? "ready" : "idle", data, error: null });
      },
      (error) => {
        if (requestId.current === currentRequest) setState({ trackId, status: "error", data: null, error: String(error) });
      },
    );
  }, [enabled, path, trackId]);

  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent<{ trackId: number; analysis: InstrumentAnalysis }>).detail;
      if (detail.trackId === trackId) setState({ trackId, status: "ready", data: detail.analysis, error: null });
    };
    window.addEventListener(analysisEvent, update);
    return () => window.removeEventListener(analysisEvent, update);
  }, [trackId]);

  const analyze = useCallback(async () => {
    if (!path || trackId <= 0) return null;
    if (!isDesktopApp()) {
      setState({ trackId, status: "error", data: null, error: "Instrument analysis is available in the Tauri desktop app." });
      return null;
    }
    const currentRequest = ++requestId.current;
    setState({ trackId, status: "analyzing", data: null, error: null });
    try {
      const data = await analyzeTrackInstruments(trackId);
      publishAnalysis(trackId, data);
      if (requestId.current === currentRequest) setState({ trackId, status: "ready", data, error: null });
      return data;
    } catch (error) {
      if (requestId.current === currentRequest) setState({ trackId, status: "error", data: null, error: String(error) });
      return null;
    }
  }, [path, trackId]);

  if (state.trackId === trackId || !path || trackId <= 0) return { ...state, analyze };
  return { trackId, status: enabled ? "loading" as const : "idle" as const, data: null, error: null, analyze };
}
