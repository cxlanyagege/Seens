import { useEffect, useState } from "react";
import {
  Accessibility,
  Activity,
  AudioLines,
  ChevronDown,
  Disc3,
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
  Volume2,
} from "lucide-react";
import {
  changeVolume,
  chooseAudioFile,
  getPlayerStatus,
  importLibraryTrack,
  isDesktopApp,
  listLibrary,
  loadAudio,
  pauseAudio,
  playAudio,
  seekAudio,
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

const fallbackTrack: Track = { id: 0, title: "No track selected", artist: "Import music to begin", album: "Library", duration: "0:00", year: "", color: "#4c5040", analyzed: false };

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

  useEffect(() => {
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
    const playable = tracks.filter((track) => track.path);
    if (!playable.length) return setError("Import a local audio file first.");
    const currentIndex = playable.findIndex((track) => track.id === selected.id);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + offset + playable.length) % playable.length;
    await chooseTrack(playable[nextIndex]);
  };

  const seekTo = (percentage: number) => {
    setProgress(percentage);
    if (selected.durationSeconds) void runPlayerAction(() => seekAudio((percentage / 100) * selected.durationSeconds!));
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand__mark"><AudioLines /></span><span>seenstruments</span></div>
        <nav className="primary-nav" aria-label="Main navigation">
          <button className="nav-item nav-item--active"><Library /> Library</button>
          <button className="nav-item"><ListMusic /> Playlists</button>
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
          <section className="library-panel">
            <div className="section-heading">
              <div><span className="eyebrow">YOUR COLLECTION</span><h1>Music library</h1><p>{tracks.length} tracks · {Math.round(tracks.reduce((total, track) => total + (track.durationSeconds ?? 0), 0) / 60)} minutes</p></div>
              <button className="primary-button" onClick={importMusic}><Plus /> Add music</button>
            </div>

            <div className="filter-row">
              <div className="segmented"><button className="active">Tracks</button><button>Albums</button><button>Artists</button></div>
              <button className="filter-button"><SlidersHorizontal /> All music <ChevronDown /></button>
            </div>

            <div className="track-list" role="table" aria-label="Music library">
              <div className="track-row track-row--header" role="row"><span>#</span><span>Title</span><span>Album</span><span>Year</span><span>Analysis</span><span>Time</span></div>
              {tracks.map((track, index) => (
                <button className={`track-row ${selected.id === track.id ? "track-row--selected" : ""}`} onClick={() => void chooseTrack(track)} key={track.id} role="row">
                  <span className="track-index">{selected.id === track.id && isPlaying ? <AudioLines /> : index + 1}</span>
                  <span className="track-title"><Cover track={track} compact /><span><b>{track.title}</b><small>{track.artist}</small></span></span>
                  <span>{track.album}</span><span>{track.year}</span>
                  <span><i className={`status-dot ${track.analyzed ? "status-dot--done" : ""}`} />{track.analyzed ? "Analyzed" : "Pending"}</span>
                  <span>{track.duration}</span>
                </button>
              ))}
              {tracks.length === 0 && <div className="empty-state">Your library is empty. Add a local audio file to get started.</div>}
            </div>
          </section>

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

        <section className="timeline-panel">
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
        </section>

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
