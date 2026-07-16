import { useEffect, useState } from "react";
import { changeVolume, getPlayerStatus, loadAudio, pauseAudio, playAudio, seekAudio } from "../../services/player-api";
import { isDesktopApp } from "../../services/runtime";
import { fallbackTrack, type Track } from "../../types/music";

export function usePlayer(onError: (message: string | null) => void) {
  const [selected, setSelected] = useState(fallbackTrack);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isDesktopApp() || !selected.path) return;
    // Rodio owns the authoritative clock; polling prevents a JavaScript clock
    // from drifting away from native playback.
    const timer = window.setInterval(async () => {
      try {
        const status = await getPlayerStatus();
        setIsPlaying(status.playing);
        if (status.durationSeconds > 0) setProgress((status.positionSeconds / status.durationSeconds) * 100);
      } catch {
        // A final request can race with native application shutdown.
      }
    }, 300);
    return () => window.clearInterval(timer);
  }, [selected.path]);

  const run = async (action: () => Promise<void>) => {
    try {
      onError(null);
      await action();
    } catch (reason) {
      onError(String(reason));
    }
  };

  const chooseTrack = (track: Track) => run(async () => {
    setSelected(track);
    setProgress(0);
    if (!track.path) {
      setIsPlaying(false);
      return;
    }
    await loadAudio(track.path);
    await playAudio();
    setIsPlaying(true);
  });

  const playLoadedTrack = (track: Track) => run(async () => {
    setSelected(track);
    setProgress(0);
    await playAudio();
    setIsPlaying(true);
  });

  const togglePlayback = () => run(async () => {
    if (!selected.path) throw new Error("Import a local audio file to start playback.");
    if (isPlaying) await pauseAudio(); else await playAudio();
    setIsPlaying(!isPlaying);
  });

  const skip = async (offset: number, queue: Track[]) => {
    const playable = queue.filter((track) => track.path);
    if (!playable.length) {
      onError("Import a local audio file first.");
      return;
    }
    const currentIndex = playable.findIndex((track) => track.id === selected.id);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + offset + playable.length) % playable.length;
    await chooseTrack(playable[nextIndex]);
  };

  const seek = (percentage: number) => {
    setProgress(percentage);
    if (selected.durationSeconds) void run(() => seekAudio((percentage / 100) * selected.durationSeconds!));
  };

  const setVolume = (volume: number) => {
    if (selected.path) void run(() => changeVolume(volume));
  };

  return { selected, setSelected, isPlaying, progress, chooseTrack, playLoadedTrack, togglePlayback, skip, seek, setVolume };
}

