import { useState } from "react";
import type { CSSProperties } from "react";
import { ChevronDown, ChevronUp, ListMusic, Pause, Play, Repeat2, Shuffle, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { Cover } from "../../components/Cover";
import { formatTime } from "../../lib/format";
import type { Track } from "../../types/music";

type PlayerBarProps = {
  selected: Track;
  isPlaying: boolean;
  progress: number;
  onTogglePlayback: () => void;
  onSkip: (offset: number) => void;
  onSeek: (percentage: number) => void;
  onVolumeChange: (volume: number) => void;
  timelineOpen: boolean;
  onToggleTimeline: () => void;
  queueOpen: boolean;
  queueCount: number;
  onToggleQueue: () => void;
};

export function PlayerBar({ selected, isPlaying, progress, onTogglePlayback, onSkip, onSeek, onVolumeChange, timelineOpen, onToggleTimeline, queueOpen, queueCount, onToggleQueue }: PlayerBarProps) {
  const [volume, setVolume] = useState(72);
  const progressStyle = { "--range-progress": `${Math.min(100, Math.max(0, progress))}%` } as CSSProperties;
  const volumeStyle = { "--range-progress": `${volume}%` } as CSSProperties;

  return (
    <footer className={`player ${timelineOpen ? "player--timeline-open" : ""}`}>
      <div className="player__track">
        <button className={`player__cover-toggle ${timelineOpen ? "active" : ""}`} onClick={onToggleTimeline} aria-label={timelineOpen ? "Hide instrument timeline" : "Show instrument timeline"} aria-pressed={timelineOpen} title={timelineOpen ? "Hide instrument timeline" : "Show instrument timeline"}>
          <Cover track={selected} compact />
          <span className="player__cover-hint" aria-hidden="true">{timelineOpen ? <ChevronDown /> : <ChevronUp />}</span>
        </button>
        {selected.path && <span><b>{selected.title}</b><small>{selected.artist}</small></span>}
      </div>
      <div className={`player__center ${timelineOpen ? "player__center--timeline-open" : ""}`}>
        <div className="transport">
          <button><Shuffle /></button><button onClick={() => onSkip(-1)}><SkipBack /></button>
          <button className="play-button" onClick={onTogglePlayback}>{isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button>
          <button onClick={() => onSkip(1)}><SkipForward /></button><button><Repeat2 /></button>
        </div>
        <div className={`seek ${timelineOpen ? "seek--hidden" : ""}`} aria-hidden={timelineOpen}>
          <small>{formatTime((progress / 100) * (selected.durationSeconds ?? 0))}</small>
          <input type="range" value={progress} onChange={(event) => onSeek(Number(event.target.value))} style={progressStyle} aria-label="Playback position" tabIndex={timelineOpen ? -1 : undefined} />
          <small>{selected.duration}</small>
        </div>
      </div>
      <div className="player__tools">
        <button className={`player__queue-toggle ${queueOpen ? "active" : ""}`} onClick={onToggleQueue} aria-label={queueOpen ? "Close play queue" : "Open play queue"} aria-pressed={queueOpen} title={queueOpen ? "Close play queue" : "Open play queue"}>
          <ListMusic />
          {queueCount > 0 && <small>{queueCount > 99 ? "99+" : queueCount}</small>}
        </button>
        <div className="player__volume"><Volume2 /><input type="range" value={volume} style={volumeStyle} aria-label="Volume" onChange={(event) => { const nextVolume = Number(event.target.value); setVolume(nextVolume); onVolumeChange(nextVolume / 100); }} /></div>
      </div>
    </footer>
  );
}
