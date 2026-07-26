import { Pause, Play, Repeat2, Shuffle, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { Cover } from "../../components/Cover";
import { formatTime } from "../../lib/format";
import type { Track } from "../../types/music";
import { useAudioInfo } from "./useAudioInfo";

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
};

export function PlayerBar({ selected, isPlaying, progress, onTogglePlayback, onSkip, onSeek, onVolumeChange, timelineOpen, onToggleTimeline }: PlayerBarProps) {
  const audioInfo = useAudioInfo(selected.path);
  const quality = formatAudioInfo(audioInfo.data, selected.path, audioInfo.status);

  return (
    <footer className={`player ${timelineOpen ? "player--timeline-open" : ""}`}>
      <div className="player__track"><button className={`player__cover-toggle ${timelineOpen ? "active" : ""}`} onClick={onToggleTimeline} aria-label={timelineOpen ? "Hide instrument timeline" : "Show instrument timeline"} aria-pressed={timelineOpen} title={timelineOpen ? "Hide instrument timeline" : "Show instrument timeline"}><Cover track={selected} compact /></button><span><b>{selected.title}</b><small>{selected.artist}</small></span></div>
      <div className={`player__center ${timelineOpen ? "player__center--timeline-open" : ""}`}>
        <div className="transport">
          <button><Shuffle /></button><button onClick={() => onSkip(-1)}><SkipBack /></button>
          <button className="play-button" onClick={onTogglePlayback}>{isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button>
          <button onClick={() => onSkip(1)}><SkipForward /></button><button><Repeat2 /></button>
        </div>
        {!timelineOpen && <div className="seek"><small>{formatTime((progress / 100) * (selected.durationSeconds ?? 0))}</small><input type="range" value={progress} onChange={(event) => onSeek(Number(event.target.value))} /><small>{selected.duration}</small></div>}
      </div>
      <div className="player__volume"><Volume2 /><input type="range" defaultValue="72" onChange={(event) => onVolumeChange(Number(event.target.value) / 100)} /><span className="quality" title={quality.details}>{quality.label}</span></div>
    </footer>
  );
}

function formatSampleRate(sampleRateHz: number) {
  const kilohertz = sampleRateHz / 1000;
  return `${Number.isInteger(kilohertz) ? kilohertz : kilohertz.toFixed(1)} KHZ`;
}

function formatAudioInfo(info: ReturnType<typeof useAudioInfo>["data"], path: string | undefined, status: ReturnType<typeof useAudioInfo>["status"]) {
  const fallbackFormat = path?.split(".").pop()?.toUpperCase() || "AUDIO";
  if (!info) return { label: status === "loading" ? "READING…" : fallbackFormat, details: status === "loading" ? "Reading audio information…" : "Audio information unavailable" };

  const format = (info.codec || info.format || fallbackFormat).toUpperCase();
  const bitrate = info.audioBitrateKbps || info.overallBitrateKbps;
  const labelParts = [format];
  if (info.bitDepth) labelParts.push(`${info.bitDepth}-BIT`);
  else if (bitrate) labelParts.push(`${bitrate} KBPS`);
  if (info.sampleRateHz) labelParts.push(formatSampleRate(info.sampleRateHz));

  const channelLabel = info.channels === 1 ? "Mono" : info.channels === 2 ? "Stereo" : info.channels ? `${info.channels} channels` : null;
  const detailParts = [info.codec || info.format];
  if (info.bitDepth) detailParts.push(`${info.bitDepth}-bit`);
  if (info.sampleRateHz) detailParts.push(formatSampleRate(info.sampleRateHz).toLowerCase());
  if (bitrate) detailParts.push(`${bitrate} kbps`);
  if (channelLabel) detailParts.push(channelLabel);
  if (info.lossless !== null) detailParts.push(info.lossless ? "Lossless" : "Lossy");
  return { label: labelParts.join(" · "), details: detailParts.join(" · ") };
}
