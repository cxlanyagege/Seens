import {
  Accessibility,
  Activity,
  AudioLines,
  Gauge,
  HelpCircle,
  Library,
  ListMusic,
  Search,
  Settings,
} from "lucide-react";
import type { KeyboardEvent } from "react";
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
        <button className="nav-item"><Gauge /> Recently analyzed</button>
      </nav>
      <div className="sidebar__spacer" />
      <div className="storage-card">
        <div className="storage-card__title"><span><Activity /> Analysis engine</span><i /></div>
        <p>Local processing</p>
        <div className="storage-card__bar"><span /></div>
        <small>{tracks.filter((track) => track.analyzed).length} of {tracks.length} tracks analyzed</small>
      </div>
      <nav className="utility-nav" aria-label="Application options">
        <button className={`utility-nav__item ${activePage === "settings" ? "active" : ""}`} title="Settings" onClick={() => onPageChange("settings")}><Settings /><span>Settings</span></button>
        <button className={`utility-nav__item ${activePage === "help" ? "active" : ""}`} title="Help" onClick={() => onPageChange("help")}><HelpCircle /><span>Help</span></button>
        <button className="utility-nav__item" title="Accessibility"><Accessibility /><span>Accessibility</span></button>
      </nav>
    </aside>
  );
}
