import type { LibraryTrack } from "../services/library-api";
import type { Track } from "../types/music";

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

export function toTrack(track: LibraryTrack, color = "#59634b"): Track {
  return { ...track, duration: formatTime(track.durationSeconds), color };
}

