import type { LibraryTrack } from "../services/library-api";
import type { Track } from "../types/music";

const coverColors = [
  "#9a654b",
  "#59634b",
  "#4d6478",
  "#735a78",
  "#876d42",
  "#497069",
  "#76524c",
  "#596080",
  "#7b5f48",
  "#526b5c",
];

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

function coverColorForTrack(track: LibraryTrack): string {
  const hasAlbumIdentity = track.album !== "Unknown album" || track.artist !== "Unknown artist";
  const identity = hasAlbumIdentity
    ? `${track.album}\u0000${track.artist}`
    : `${track.title}\u0000${track.path}`;
  let hash = 0;
  for (let index = 0; index < identity.length; index += 1) {
    hash = Math.imul(hash, 31) + identity.charCodeAt(index);
  }
  return coverColors[(hash >>> 0) % coverColors.length];
}

export function toTrack(track: LibraryTrack, color = coverColorForTrack(track)): Track {
  return { ...track, duration: formatTime(track.durationSeconds), color };
}
