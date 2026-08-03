import { useState } from "react";
import type { CSSProperties } from "react";
import { ChevronDown, ChevronUp, ListMusic, Pause, Play, Repeat1, Repeat2, Shuffle, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { Cover } from "../../components/Cover";
import { formatTime } from "../../lib/format";
import type { Track } from "../../types/music";
import type { RepeatMode } from "./usePlayer";

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
  shuffleEnabled: boolean;
  repeatMode: RepeatMode;
  onToggleShuffle: () => void;
  onCycleRepeatMode: () => void;
};

export function PlayerBar({ selected, isPlaying, progress, onTogglePlayback, onSkip, onSeek, onVolumeChange, timelineOpen, onToggleTimeline, queueOpen, queueCount, onToggleQueue, shuffleEnabled, repeatMode, onToggleShuffle, onCycleRepeatMode }: PlayerBarProps) {
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
          <button className={shuffleEnabled ? "active" : ""} onClick={onToggleShuffle} aria-label={shuffleEnabled ? "Disable shuffle" : "Enable shuffle"} aria-pressed={shuffleEnabled} title={shuffleEnabled ? "Shuffle on" : "Shuffle off"}><Shuffle /></button>
          <button onClick={() => onSkip(-1)} aria-label="Previous track" title="Previous track"><SkipBack /></button>
          <button className="play-button" onClick={onTogglePlayback} aria-label={isPlaying ? "Pause" : "Play"} title={isPlaying ? "Pause" : "Play"}>{isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button>
          <button onClick={() => onSkip(1)} aria-label="Next track" title="Next track"><SkipForward /></button>
          <button className={repeatMode === "off" ? "" : "active"} onClick={onCycleRepeatMode} aria-label={`Repeat mode: ${repeatMode}`} aria-pressed={repeatMode !== "off"} title={repeatMode === "off" ? "Repeat off" : repeatMode === "all" ? "Repeat all" : "Repeat one"}>
            {repeatMode === "one" ? <Repeat1 /> : <Repeat2 />}
          </button>
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
