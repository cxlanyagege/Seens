import { Activity, MoreHorizontal, Music2, Sparkles } from "lucide-react";
import { Cover } from "../../components/Cover";
import type { Track } from "../../types/music";
import { useAudioInfo } from "../player/useAudioInfo";
import { formatActiveDuration, getInstrumentColor } from "./instrumentStyle";
import { useInstrumentAnalysis } from "./useInstrumentAnalysis";

export function InsightsPanel({ selected, onOpenAnalysis }: { selected: Track; onOpenAnalysis: () => void }) {
  const audioInfo = useAudioInfo(selected.path);
  const analysis = useInstrumentAnalysis(selected.id, selected.path);
  const quality = formatAudioInfo(audioInfo.data, selected.path, audioInfo.status);
  const instruments = analysis.data?.instruments ?? [];
  const analysisLabel = analysis.status === "ready" ? `${instruments.length} found` : analysis.status === "loading" ? "Loading…" : analysis.status === "analyzing" ? "Analyzing…" : "Not analyzed";

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
      <div className="insight-title"><span><Sparkles /> Instruments detected</span><small>{analysisLabel}</small></div>
      <div className="instrument-list">
        {analysis.status === "ready" && instruments.slice(0, 6).map(({ instrument, activeSeconds }) => {
          const color = getInstrumentColor(instrument);
          const activity = analysis.data?.durationSeconds ? Math.min(100, (activeSeconds / analysis.data.durationSeconds) * 100) : 0;
          return (
            <div className="instrument" key={instrument}>
              <span className="instrument__icon" style={{ color, backgroundColor: `${color}18` }}><Music2 /></span>
              <span className="instrument__name"><b>{instrument}</b><i><em style={{ width: `${activity}%`, background: color }} /></i></span>
              <strong>{formatActiveDuration(activeSeconds)}</strong>
            </div>
          );
        })}
        {analysis.status !== "ready" && <p className="instrument-list__empty">Open the full analysis to scan this track and view its instrument timeline.</p>}
        {analysis.status === "ready" && instruments.length === 0 && <p className="instrument-list__empty">No supported instruments crossed the current detection threshold.</p>}
      </div>
      <button className="analysis-button" onClick={onOpenAnalysis}><Activity /> Open full analysis <span>→</span></button>
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
