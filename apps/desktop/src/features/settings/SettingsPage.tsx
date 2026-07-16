import { getVersion } from "@tauri-apps/api/app";
import { Info, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { isDesktopApp } from "../../services/runtime";

export function SettingsPage() {
  const [version, setVersion] = useState("0.1.0");

  useEffect(() => {
    if (!isDesktopApp()) return;
    void getVersion().then(setVersion).catch(() => undefined);
  }, []);

  return (
    <section className="library-panel information-page">
      <div className="section-heading">
        <div><span className="eyebrow">APPLICATION</span><h1>Settings</h1><p>Manage Seenstruments preferences</p></div>
      </div>
      <div className="information-section">
        <div className="information-section__heading"><span className="information-icon"><Settings /></span><span><h2>About Seenstruments</h2><p>Application information</p></span></div>
        <div className="setting-row"><span><Info /><b>Version</b></span><code>{version}</code></div>
      </div>
    </section>
  );
}

