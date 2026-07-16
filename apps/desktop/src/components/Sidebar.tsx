import {
  Accessibility,
  AudioLines,
  Gauge,
  HelpCircle,
  Library,
  ListMusic,
  Search,
  Settings,
  Type,
} from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { useAccessibilityPreferences, type FontSizePreference } from "../features/accessibility/useAccessibilityPreferences";
import type { AppPage, Track } from "../types/music";
import { Cover } from "./Cover";

type SidebarProps = {
  activePage: AppPage;
  tracks: Track[];
  searchQuery: string;
  searchFocused: boolean;
  searchResults: Track[];
  onPageChange: (page: AppPage) => void;
  onSearchQueryChange: (query: string) => void;
  onSearchFocusChange: (focused: boolean) => void;
  onSearch: (query?: string) => void;
};

export function Sidebar({
  activePage,
  tracks,
  searchQuery,
  searchFocused,
  searchResults,
  onPageChange,
  onSearchQueryChange,
  onSearchFocusChange,
  onSearch,
}: SidebarProps) {
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);
  const { theme, fontSize, fontWeight, setTheme, setFontSize, setFontWeight } = useAccessibilityPreferences();
  const analyzedCount = tracks.filter((track) => track.analyzed).length;
  const analysisProgress = tracks.length ? Math.round((analyzedCount / tracks.length) * 100) : 0;
  const fontSizes: FontSizePreference[] = ["small", "default", "large"];
  const fontSizeIndex = fontSizes.indexOf(fontSize);

  const handleSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") onSearch();
    if (event.key === "Escape") onSearchFocusChange(false);
  };

  return (
    <aside className="sidebar">
      <div className="brand"><span className="brand__mark"><AudioLines /></span><span>seenstruments</span></div>
      <div className="sidebar-search">
        <label className="sidebar-search__field">
          <Search />
          <input
            value={searchQuery}
            onFocus={() => onSearchFocusChange(true)}
            onBlur={() => window.setTimeout(() => onSearchFocusChange(false), 120)}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            onKeyDown={handleSearchKey}
            placeholder="Search library"
          />
        </label>
        {searchFocused && searchQuery.trim() && (
          <div className="search-suggestions">
            {searchResults.slice(0, 5).map((track) => (
              <button onMouseDown={(event) => event.preventDefault()} onClick={() => onSearch(track.title)} key={track.id}>
                <Cover track={track} compact />
                <span><b>{track.title}</b><small>{track.artist} · {track.album}</small></span>
              </button>
            ))}
            {searchResults.length === 0 && <div className="search-suggestions__empty">No matching music</div>}
            {searchResults.length > 5 && (
              <button className="search-suggestions__all" onMouseDown={(event) => event.preventDefault()} onClick={() => onSearch()}>
                View all {searchResults.length} results <span>→</span>
              </button>
            )}
          </div>
        )}
      </div>
      <nav className="primary-nav" aria-label="Main navigation">
        <button className={`nav-item ${activePage === "library" ? "nav-item--active" : ""}`} onClick={() => onPageChange("library")}><Library /> Library</button>
        <button className={`nav-item ${activePage === "playlists" ? "nav-item--active" : ""}`} onClick={() => onPageChange("playlists")}><ListMusic /> Playlists</button>
        <button className="nav-item"><Gauge /> Analyzed <span className="analysis-progress" style={{ background: `conic-gradient(var(--accent) ${analysisProgress}%, #303034 0)` }} title={`${analysisProgress}% analyzed`}><i /></span></button>
      </nav>
      <div className="sidebar__spacer" />
      {accessibilityOpen && <div className="accessibility-panel" role="dialog" aria-label="Accessibility controls">
        <div className="accessibility-panel__title"><span><Accessibility /> Accessibility</span><i /></div>
        <div className="accessibility-control"><span><b>Appearance</b><small>Interface theme</small></span><div className="accessibility-options"><button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}>Dark</button><button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}>Light</button></div></div>
        <div className="accessibility-control"><span><b>Text size</b><small>{fontSize[0].toUpperCase() + fontSize.slice(1)}</small></span><div className="accessibility-stepper"><button disabled={fontSizeIndex === 0} onClick={() => setFontSize(fontSizes[Math.max(0, fontSizeIndex - 1)])}>−</button><Type /><button disabled={fontSizeIndex === fontSizes.length - 1} onClick={() => setFontSize(fontSizes[Math.min(fontSizes.length - 1, fontSizeIndex + 1)])}>+</button></div></div>
        <div className="accessibility-control"><span><b>Text weight</b><small>Reading preference</small></span><div className="accessibility-options"><button className={fontWeight === "regular" ? "active" : ""} onClick={() => setFontWeight("regular")}>Regular</button><button className={fontWeight === "bold" ? "active" : ""} onClick={() => setFontWeight("bold")}>Bold</button></div></div>
      </div>}
      <nav className="utility-nav" aria-label="Application options">
        <button className={`utility-nav__item ${activePage === "settings" ? "active" : ""}`} title="Settings" onClick={() => { setAccessibilityOpen(false); onPageChange("settings"); }}><Settings /><span>Settings</span></button>
        <button className={`utility-nav__item ${activePage === "help" ? "active" : ""}`} title="Help" onClick={() => { setAccessibilityOpen(false); onPageChange("help"); }}><HelpCircle /><span>Help</span></button>
        <button className={`utility-nav__item ${accessibilityOpen ? "active" : ""}`} title="Accessibility" onClick={() => setAccessibilityOpen((open) => !open)}><Accessibility /><span>Accessibility</span></button>
      </nav>
    </aside>
  );
}
