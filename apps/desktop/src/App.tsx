import { useEffect, useMemo, useState } from "react";
import {
  Accessibility,
  Activity,
  AudioLines,
  ChevronDown,
  Disc3,
  DiscAlbum,
  FolderPlus,
  Gauge,
  Heart,
  HelpCircle,
  Library,
  ListMusic,
  MoreHorizontal,
  Music2,
  Pause,
  Piano,
  Play,
  Plus,
  Repeat2,
  Settings,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserRound,
  Volume2,
  X,
} from "lucide-react";
import {
  addTrackToPlaylist,
  changeVolume,
  chooseAudioFile,
  createPlaylist,
  deletePlaylist,
  getPlayerStatus,
  importLibraryTrack,
  isDesktopApp,
  listLibrary,
  listPlaylists,
  listPlaylistTracks,
  loadAudio,
  pauseAudio,
  playAudio,
  removeTrackFromPlaylist,
  seekAudio,
  type PlaylistSummary,
} from "./lib/player";

type Track = {
  id: number;
  title: string;
  artist: string;
  album: string;
  duration: string;
  year: string;
  color: string;
  analyzed: boolean;
  path?: string;
  durationSeconds?: number;
  coverDataUrl?: string | null;
};

type LibraryView = "tracks" | "albums" | "artists";
type AnalysisFilter = "all" | "analyzed" | "pending";
type AppPage = "library" | "playlists";

const fallbackTrack: Track = { id: 0, title: "No track selected", artist: "Import music to begin", album: "Library", duration: "0:00", year: "", color: "#4c5040", analyzed: false };

// Instrument results remain mock data until the analysis sidecar is connected.
const instruments = [
  { name: "Drums", confidence: 98, color: "#ef765f", icon: Activity },
  { name: "Bass", confidence: 94, color: "#b97cf2", icon: AudioLines },
  { name: "Electric guitar", confidence: 89, color: "#5ca9ef", icon: Music2 },
  { name: "Synthesizer", confidence: 83, color: "#65c99b", icon: SlidersHorizontal },
  { name: "Piano", confidence: 61, color: "#e1b85b", icon: Piano },
];

const waveform = Array.from({ length: 132 }, (_, index) =>
  10 + Math.abs(Math.sin(index * 0.47) * 29 + Math.cos(index * 0.19) * 16),
);

function Cover({ track, compact = false }: { track: Track; compact?: boolean }) {
  return (
    <div className={`cover ${compact ? "cover--compact" : ""}`} style={{ "--cover": track.color } as React.CSSProperties}>
      {track.coverDataUrl && <img className="cover__image" src={track.coverDataUrl} alt="" />}
      <div className="cover__orb" />
      <Disc3 aria-hidden="true" />
    </div>
  );
}

