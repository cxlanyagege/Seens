import { useEffect, useMemo, useRef, useState } from "react";
import { changeVolume, getPlayerStatus, loadAudio, pauseAudio, playAudio, seekAudio, stopAudio } from "../../services/player-api";
import { isDesktopApp } from "../../services/runtime";
import { fallbackTrack, type Track } from "../../types/music";

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
  const [selected, setSelected] = useState(fallbackTrack);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [shuffleRevision, setShuffleRevision] = useState(0);
  const shuffleRemainingRef = useRef<number[]>([]);
  const shuffleHistoryRef = useRef<number[]>([]);
  const shuffleForwardRef = useRef<number[]>([]);
  const finishedHandledRef = useRef<string | null>(null);

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

  const run = async (action: () => Promise<void>) => {
    try {
      onError(null);
      await action();
    } catch (reason) {
      onError(String(reason));
    }
  };

  const playTrack = (track: Track, recordShuffleHistory: boolean) => run(async () => {
    if (shuffleEnabled && recordShuffleHistory && selected.path && selected.id !== track.id) {
      shuffleHistoryRef.current.push(selected.id);
      shuffleForwardRef.current = [];
      shuffleRemainingRef.current = shuffleRemainingRef.current.filter((id) => id !== track.id);
      bumpShuffleRevision();
    }

    setSelected(track);
    setProgress(0);
    finishedHandledRef.current = null;
    if (!track.path) {
      setIsPlaying(false);
      return;
    }
    await loadAudio(track.path);
    await playAudio();
    setIsPlaying(true);
  });

  const chooseTrack = (track: Track) => playTrack(track, true);

  const prepareTrack = (track: Track) => run(async () => {
    if (track.path) await loadAudio(track.path);
    setSelected(track);
    setProgress(0);
    setIsPlaying(false);
    finishedHandledRef.current = null;
  });

  const clearSelection = () => run(async () => {
    const selectedPath = selected.path;
    setSelected(fallbackTrack);
    setIsPlaying(false);
    setProgress(0);
    finishedHandledRef.current = null;
    shuffleRemainingRef.current = [];
    shuffleHistoryRef.current = [];
    shuffleForwardRef.current = [];
    bumpShuffleRevision();
    if (selectedPath) await stopAudio();
  });

  const togglePlayback = () => run(async () => {
    if (!selected.path) throw new Error("Import a local audio file to start playback.");
    if (isPlaying) {
      await pauseAudio();
      setIsPlaying(false);
      return;
    }
    if (finishedHandledRef.current === selected.path) {
      await loadAudio(selected.path);
      setProgress(0);
      finishedHandledRef.current = null;
    }
    await playAudio();
    setIsPlaying(true);
  });

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
    const selectedPath = selected.path;
    const timer = window.setInterval(async () => {
      try {
        const status = await getPlayerStatus();
        setIsPlaying(status.playing);
        if (status.durationSeconds > 0) setProgress(Math.min(100, (status.positionSeconds / status.durationSeconds) * 100));
        if (!status.finished) {
          finishedHandledRef.current = null;
          return;
        }
        if (finishedHandledRef.current === selectedPath) return;
        finishedHandledRef.current = selectedPath;
        await handleTrackFinished();
      } catch {
        // A final request can race with native application shutdown.
      }
    }, 300);
    return () => window.clearInterval(timer);
  // Playback mode and queue changes must affect the next completion event.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playableQueue, repeatMode, selected.path, shuffleEnabled]);

  const seek = (percentage: number) => {
    setProgress(percentage);
    if (percentage < 100) finishedHandledRef.current = null;
    if (selected.durationSeconds) void run(() => seekAudio((percentage / 100) * selected.durationSeconds!));
  };

  const setVolume = (volume: number) => {
    if (selected.path) void run(() => changeVolume(volume));
  };

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
    setSelected,
    isPlaying,
    progress,
    shuffleEnabled,
    repeatMode,
    upcomingTracks,
    chooseTrack,
    prepareTrack,
    clearSelection,
    togglePlayback,
    toggleShuffle: () => setShuffleEnabled((enabled) => !enabled),
    cycleRepeatMode,
    skip,
    seek,
    setVolume,
  };
}
