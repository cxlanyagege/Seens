import { useEffect, useMemo, useState } from "react";
import { CreatePlaylistModal } from "./components/CreatePlaylistModal";
import { Sidebar } from "./components/Sidebar";
import { InsightsPanel } from "./features/analysis/InsightsPanel";
import { InstrumentTimeline } from "./features/analysis/InstrumentTimeline";
import { LibraryPage } from "./features/library/LibraryPage";
import { PlayerBar } from "./features/player/PlayerBar";
import { usePlayer } from "./features/player/usePlayer";
import { PlaylistsPage } from "./features/playlists/PlaylistsPage";
import { SearchResultsPage } from "./features/search/SearchResultsPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { toTrack } from "./lib/format";
import { importLibraryTrack, listLibrary } from "./services/library-api";
import { chooseAudioFile } from "./services/player-api";
import {
  addTrackToPlaylist,
  createPlaylist,
  deletePlaylist,
  listPlaylists,
  listPlaylistTracks,
  removeTrackFromPlaylist,
  type PlaylistSummary,
} from "./services/playlist-api";
import { isDesktopApp } from "./services/runtime";
import type { AnalysisFilter, AppPage, LibraryView, Track } from "./types/music";

function App() {
  const [error, setError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [libraryView, setLibraryView] = useState<LibraryView>("tracks");
  const [analysisFilter, setAnalysisFilter] = useState<AnalysisFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [activePage, setActivePage] = useState<AppPage>("library");
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<number | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [createPlaylistOpen, setCreatePlaylistOpen] = useState(false);
  const [playlistName, setPlaylistName] = useState("");
  const [trackToAdd, setTrackToAdd] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const player = usePlayer(setError);

  const filteredTracks = useMemo(() => tracks.filter((track) => {
    if (analysisFilter === "analyzed") return track.analyzed;
    if (analysisFilter === "pending") return !track.analyzed;
    return true;
  }), [analysisFilter, tracks]);

  const albums = useMemo(() => {
    const groups = new Map<string, { name: string; artist: string; tracks: Track[] }>();
    filteredTracks.forEach((track) => {
      const key = `${track.album}\u0000${track.artist}`;
      const group = groups.get(key) ?? { name: track.album, artist: track.artist, tracks: [] };
      group.tracks.push(track);
      groups.set(key, group);
    });
    return [...groups.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [filteredTracks]);

  const artists = useMemo(() => {
    const groups = new Map<string, Track[]>();
    filteredTracks.forEach((track) => groups.set(track.artist, [...(groups.get(track.artist) ?? []), track]));
    return [...groups.entries()].map(([name, artistTracks]) => ({ name, tracks: artistTracks }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [filteredTracks]);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return [];
    return tracks.filter((track) => [track.title, track.artist, track.album]
      .some((value) => value.toLocaleLowerCase().includes(query)));
  }, [searchQuery, tracks]);

  useEffect(() => {
    if (!isDesktopApp()) return;
    void listLibrary().then((savedTracks) => {
      const restored = savedTracks.map((track) => toTrack(track));
      setTracks(restored);
      if (restored[0]) player.setSelected(restored[0]);
    }).catch((reason) => setError(String(reason)));
  // The native library should be restored only once at startup.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isDesktopApp()) return;
    void listPlaylists().then((savedPlaylists) => {
      setPlaylists(savedPlaylists);
      if (savedPlaylists[0]) setActivePlaylistId((current) => current ?? savedPlaylists[0].id);
    }).catch((reason) => setError(String(reason)));
  }, []);

  useEffect(() => {
    if (!isDesktopApp() || activePlaylistId === null) {
      setPlaylistTracks([]);
      return;
    }
    void listPlaylistTracks(activePlaylistId)
      .then((savedTracks) => setPlaylistTracks(savedTracks.map((track) => toTrack(track))))
      .catch((reason) => setError(String(reason)));
  }, [activePlaylistId]);

  const runAction = async (action: () => Promise<void>) => {
    try {
      setError(null);
      await action();
    } catch (reason) {
      setError(String(reason));
    }
  };

  const importMusic = () => void runAction(async () => {
    if (!isDesktopApp()) throw new Error("File import and native playback are available in the Tauri app. Run npm run tauri:dev.");
    const loaded = await chooseAudioFile();
    if (!loaded) return;
    const imported = toTrack(await importLibraryTrack(loaded.path), "#9a654b");
    setTracks((current) => [imported, ...current.filter((track) => track.path !== imported.path)]);
    await player.playLoadedTrack(imported);
  });

  const refreshPlaylists = async (preferredId?: number) => {
    const updated = await listPlaylists();
    setPlaylists(updated);
    if (preferredId !== undefined) setActivePlaylistId(preferredId);
    else if (activePlaylistId !== null && !updated.some((playlist) => playlist.id === activePlaylistId)) setActivePlaylistId(updated[0]?.id ?? null);
  };

  const submitPlaylist = () => void runAction(async () => {
    const id = await createPlaylist(playlistName);
    await refreshPlaylists(id);
    setPlaylistName("");
    setCreatePlaylistOpen(false);
  });

  const activePlaylist = playlists.find((playlist) => playlist.id === activePlaylistId);
  const availablePlaylistTracks = tracks.filter((track) => !playlistTracks.some((playlistTrack) => playlistTrack.id === track.id));

  const removePlaylist = () => void runAction(async () => {
    if (activePlaylistId === null) return;
    if (!window.confirm(`Delete “${activePlaylist?.name ?? "this playlist"}”? The tracks will remain in your library.`)) return;
    await deletePlaylist(activePlaylistId);
    setPlaylistTracks([]);
    await refreshPlaylists();
  });

  const reloadPlaylist = async () => {
    if (activePlaylistId === null) return;
    const [updatedTracks] = await Promise.all([listPlaylistTracks(activePlaylistId), refreshPlaylists(activePlaylistId)]);
    setPlaylistTracks(updatedTracks.map((track) => toTrack(track)));
  };

  const addSelectedTrack = () => void runAction(async () => {
    if (activePlaylistId === null || !trackToAdd) return;
    await addTrackToPlaylist(activePlaylistId, Number(trackToAdd));
    setTrackToAdd("");
    await reloadPlaylist();
  });

  const removePlaylistTrack = (trackId: number) => void runAction(async () => {
    if (activePlaylistId === null) return;
    await removeTrackFromPlaylist(activePlaylistId, trackId);
    await reloadPlaylist();
  });

  const showSearchResults = (query = searchQuery) => {
    if (!query.trim()) return;
    setSearchQuery(query);
    setSearchFocused(false);
    setActivePage("search");
  };

  const queue = activePage === "playlists" ? playlistTracks : tracks;
  const showsInsights = activePage === "library" || activePage === "playlists" || activePage === "search";

  return (
    <main className="app-shell">
      <Sidebar
        activePage={activePage}
        tracks={tracks}
        searchQuery={searchQuery}
        searchFocused={searchFocused}
        searchResults={searchResults}
        onPageChange={setActivePage}
        onSearchQueryChange={setSearchQuery}
        onSearchFocusChange={setSearchFocused}
        onSearch={showSearchResults}
      />

      <section className="workspace">
        <div className={`content ${showsInsights ? "" : "content--single"}`}>
          {activePage === "library" && (
            <LibraryPage
              tracks={tracks}
              filteredTracks={filteredTracks}
              albums={albums}
              artists={artists}
              selected={player.selected}
              isPlaying={player.isPlaying}
              view={libraryView}
              filter={analysisFilter}
              filterOpen={filterOpen}
              onImport={importMusic}
              onChooseTrack={(track) => void player.chooseTrack(track)}
              onSelectTrack={player.setSelected}
              onViewChange={setLibraryView}
              onFilterChange={setAnalysisFilter}
              onFilterOpenChange={setFilterOpen}
            />
          )}
          {activePage === "playlists" && (
            <PlaylistsPage
              playlists={playlists}
              activePlaylist={activePlaylist}
              playlistTracks={playlistTracks}
              availableTracks={availablePlaylistTracks}
              selected={player.selected}
              isPlaying={player.isPlaying}
              trackToAdd={trackToAdd}
              onCreate={() => setCreatePlaylistOpen(true)}
              onSelectPlaylist={setActivePlaylistId}
              onDelete={removePlaylist}
              onTrackToAddChange={setTrackToAdd}
              onAddTrack={addSelectedTrack}
              onRemoveTrack={removePlaylistTrack}
              onChooseTrack={(track) => void player.chooseTrack(track)}
            />
          )}
          {activePage === "search" && <SearchResultsPage query={searchQuery} results={searchResults} selected={player.selected} isPlaying={player.isPlaying} onChooseTrack={(track) => void player.chooseTrack(track)} />}
          {activePage === "settings" && <SettingsPage />}
          {showsInsights && <InsightsPanel selected={player.selected} />}
        </div>

        <InstrumentTimeline onSeek={player.seek} progress={player.progress} track={player.selected} visible={timelineOpen} />
        {createPlaylistOpen && <CreatePlaylistModal name={playlistName} onNameChange={setPlaylistName} onClose={() => setCreatePlaylistOpen(false)} onSubmit={submitPlaylist} />}
        {error && <button className="error-toast" onClick={() => setError(null)}>{error}<span>×</span></button>}
        <PlayerBar
          selected={player.selected}
          isPlaying={player.isPlaying}
          progress={player.progress}
          onTogglePlayback={() => void player.togglePlayback()}
          onSkip={(offset) => void player.skip(offset, queue)}
          onSeek={player.seek}
          onVolumeChange={player.setVolume}
          timelineOpen={timelineOpen}
          onToggleTimeline={() => setTimelineOpen((open) => !open)}
        />
      </section>
    </main>
  );
}

export default App;