function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selected, setSelected] = useState(fallbackTrack);
  const [isPlaying, setIsPlaying] = useState(false);
  const [liked, setLiked] = useState(true);
  const [progress, setProgress] = useState(37);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    // The browser-only Vite preview has no native SQLite backend. In Tauri,
    // restore the persisted library once when the application mounts.
    if (!isDesktopApp()) return;
    void listLibrary().then((savedTracks) => {
      const restored = savedTracks.map((track) => ({
        ...track, duration: formatTime(track.durationSeconds), color: "#59634b",
      }));
      setTracks(restored);
      if (restored[0]) setSelected(restored[0]);
    }).catch((reason) => setError(String(reason)));
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
    void listPlaylistTracks(activePlaylistId).then((savedTracks) => {
      setPlaylistTracks(savedTracks.map((track) => ({ ...track, duration: formatTime(track.durationSeconds), color: "#59634b" })));
    }).catch((reason) => setError(String(reason)));
  }, [activePlaylistId]);

  useEffect(() => {
    // Rodio owns the authoritative clock. Polling avoids accumulating drift in
    // a second JavaScript timer and also observes pause/finish state changes.
    if (!isDesktopApp() || !selected.path) return;
    const timer = window.setInterval(async () => {
      try {
        const status = await getPlayerStatus();
        setIsPlaying(status.playing);
        if (status.durationSeconds > 0) setProgress((status.positionSeconds / status.durationSeconds) * 100);
      } catch {
        // The player may be shutting down while the final poll is in flight.
      }
    }, 300);
    return () => window.clearInterval(timer);
  }, [selected.path]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
  };

  const runPlayerAction = async (action: () => Promise<unknown>) => {
    // Native command failures are normalized into one dismissible UI error.
    try {
      setError(null);
      await action();
    } catch (reason) {
      setError(String(reason));
    }
  };

  const chooseTrack = async (track: Track) => {
    setSelected(track);
    setProgress(0);
    setError(null);
    if (!track.path) {
      setIsPlaying(false);
      return;
    }
    await runPlayerAction(async () => {
      await loadAudio(track.path!);
      await playAudio();
      setIsPlaying(true);
    });
  };

  const importMusic = async () => {
    if (!isDesktopApp()) {
      setError("File import and native playback are available in the Tauri app. Run npm run tauri:dev.");
      return;
    }
    await runPlayerAction(async () => {
      // The dialog command loads the audio in a paused state. Metadata is then
      // persisted before the new item becomes visible and playback starts.
      const loaded = await chooseAudioFile();
      if (!loaded) return;
      const metadata = await importLibraryTrack(loaded.path);
      const imported: Track = { ...metadata, duration: formatTime(metadata.durationSeconds), color: "#9a654b" };
      setTracks((current) => [imported, ...current.filter((track) => track.path !== imported.path)]);
      setSelected(imported);
      setProgress(0);
      await playAudio();
      setIsPlaying(true);
    });
  };

  const togglePlayback = () => runPlayerAction(async () => {
    if (!selected.path) throw new Error("Import a local audio file to start playback.");
    if (isPlaying) await pauseAudio(); else await playAudio();
    setIsPlaying(!isPlaying);
  });

  const skipTrack = async (offset: number) => {
    // When browsing a playlist, previous/next follows that playlist's order.
    const playable = (activePage === "playlists" ? playlistTracks : tracks).filter((track) => track.path);
    if (!playable.length) return setError("Import a local audio file first.");
    const currentIndex = playable.findIndex((track) => track.id === selected.id);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + offset + playable.length) % playable.length;
    await chooseTrack(playable[nextIndex]);
  };

  const seekTo = (percentage: number) => {
    setProgress(percentage);
    if (selected.durationSeconds) void runPlayerAction(() => seekAudio((percentage / 100) * selected.durationSeconds!));
  };

  const refreshPlaylists = async (preferredId?: number) => {
    const updated = await listPlaylists();
    setPlaylists(updated);
    if (preferredId !== undefined) setActivePlaylistId(preferredId);
    else if (activePlaylistId !== null && !updated.some((playlist) => playlist.id === activePlaylistId)) setActivePlaylistId(updated[0]?.id ?? null);
  };

  const submitPlaylist = () => void runPlayerAction(async () => {
    const id = await createPlaylist(playlistName);
    await refreshPlaylists(id);
    setPlaylistName("");
    setCreatePlaylistOpen(false);
  });

  const removePlaylist = () => void runPlayerAction(async () => {
    if (activePlaylistId === null) return;
    if (!window.confirm(`Delete “${activePlaylist?.name ?? "this playlist"}”? The tracks will remain in your library.`)) return;
    await deletePlaylist(activePlaylistId);
    setPlaylistTracks([]);
    await refreshPlaylists();
  });

  const addSelectedTrack = () => void runPlayerAction(async () => {
    if (activePlaylistId === null || !trackToAdd) return;
    await addTrackToPlaylist(activePlaylistId, Number(trackToAdd));
    setTrackToAdd("");
    const [updatedTracks] = await Promise.all([listPlaylistTracks(activePlaylistId), refreshPlaylists(activePlaylistId)]);
    setPlaylistTracks(updatedTracks.map((track) => ({ ...track, duration: formatTime(track.durationSeconds), color: "#59634b" })));
  });

  const removePlaylistTrack = (trackId: number) => void runPlayerAction(async () => {
    if (activePlaylistId === null) return;
    await removeTrackFromPlaylist(activePlaylistId, trackId);
    const [updatedTracks] = await Promise.all([listPlaylistTracks(activePlaylistId), refreshPlaylists(activePlaylistId)]);
    setPlaylistTracks(updatedTracks.map((track) => ({ ...track, duration: formatTime(track.durationSeconds), color: "#59634b" })));
  });

  const activePlaylist = playlists.find((playlist) => playlist.id === activePlaylistId);
  const availablePlaylistTracks = tracks.filter((track) => !playlistTracks.some((playlistTrack) => playlistTrack.id === track.id));

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand__mark"><AudioLines /></span><span>seenstruments</span></div>
        <nav className="primary-nav" aria-label="Main navigation">
          <button className={`nav-item ${activePage === "library" ? "nav-item--active" : ""}`} onClick={() => setActivePage("library")}><Library /> Library</button>
          <button className={`nav-item ${activePage === "playlists" ? "nav-item--active" : ""}`} onClick={() => setActivePage("playlists")}><ListMusic /> Playlists</button>
        </nav>
        <nav className="secondary-nav">
          <button className="nav-item"><Heart /> Favorites <span>24</span></button>
          <button className="nav-item"><Gauge /> Recently analyzed</button>
        </nav>
        <div className="sidebar__spacer" />
        <div className="storage-card">
          <div className="storage-card__title"><span><Activity /> Analysis engine</span><i /></div>
          <p>Local processing</p>
          <div className="storage-card__bar"><span /></div>
          <small>4 of 6 tracks analyzed</small>
        </div>
        <nav className="utility-nav" aria-label="Application options">
          <button className="utility-nav__item" title="Settings"><Settings /><span>Settings</span></button>
          <button className="utility-nav__item" title="Help"><HelpCircle /><span>Help</span></button>
          <button className="utility-nav__item" title="Accessibility"><Accessibility /><span>Accessibility</span></button>
        </nav>
      </aside>

      <section className="workspace">
        <div className="content">
          {activePage === "library" && <section className="library-panel">
            <div className="section-heading">
              <div><span className="eyebrow">YOUR COLLECTION</span><h1>Music library</h1><p>{tracks.length} tracks · {Math.round(tracks.reduce((total, track) => total + (track.durationSeconds ?? 0), 0) / 60)} minutes</p></div>
              <button className="primary-button" onClick={importMusic}><Plus /> Add music</button>
            </div>

            <div className="filter-row">
              <div className="segmented" aria-label="Library classification">
                {(["tracks", "albums", "artists"] as LibraryView[]).map((view) => (
                  <button className={libraryView === view ? "active" : ""} onClick={() => setLibraryView(view)} key={view}>
                    {view[0].toUpperCase() + view.slice(1)}
                  </button>
                ))}
              </div>
              <div className="filter-menu">
                <button className={`filter-button ${analysisFilter !== "all" ? "filter-button--active" : ""}`} onClick={() => setFilterOpen((open) => !open)} aria-expanded={filterOpen}>
                  <SlidersHorizontal /> {analysisFilter === "all" ? "All music" : analysisFilter === "analyzed" ? "Analyzed" : "Pending"} <ChevronDown />
                </button>
                {filterOpen && (
                  <div className="filter-menu__popover">
                    {(["all", "analyzed", "pending"] as AnalysisFilter[]).map((filter) => (
                      <button className={analysisFilter === filter ? "active" : ""} onClick={() => { setAnalysisFilter(filter); setFilterOpen(false); }} key={filter}>
                        <span>{filter === "all" ? "All music" : filter[0].toUpperCase() + filter.slice(1)}</span>
                        <small>{filter === "all" ? tracks.length : tracks.filter((track) => filter === "analyzed" ? track.analyzed : !track.analyzed).length}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {libraryView === "tracks" && (
              <div className="track-list" role="table" aria-label="Music library">
                <div className="track-row track-row--header" role="row"><span>#</span><span>Title</span><span>Album</span><span>Year</span><span>Analysis</span><span>Time</span></div>
                {filteredTracks.map((track, index) => (
                  <button className={`track-row ${selected.id === track.id ? "track-row--selected" : ""}`} onClick={() => void chooseTrack(track)} key={track.id} role="row">
                    <span className="track-index">{selected.id === track.id && isPlaying ? <AudioLines /> : index + 1}</span>
                    <span className="track-title"><Cover track={track} compact /><span><b>{track.title}</b><small>{track.artist}</small></span></span>
                    <span>{track.album}</span><span>{track.year}</span>
                    <span><i className={`status-dot ${track.analyzed ? "status-dot--done" : ""}`} />{track.analyzed ? "Analyzed" : "Pending"}</span>
                    <span>{track.duration}</span>
                  </button>
                ))}
              </div>
            )}

            {libraryView === "albums" && (
              <div className="collection-grid" aria-label="Albums">
                {albums.map((album) => (
                  <button className="collection-card" onClick={() => setSelected(album.tracks[0])} key={`${album.name}-${album.artist}`}>
                    <Cover track={album.tracks[0]} />
                    <span className="collection-card__copy"><b>{album.name}</b><small>{album.artist}</small><em><DiscAlbum /> {album.tracks.length} {album.tracks.length === 1 ? "track" : "tracks"}</em></span>
                  </button>
                ))}
              </div>
            )}

            {libraryView === "artists" && (
              <div className="collection-grid collection-grid--artists" aria-label="Artists">
                {artists.map((artist) => (
                  <button className="collection-card artist-card" onClick={() => setSelected(artist.tracks[0])} key={artist.name}>
                    <div className="artist-card__portrait">{artist.tracks[0].coverDataUrl ? <Cover track={artist.tracks[0]} /> : <UserRound />}</div>
                    <span className="collection-card__copy"><b>{artist.name}</b><small>{new Set(artist.tracks.map((track) => track.album)).size} albums</small><em><Music2 /> {artist.tracks.length} {artist.tracks.length === 1 ? "track" : "tracks"}</em></span>
                  </button>
                ))}
              </div>
            )}

            {filteredTracks.length === 0 && <div className="empty-state">{tracks.length === 0 ? "Your library is empty. Add a local audio file to get started." : "No music matches this filter."}</div>}
          </section>}

          {activePage === "playlists" && <section className="library-panel playlist-page">
            <div className="section-heading">
              <div><span className="eyebrow">YOUR COLLECTION</span><h1>Playlists</h1><p>{playlists.length} custom {playlists.length === 1 ? "playlist" : "playlists"}</p></div>
              <button className="primary-button" onClick={() => setCreatePlaylistOpen(true)}><FolderPlus /> New playlist</button>
            </div>

            <div className="playlist-layout">
              <aside className="playlist-index">
                <div className="playlist-index__heading"><span>Your playlists</span><small>{playlists.length}</small></div>
                {playlists.map((playlist) => (
                  <button className={`playlist-index__item ${activePlaylistId === playlist.id ? "active" : ""}`} onClick={() => setActivePlaylistId(playlist.id)} key={playlist.id}>
                    <span className="playlist-index__icon"><ListMusic /></span>
                    <span><b>{playlist.name}</b><small>{playlist.trackCount} {playlist.trackCount === 1 ? "track" : "tracks"}</small></span>
                  </button>
                ))}
                {playlists.length === 0 && <div className="playlist-index__empty">Create your first playlist to organize tracks.</div>}
              </aside>

              <div className="playlist-detail">
                {activePlaylist ? <>
                  <div className="playlist-detail__header">
                    <span className="playlist-detail__art"><ListMusic /></span>
                    <span><small>PLAYLIST</small><h2>{activePlaylist.name}</h2><p>{activePlaylist.trackCount} tracks · {Math.round(activePlaylist.durationSeconds / 60)} minutes</p></span>
                    <button className="danger-button" onClick={removePlaylist} title="Delete playlist"><Trash2 /></button>
                  </div>

                  <div className="playlist-add">
                    <select value={trackToAdd} onChange={(event) => setTrackToAdd(event.target.value)} disabled={availablePlaylistTracks.length === 0}>
                      <option value="">{availablePlaylistTracks.length ? "Choose a track from your library" : "All library tracks are already added"}</option>
                      {availablePlaylistTracks.map((track) => <option value={track.id} key={track.id}>{track.title} — {track.artist}</option>)}
                    </select>
                    <button onClick={addSelectedTrack} disabled={!trackToAdd}><Plus /> Add track</button>
                  </div>

                  <div className="playlist-track-list">
                    {playlistTracks.map((track, index) => (
                      <div className={`playlist-track ${selected.id === track.id ? "active" : ""}`} key={track.id}>
                        <button className="playlist-track__play" onClick={() => void chooseTrack(track)}>
                          <span>{selected.id === track.id && isPlaying ? <AudioLines /> : index + 1}</span>
                          <Cover track={track} compact />
                          <span><b>{track.title}</b><small>{track.artist}</small></span>
                          <em>{track.duration}</em>
                        </button>
                        <button className="playlist-track__remove" onClick={() => removePlaylistTrack(track.id)} title="Remove from playlist"><X /></button>
                      </div>
                    ))}
                    {playlistTracks.length === 0 && <div className="empty-state">This playlist is empty. Add a track from your library above.</div>}
                  </div>
                </> : <div className="playlist-detail__empty"><ListMusic /><h2>No playlist selected</h2><p>Use New playlist in the upper-right corner to start building your collection.</p></div>}
              </div>
            </div>
          </section>}

          <aside className="insights-panel">
            <div className="now-playing-card">
              <div className="now-playing-card__label">NOW EXPLORING <MoreHorizontal /></div>
              <Cover track={selected} />
              <h2>{selected.title}</h2><p>{selected.artist} · {selected.album}</p>
            </div>
            <div className="insight-title"><span><Sparkles /> Instruments detected</span><small>5 found</small></div>
            <div className="instrument-list">
              {instruments.map(({ name, confidence, color, icon: Icon }) => (
                <div className="instrument" key={name}>
                  <span className="instrument__icon" style={{ color, backgroundColor: `${color}18` }}><Icon /></span>
                  <span className="instrument__name"><b>{name}</b><i><em style={{ width: `${confidence}%`, background: color }} /></i></span>
                  <strong>{confidence}%</strong>
                </div>
              ))}
            </div>
            <button className="analysis-button"><Activity /> Open full analysis <span>→</span></button>
          </aside>
        </div>

        {activePage === "library" && <section className="timeline-panel">
          <div className="timeline-panel__header"><span><b>Instrument timeline</b><small>Click a region to explore the arrangement</small></span><div><button className="chip chip--active">All</button><button className="chip">Rhythm</button><button className="chip">Melody</button></div></div>
          <div className="timeline-content">
            <div className="timeline-labels"><span>Drums</span><span>Bass</span><span>Guitar</span><span>Synth</span></div>
            <div className="timeline-tracks">
              <div className="timeline-line"><i style={{ left: "0%", width: "100%", background: "#ef765f" }} /></div>
              <div className="timeline-line"><i style={{ left: "7%", width: "89%", background: "#b97cf2" }} /></div>
              <div className="timeline-line"><i style={{ left: "22%", width: "35%", background: "#5ca9ef" }} /><i style={{ left: "67%", width: "26%", background: "#5ca9ef" }} /></div>
              <div className="timeline-line"><i style={{ left: "0%", width: "31%", background: "#65c99b" }} /><i style={{ left: "44%", width: "52%", background: "#65c99b" }} /></div>
              <div className="playhead" style={{ left: `${progress}%` }}><i /></div>
            </div>
          </div>
        </section>}

        {createPlaylistOpen && <div className="modal-backdrop" onMouseDown={() => setCreatePlaylistOpen(false)}>
          <form className="modal" onSubmit={(event) => { event.preventDefault(); submitPlaylist(); }} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal__icon"><FolderPlus /></div>
            <button className="modal__close" type="button" onClick={() => setCreatePlaylistOpen(false)}><X /></button>
            <h2>Create a playlist</h2>
            <p>Give your playlist a name. You can add tracks after it is created.</p>
            <label>Playlist name<input autoFocus maxLength={80} value={playlistName} onChange={(event) => setPlaylistName(event.target.value)} placeholder="e.g. Late night listening" /></label>
            <div className="modal__actions"><button type="button" onClick={() => setCreatePlaylistOpen(false)}>Cancel</button><button className="primary-button" type="submit" disabled={!playlistName.trim()}>Create playlist</button></div>
          </form>
        </div>}

        {error && <button className="error-toast" onClick={() => setError(null)}>{error}<span>×</span></button>}
        <footer className="player">
          <div className="player__track"><Cover track={selected} compact /><span><b>{selected.title}</b><small>{selected.artist}</small></span><button className={`bare-button ${liked ? "is-liked" : ""}`} onClick={() => setLiked(!liked)}><Heart fill={liked ? "currentColor" : "none"} /></button></div>
          <div className="player__center">
            <div className="transport"><button><Shuffle /></button><button onClick={() => void skipTrack(-1)}><SkipBack /></button><button className="play-button" onClick={() => void togglePlayback()}>{isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button><button onClick={() => void skipTrack(1)}><SkipForward /></button><button><Repeat2 /></button></div>
            <div className="seek"><small>{formatTime((progress / 100) * (selected.durationSeconds ?? 0))}</small><input type="range" value={progress} onChange={(event) => seekTo(Number(event.target.value))} /><small>{selected.duration}</small></div>
          </div>
          <div className="player__volume"><Volume2 /><input type="range" defaultValue="72" onChange={(event) => selected.path && void runPlayerAction(() => changeVolume(Number(event.target.value) / 100))} /><button className="quality">LOSSLESS</button></div>
        </footer>
      </section>
    </main>
  );
}

export default App;
