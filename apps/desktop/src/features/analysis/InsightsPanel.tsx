import { Activity, AudioLines, MoreHorizontal, Music2, Piano, SlidersHorizontal, Sparkles } from "lucide-react";
import { Cover } from "../../components/Cover";
import type { Track } from "../../types/music";
import { useAudioInfo } from "../player/useAudioInfo";

// Placeholder data until the local analysis sidecar supplies real results.
const instruments = [
  { name: "Drums", confidence: 98, color: "#ef765f", icon: Activity },
  { name: "Bass", confidence: 94, color: "#b97cf2", icon: AudioLines },
  { name: "Electric guitar", confidence: 89, color: "#5ca9ef", icon: Music2 },
  { name: "Synthesizer", confidence: 83, color: "#65c99b", icon: SlidersHorizontal },
  { name: "Piano", confidence: 61, color: "#e1b85b", icon: Piano },
];

export function InsightsPanel({ selected }: { selected: Track }) {
  const audioInfo = useAudioInfo(selected.path);
  const quality = formatAudioInfo(audioInfo.data, selected.path, audioInfo.status);

  return (
    <aside className="insights-panel utility-panel">
      <div className="now-playing-card">
        <div className="now-playing-card__label">NOW EXPLORING <MoreHorizontal /></div>
        <Cover track={selected} />
        <h2>{selected.title}</h2><p>{selected.artist} · {selected.album}</p>
        {selected.path && (
          <div className="now-playing-card__audio" title={quality.details}>
            <span>Audio quality</span>
            <strong>{quality.label}</strong>
          </div>
        )}
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
