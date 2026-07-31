import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

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

export type LibraryImportResult = {
  tracks: LibraryTrack[];
  skippedCount: number;
};

const audioFilters = [{ name: "Audio", extensions: ["mp3", "flac", "wav", "m4a", "aac", "ogg"] }];

export async function chooseAudioFiles(): Promise<string[]> {
  const selection = await open({ multiple: true, directory: false, filters: audioFilters });
  if (!selection) return [];
  return Array.isArray(selection) ? selection : [selection];
}

export async function chooseMusicFolder(): Promise<string | null> {
  const selection = await open({ multiple: false, directory: true });
  if (!selection) return null;
  return Array.isArray(selection) ? selection[0] ?? null : selection;
}

export const listLibrary = () => invoke<LibraryTrack[]>("list_library");
export const importLibraryTrack = (path: string) => invoke<LibraryTrack>("import_library_track", { path });
export const importLibraryTracks = (paths: string[]) => invoke<LibraryImportResult>("import_library_tracks", { paths });
export const importLibraryFolder = (path: string) => invoke<LibraryImportResult>("import_library_folder", { path });
export const removeLibraryTracks = (trackIds: number[]) => invoke<void>("remove_library_tracks", { trackIds });
