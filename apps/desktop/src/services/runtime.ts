import { isTauri } from "@tauri-apps/api/core";

export const isDesktopApp = () => isTauri();

