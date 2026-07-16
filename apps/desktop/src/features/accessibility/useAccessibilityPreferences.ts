import { useEffect, useState } from "react";

export type ThemePreference = "dark" | "light";
export type FontSizePreference = "small" | "default" | "large";
export type FontWeightPreference = "regular" | "bold";

const STORAGE_KEY = "seenstruments.accessibility";

type StoredPreferences = {
  theme: ThemePreference;
  fontSize: FontSizePreference;
  fontWeight: FontWeightPreference;
};

const defaults: StoredPreferences = { theme: "dark", fontSize: "default", fontWeight: "regular" };

function readPreferences(): StoredPreferences {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") };
  } catch {
    return defaults;
  }
}

export function useAccessibilityPreferences() {
  const [preferences, setPreferences] = useState(readPreferences);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = preferences.theme;
    root.dataset.fontSize = preferences.fontSize;
    root.dataset.fontWeight = preferences.fontWeight;
    root.style.colorScheme = preferences.theme;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences]);

  return {
    ...preferences,
    setTheme: (theme: ThemePreference) => setPreferences((current) => ({ ...current, theme })),
    setFontSize: (fontSize: FontSizePreference) => setPreferences((current) => ({ ...current, fontSize })),
    setFontWeight: (fontWeight: FontWeightPreference) => setPreferences((current) => ({ ...current, fontWeight })),
  };
}

