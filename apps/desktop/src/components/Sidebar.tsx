import {
  AudioLines,
  FolderPlus,
  Gauge,
  Library,
  ListMusic,
  Search,
  Settings,
} from "lucide-react";
import type { KeyboardEvent } from "react";
import type { PlaylistSummary } from "../services/playlist-api";
import type { AppPage, Track } from "../types/music";
import { Cover } from "./Cover";

type SidebarProps = {
  activePage: AppPage;
  activePlaylistId: number | null;
  playlists: PlaylistSummary[];
  tracks: Track[];
  searchQuery: string;
  searchFocused: boolean;
  searchResults: Track[];
  onPageChange: (page: AppPage) => void;
  onSelectPlaylist: (id: number) => void;
  onCreatePlaylist: () => void;
  onSearchQueryChange: (query: string) => void;
  onSearchFocusChange: (focused: boolean) => void;
  onSearch: (query?: string) => void;
};

export function Sidebar({
  activePage,
  activePlaylistId,
  playlists,
  tracks,
  searchQuery,
  searchFocused,
  searchResults,
  onPageChange,
  onSelectPlaylist,
  onCreatePlaylist,
  onSearchQueryChange,
  onSearchFocusChange,
  onSearch,
}: SidebarProps) {
  const analyzedCount = tracks.filter((track) => track.analyzed).length;
  const analysisProgress = tracks.length ? Math.round((analyzedCount / tracks.length) * 100) : 0;

  const handleSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") onSearch();
    if (event.key === "Escape") onSearchFocusChange(false);
  };

  return (
    <aside className="sidebar">
      <div className="brand"><span className="brand__mark"><AudioLines /></span><span>Seens</span></div>
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
        <button className="nav-item"><Gauge /> Analyzed <span className="analysis-progress" style={{ background: `conic-gradient(var(--accent) ${analysisProgress}%, #303034 0)` }} title={`${analysisProgress}% analyzed`}><i /></span></button>
      </nav>
      <nav className="playlist-nav" aria-label="Playlists">
        {playlists.map((playlist) => (
          <button
            className={`nav-item playlist-nav__item ${activePage === "playlists" && activePlaylistId === playlist.id ? "nav-item--active" : ""}`}
            onClick={() => onSelectPlaylist(playlist.id)}
            title={playlist.name}
            key={playlist.id}
          >
            <ListMusic />
            <b>{playlist.name}</b>
            <span>{playlist.trackCount}</span>
          </button>
        ))}
        {playlists.length === 0 && <p className="playlist-nav__empty">No playlists yet</p>}
      </nav>
      <nav className="utility-nav" aria-label="Application options">
        <button className="utility-nav__item" title="New playlist" onClick={onCreatePlaylist}><FolderPlus /><span>New playlist</span></button>
        <button className={`utility-nav__item ${activePage === "settings" ? "active" : ""}`} title="Settings" onClick={() => onPageChange("settings")}><Settings /><span>Settings</span></button>
      </nav>
    </aside>
  );
}
