export type Track = {
  id: number;
  title: string;
  artist: string;
  album: string;
  duration: string;
  year: string;
  color: string;
  analyzed: boolean;
  path?: string;
  durationSeconds?: number;
  coverDataUrl?: string | null;
};

export type LibraryView = "tracks" | "albums" | "artists";
export type AnalysisFilter = "all" | "analyzed" | "pending";
export type AppPage = "library" | "playlists" | "search" | "settings" | "help";

export type AlbumGroup = {
  name: string;
  artist: string;
  tracks: Track[];
};

export type ArtistGroup = {
  name: string;
  tracks: Track[];
};

export const fallbackTrack: Track = {
  id: 0,
  title: "No track selected",
  artist: "Import music to begin",
  album: "Library",
  duration: "0:00",
  year: "",
  color: "#4c5040",
  analyzed: false,
};
