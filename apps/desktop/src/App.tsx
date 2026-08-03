import { useEffect, useMemo, useState } from "react";
import { CreatePlaylistModal } from "./components/CreatePlaylistModal";
import { Sidebar } from "./components/Sidebar";
import { InsightsPanel } from "./features/analysis/InsightsPanel";
import { InstrumentTimeline } from "./features/analysis/InstrumentTimeline";
import { LibraryPage } from "./features/library/LibraryPage";
import { PlayerBar } from "./features/player/PlayerBar";
import { QueuePanel } from "./features/player/QueuePanel";
import { usePlayer } from "./features/player/usePlayer";
import { PlaylistsPage } from "./features/playlists/PlaylistsPage";
import { SearchResultsPage } from "./features/search/SearchResultsPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { toTrack } from "./lib/format";
import {
  chooseAudioFiles,
  chooseMusicFolder,
  importLibraryFolder,
  importLibraryTracks,
  listLibrary,
  removeLibraryTracks,
  type LibraryImportResult,
} from "./services/library-api";
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
  const [notice, setNotice] = useState<string | null>(null);
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
  const [queueOpen, setQueueOpen] = useState(false);
  const queue = activePage === "playlists" ? playlistTracks : tracks;
  const player = usePlayer(setError, queue);

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
    let cancelled = false;
    setPlaylistTracks([]);
    void listPlaylistTracks(activePlaylistId)
      .then((savedTracks) => {
        if (!cancelled) setPlaylistTracks(savedTracks.map((track) => toTrack(track)));
      })
      .catch((reason) => {
        if (!cancelled) setError(String(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [activePlaylistId]);

  const runAction = async (action: () => Promise<void>) => {
    try {
      setError(null);
      await action();
    } catch (reason) {
      setError(String(reason));
    }
  };

  const applyImportResult = async (result: LibraryImportResult) => {
    const imported = result.tracks.map((track) => toTrack(track));
    const importedPaths = new Set(imported.map((track) => track.path));
    setTracks((current) => [...imported, ...current.filter((track) => !importedPaths.has(track.path))]);
    if (!player.selected.path && imported[0]) await player.prepareTrack(imported[0]);

    if (imported.length === 0) {
      setNotice("No supported audio files were found.");
      return;
    }
    const noun = imported.length === 1 ? "track" : "tracks";
    const skipped = result.skippedCount ? ` ${result.skippedCount} unsupported or unreadable files were skipped.` : "";
    setNotice(`Imported ${imported.length} ${noun}.${skipped}`);
  };

  const importMusicFiles = () => void runAction(async () => {
    if (!isDesktopApp()) throw new Error("File import is available in the Tauri app. Run npm run tauri:dev.");
    setNotice(null);
    const paths = await chooseAudioFiles();
    if (!paths.length) return;
    await applyImportResult(await importLibraryTracks(paths));
  });

  const importMusicFolder = () => void runAction(async () => {
    if (!isDesktopApp()) throw new Error("Folder import is available in the Tauri app. Run npm run tauri:dev.");
    setNotice(null);
    const path = await chooseMusicFolder();
    if (!path) return;
    await applyImportResult(await importLibraryFolder(path));
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
    setActivePage("playlists");
    setPlaylistName("");
    setTrackToAdd("");
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

  const removeTracksFromLibrary = async (trackIds: number[]) => {
    if (!trackIds.length) return false;
    const noun = trackIds.length === 1 ? "track" : "tracks";
    if (!window.confirm(`Remove ${trackIds.length} ${noun} from your library? The audio files will remain on disk.`)) return false;

    try {
      setError(null);
      await removeLibraryTracks(trackIds);
    } catch (reason) {
      setError(String(reason));
      return false;
    }

    const removedIds = new Set(trackIds);
    setTracks((current) => current.filter((track) => !removedIds.has(track.id)));
    setPlaylistTracks((current) => current.filter((track) => !removedIds.has(track.id)));
    if (removedIds.has(player.selected.id)) {
      setTimelineOpen(false);
      await player.clearSelection();
    }
    try {
      await refreshPlaylists(activePlaylistId ?? undefined);
    } catch (reason) {
      setError(String(reason));
    }
    return true;
  };

  const showSearchResults = (query = searchQuery) => {
    if (!query.trim()) return;
    setSearchQuery(query);
    setSearchFocused(false);
    setActivePage("search");
  };

  const selectPlaylist = (id: number) => {
    setActivePlaylistId(id);
    setTrackToAdd("");
    setActivePage("playlists");
  };

  const showsInsights = (activePage === "library" && tracks.length > 0) || activePage === "playlists" || activePage === "search";
  const showsUtilityPanel = queueOpen || showsInsights;
  const playableQueueCount = queue.filter((track) => track.path).length;
  const markTrackAnalyzed = (trackId: number) => {
    const update = (track: Track) => track.id === trackId ? { ...track, analyzed: true } : track;
    setTracks((current) => current.map(update));
    setPlaylistTracks((current) => current.map(update));
  };
  const openAnalysis = () => {
    setQueueOpen(false);
    setTimelineOpen(true);
  };

  return (
    <main className="app-shell">
      <Sidebar
        activePage={activePage}
        activePlaylistId={activePlaylistId}
        playlists={playlists}
        tracks={tracks}
        searchQuery={searchQuery}
        searchFocused={searchFocused}
        searchResults={searchResults}
        onPageChange={setActivePage}
        onSelectPlaylist={selectPlaylist}
        onCreatePlaylist={() => setCreatePlaylistOpen(true)}
        onSearchQueryChange={setSearchQuery}
        onSearchFocusChange={setSearchFocused}
        onSearch={showSearchResults}
      />

      <section className="workspace">
        <div className={`content ${showsUtilityPanel ? "" : "content--single"}`}>
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
              onImportFiles={importMusicFiles}
              onImportFolder={importMusicFolder}
              onRemoveTracks={removeTracksFromLibrary}
              onChooseTrack={(track) => void player.chooseTrack(track)}
              onSelectTrack={player.setSelected}
              onViewChange={setLibraryView}
              onFilterChange={setAnalysisFilter}
              onFilterOpenChange={setFilterOpen}
            />
          )}
          {activePage === "playlists" && (
            <PlaylistsPage
              activePlaylist={activePlaylist}
              playlistTracks={playlistTracks}
              availableTracks={availablePlaylistTracks}
              selected={player.selected}
              isPlaying={player.isPlaying}
              trackToAdd={trackToAdd}
              onDelete={removePlaylist}
              onTrackToAddChange={setTrackToAdd}
              onAddTrack={addSelectedTrack}
              onRemoveTrack={removePlaylistTrack}
              onChooseTrack={(track) => void player.chooseTrack(track)}
            />
          )}
          {activePage === "search" && <SearchResultsPage query={searchQuery} results={searchResults} selected={player.selected} isPlaying={player.isPlaying} onChooseTrack={(track) => void player.chooseTrack(track)} />}
          {activePage === "settings" && <SettingsPage />}
          {queueOpen ? (
            <QueuePanel selected={player.selected} tracks={queue} upcomingTracks={player.upcomingTracks} shuffleEnabled={player.shuffleEnabled} isPlaying={player.isPlaying} onChooseTrack={(track) => void player.chooseTrack(track)} onClose={() => setQueueOpen(false)} />
          ) : showsInsights ? <InsightsPanel selected={player.selected} onOpenAnalysis={openAnalysis} /> : null}
        </div>

        <InstrumentTimeline onSeek={player.seek} progress={player.progress} track={player.selected} visible={timelineOpen} onAnalysisComplete={markTrackAnalyzed} />
        {createPlaylistOpen && <CreatePlaylistModal name={playlistName} onNameChange={setPlaylistName} onClose={() => setCreatePlaylistOpen(false)} onSubmit={submitPlaylist} />}
        {notice && <button className="notice-toast" onClick={() => setNotice(null)}>{notice}<span>×</span></button>}
        {error && <button className="error-toast" onClick={() => setError(null)}>{error}<span>×</span></button>}
        <PlayerBar
          selected={player.selected}
          isPlaying={player.isPlaying}
          progress={player.progress}
          onTogglePlayback={() => void player.togglePlayback()}
          onSkip={(offset) => void player.skip(offset)}
          onSeek={player.seek}
          onVolumeChange={player.setVolume}
          timelineOpen={timelineOpen}
          onToggleTimeline={() => {
            setQueueOpen(false);
            setTimelineOpen((open) => !open);
          }}
          queueOpen={queueOpen}
          queueCount={playableQueueCount}
          onToggleQueue={() => {
            setTimelineOpen(false);
            setQueueOpen((open) => !open);
          }}
          shuffleEnabled={player.shuffleEnabled}
          repeatMode={player.repeatMode}
          onToggleShuffle={player.toggleShuffle}
          onCycleRepeatMode={player.cycleRepeatMode}
        />
      </section>
    </main>
  );
}

export default App;
