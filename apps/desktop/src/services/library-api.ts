import { invoke } from "@tauri-apps/api/core";

export type LibraryTrack = {
  id: number;
  path: string;
  title: string;
  artist: string;
  album: string;
  year: string;
  durationSeconds: number;
  coverDataUrl: string | null;
  analyzed: boolean;
};

export const listLibrary = () => invoke<LibraryTrack[]>("list_library");
export const importLibraryTrack = (path: string) => invoke<LibraryTrack>("import_library_track", { path });

