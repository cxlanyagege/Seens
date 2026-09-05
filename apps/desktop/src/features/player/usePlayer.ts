import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import * as playerApi from "../../services/player-api";
import { PlaybackSession } from "./playback-session";
import { isDesktopApp } from "../../services/runtime";
import type { Track } from "../../types/music";

export type RepeatMode = "off" | "all" | "one";

function shuffledTrackIds(tracks: Track[], excludedId: number) {
  const ids = tracks.filter((track) => track.path && track.id !== excludedId).map((track) => track.id);
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];
  }
  return ids;
}

export function usePlayer(onError: (message: string | null) => void, queue: Track[]) {
  const [session] = useState(() => new PlaybackSession(playerApi, onError));
  const { selected, isPlaying, progress, volume } = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [shuffleRevision, setShuffleRevision] = useState(0);
  const shuffleRemainingRef = useRef<number[]>([]);
  const shuffleHistoryRef = useRef<number[]>([]);
  const shuffleForwardRef = useRef<number[]>([]);

  const playableQueue = useMemo(() => queue.filter((track) => track.path), [queue]);

  const bumpShuffleRevision = () => setShuffleRevision((revision) => revision + 1);

  const resetShuffleOrder = (currentId = selected.id) => {
    shuffleRemainingRef.current = shuffledTrackIds(playableQueue, currentId);
    shuffleHistoryRef.current = [];
    shuffleForwardRef.current = [];
    bumpShuffleRevision();
  };

  useEffect(() => {
    if (shuffleEnabled) resetShuffleOrder();
    else {
      shuffleRemainingRef.current = [];
      shuffleHistoryRef.current = [];
      shuffleForwardRef.current = [];
      bumpShuffleRevision();
    }
  // The shuffle order should reset only when its source queue or mode changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, shuffleEnabled]);

  const playTrack = (track: Track, recordShuffleHistory: boolean) => {
    if (shuffleEnabled && recordShuffleHistory && selected.path && selected.id !== track.id) {
      shuffleHistoryRef.current.push(selected.id);
      shuffleForwardRef.current = [];
      shuffleRemainingRef.current = shuffleRemainingRef.current.filter((id) => id !== track.id);
      bumpShuffleRevision();
    }
    return session.select(track, true);
  };

  const chooseTrack = (track: Track) => playTrack(track, true);
  const prepareTrack = (track: Track) => session.select(track);
  const restoreTrack = (track: Track) => session.restore(track);

  const clearSelection = () => {
    shuffleRemainingRef.current = [];
    shuffleHistoryRef.current = [];
    shuffleForwardRef.current = [];
    bumpShuffleRevision();
    return session.clear();
  };

  const togglePlayback = () => session.toggle();

  const takeShuffledTrack = (allowRefill: boolean) => {
    const byId = new Map(playableQueue.map((track) => [track.id, track]));
    let nextId = shuffleForwardRef.current.pop();

    if (nextId === undefined) nextId = shuffleRemainingRef.current.shift();
    if (nextId === undefined && allowRefill) {
      shuffleRemainingRef.current = shuffledTrackIds(playableQueue, selected.id);
      nextId = shuffleRemainingRef.current.shift();
    }

    const nextTrack = nextId === undefined ? undefined : byId.get(nextId);
    if (!nextTrack) return undefined;
    if (selected.path && selected.id !== nextTrack.id) shuffleHistoryRef.current.push(selected.id);
    bumpShuffleRevision();
    return nextTrack;
  };

  const skip = async (offset: number) => {
    if (!playableQueue.length) {
      onError("Import a local audio file first.");
      return;
    }

    if (shuffleEnabled) {
      if (offset < 0) {
        const previousId = shuffleHistoryRef.current.pop();
        const previous = playableQueue.find((track) => track.id === previousId);
        if (previous) {
          if (selected.path) shuffleForwardRef.current.push(selected.id);
          bumpShuffleRevision();
          await playTrack(previous, false);
          return;
        }
      }
      const next = takeShuffledTrack(true) ?? playableQueue[0];
      await playTrack(next, false);
      return;
    }

    const currentIndex = playableQueue.findIndex((track) => track.id === selected.id);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + offset + playableQueue.length) % playableQueue.length;
    await playTrack(playableQueue[nextIndex], false);
  };

  const handleTrackFinished = async () => {
    if (!selected.path) return;
    if (repeatMode === "one") {
      await playTrack(selected, false);
      return;
    }

    if (shuffleEnabled) {
      if (playableQueue.length === 1 && repeatMode === "all") {
        await playTrack(selected, false);
        return;
      }
      const next = takeShuffledTrack(repeatMode === "all");
      if (next) await playTrack(next, false);
      return;
    }

    const currentIndex = playableQueue.findIndex((track) => track.id === selected.id);
    const next = currentIndex >= 0 ? playableQueue[currentIndex + 1] : playableQueue[0];
    if (next) {
      await playTrack(next, false);
      return;
    }
    if (repeatMode === "all" && playableQueue[0]) await playTrack(playableQueue[0], false);
  };

  useEffect(() => {
    if (!isDesktopApp() || !selected.path) return;
    let active = true;
    const timer = window.setInterval(() => {
      void session.poll(handleTrackFinished, () => active);
    }, 300);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  // Queue and mode changes must invalidate callbacks from the previous subscription.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, playableQueue, repeatMode, selected.path, shuffleEnabled]);

  const seek = (percentage: number) => { void session.seek(percentage); };
  const setVolume = (value: number) => { void session.setVolume(value); };

  const cycleRepeatMode = () => setRepeatMode((mode) => mode === "off" ? "all" : mode === "all" ? "one" : "off");

  const upcomingTracks = useMemo(() => {
    if (shuffleEnabled) {
      const byId = new Map(playableQueue.map((track) => [track.id, track]));
      return [...shuffleForwardRef.current].reverse().concat(shuffleRemainingRef.current)
        .map((id) => byId.get(id))
        .filter((track): track is Track => Boolean(track));
    }
    const currentIndex = playableQueue.findIndex((track) => track.id === selected.id);
    return currentIndex < 0
      ? playableQueue
      : [...playableQueue.slice(currentIndex + 1), ...playableQueue.slice(0, currentIndex)];
  }, [playableQueue, selected.id, shuffleEnabled, shuffleRevision]);

  return {
    selected,
    isPlaying,
    progress,
    volume,
    shuffleEnabled,
    repeatMode,
    upcomingTracks,
    chooseTrack,
    prepareTrack,
    restoreTrack,
    clearSelection,
    togglePlayback,
    toggleShuffle: () => setShuffleEnabled((enabled) => !enabled),
    cycleRepeatMode,
    skip,
    seek,
    setVolume,
  };
}
