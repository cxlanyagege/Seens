import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";
import { isDesktopApp } from "../../services/runtime";

export function SettingsPage() {
  const [version, setVersion] = useState("0.1.0");

  useEffect(() => {
    if (!isDesktopApp()) return;
    void getVersion().then(setVersion).catch(() => undefined);
  }, []);

  return (
    <section className="library-panel settings-page" aria-label="Settings">
      <code className="settings-version" aria-label={`Version ${version}`}>{version}</code>
    </section>
  );
}
