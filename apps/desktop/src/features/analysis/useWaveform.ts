import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_WAVEFORM_POINTS, getAudioWaveform, type AudioWaveform } from "../../services/waveform-api";
import { isDesktopApp } from "../../services/runtime";

type WaveformStatus = "idle" | "loading" | "ready" | "error";

type WaveformState = {
  path: string | null;
  status: WaveformStatus;
  data: AudioWaveform | null;
  error: string | null;
};

type CacheEntry =
  | { status: "loading"; request: Promise<AudioWaveform> }
  | { status: "ready"; data: AudioWaveform };

const waveformCache = new Map<string, CacheEntry>();

const cacheKey = (path: string, points: number) => `${path}\u0000${points}`;

function requestWaveform(path: string, points: number): Promise<AudioWaveform> {
  const key = cacheKey(path, points);
  const cached = waveformCache.get(key);
  if (cached?.status === "ready") return Promise.resolve(cached.data);
  if (cached?.status === "loading") return cached.request;

  const request = getAudioWaveform(path, points)
    .then((data) => {
      waveformCache.set(key, { status: "ready", data });
      return data;
    })
    .catch((error) => {
      waveformCache.delete(key);
      throw error;
    });
  waveformCache.set(key, { status: "loading", request });
  return request;
}

/** Lazily extracts and caches the active track waveform when its drawer opens. */
export function useWaveform(path: string | undefined, enabled: boolean, points = DEFAULT_WAVEFORM_POINTS) {
  const [attempt, setAttempt] = useState(0);
  const requestId = useRef(0);
  const [state, setState] = useState<WaveformState>({ path: null, status: "idle", data: null, error: null });

  useEffect(() => {
    const currentRequest = ++requestId.current;
    if (!path) {
      setState({ path: null, status: "idle", data: null, error: null });
      return;
    }
    if (!enabled) return;
    if (!isDesktopApp()) {
      setState({ path, status: "error", data: null, error: "Real waveform decoding is available in the Tauri desktop app." });
      return;
    }

    const cached = waveformCache.get(cacheKey(path, points));
    if (cached?.status === "ready") {
      setState({ path, status: "ready", data: cached.data, error: null });
      return;
    }

    setState({ path, status: "loading", data: null, error: null });
    void requestWaveform(path, points).then(
      (data) => {
        if (requestId.current === currentRequest) setState({ path, status: "ready", data, error: null });
      },
      (error) => {
        if (requestId.current === currentRequest) setState({ path, status: "error", data: null, error: String(error) });
      },
    );

    // Native extraction cannot be aborted, but stale results must never replace
    // the waveform for a track selected while decoding was still in progress.
    return () => {
      if (requestId.current === currentRequest) requestId.current += 1;
    };
  }, [attempt, enabled, path, points]);

  const retry = useCallback(() => {
    if (path) waveformCache.delete(cacheKey(path, points));
    setAttempt((value) => value + 1);
  }, [path, points]);

  if (state.path === path) return { ...state, retry };
  return {
    path: path ?? null,
    status: path && enabled ? "loading" as const : "idle" as const,
    data: null,
    error: null,
    retry,
  };
}
