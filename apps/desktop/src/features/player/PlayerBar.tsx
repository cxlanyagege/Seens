import { Pause, Play, Repeat2, Shuffle, SkipBack, SkipForward, Volume2 } from "lucide-react";
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
};

export function PlayerBar({ selected, isPlaying, progress, onTogglePlayback, onSkip, onSeek, onVolumeChange }: PlayerBarProps) {
  return (
    <footer className="player">
      <div className="player__track"><Cover track={selected} compact /><span><b>{selected.title}</b><small>{selected.artist}</small></span></div>
      <div className="player__center">
        <div className="transport">
          <button><Shuffle /></button><button onClick={() => onSkip(-1)}><SkipBack /></button>
          <button className="play-button" onClick={onTogglePlayback}>{isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button>
          <button onClick={() => onSkip(1)}><SkipForward /></button><button><Repeat2 /></button>
        </div>
        <div className="seek"><small>{formatTime((progress / 100) * (selected.durationSeconds ?? 0))}</small><input type="range" value={progress} onChange={(event) => onSeek(Number(event.target.value))} /><small>{selected.duration}</small></div>
      </div>
      <div className="player__volume"><Volume2 /><input type="range" defaultValue="72" onChange={(event) => onVolumeChange(Number(event.target.value) / 100)} /><button className="quality">LOSSLESS</button></div>
    </footer>
  );
}

