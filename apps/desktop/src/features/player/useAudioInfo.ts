import { useEffect, useRef, useState } from "react";
import { getAudioInfo, type AudioFileInfo } from "../../services/audio-info-api";
import { isDesktopApp } from "../../services/runtime";

type AudioInfoState = {
  path: string | null;
  status: "idle" | "loading" | "ready" | "error";
  data: AudioFileInfo | null;
};

type CacheEntry =
  | { status: "loading"; request: Promise<AudioFileInfo> }
  | { status: "ready"; data: AudioFileInfo };

const audioInfoCache = new Map<string, CacheEntry>();

function requestAudioInfo(path: string) {
  const cached = audioInfoCache.get(path);
  if (cached?.status === "ready") return Promise.resolve(cached.data);
  if (cached?.status === "loading") return cached.request;

  const request = getAudioInfo(path)
    .then((data) => {
      audioInfoCache.set(path, { status: "ready", data });
      return data;
    })
    .catch((error) => {
      audioInfoCache.delete(path);
      throw error;
    });
  audioInfoCache.set(path, { status: "loading", request });
  return request;
}

/** Reads only the selected file's technical header and caches it by local path. */
export function useAudioInfo(path: string | undefined) {
  const requestId = useRef(0);
  const [state, setState] = useState<AudioInfoState>({ path: null, status: "idle", data: null });

  useEffect(() => {
    const currentRequest = ++requestId.current;
    if (!path) {
      setState({ path: null, status: "idle", data: null });
      return;
    }
    if (!isDesktopApp()) {
      setState({ path, status: "error", data: null });
      return;
    }

    const cached = audioInfoCache.get(path);
    if (cached?.status === "ready") {
      setState({ path, status: "ready", data: cached.data });
      return;
    }

    setState({ path, status: "loading", data: null });
    void requestAudioInfo(path).then(
      (data) => {
        if (requestId.current === currentRequest) setState({ path, status: "ready", data });
      },
      () => {
        if (requestId.current === currentRequest) setState({ path, status: "error", data: null });
      },
    );

    return () => {
      if (requestId.current === currentRequest) requestId.current += 1;
    };
  }, [path]);

  if (state.path === path) return state;
  return { path: path ?? null, status: path ? "loading" as const : "idle" as const, data: null };
}
