import { Maximize2, Minimize2, ZoomIn, ZoomOut } from "lucide-react";
import { useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { formatTime } from "../../lib/format";
import type { Track } from "../../types/music";
import { getInstrumentColor } from "./instrumentStyle";
import { useInstrumentAnalysis } from "./useInstrumentAnalysis";
import { useWaveform } from "./useWaveform";

type InstrumentTimelineProps = {
  onSeek: (percentage: number) => void;
  progress: number;
  track: Track;
  visible: boolean;
  onAnalysisComplete: (trackId: number) => void;
};

const tabs = ["Overview", "Waveform", "Spectrum", "Chords", "Beat"];
const markerIntervals = [5, 10, 15, 30, 60, 120, 300, 600, 900];

function buildTimeMarkers(durationSeconds: number) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return [{ seconds: 0, position: 0 }];
  const targetInterval = durationSeconds / 9;
  const longestPreset = markerIntervals.at(-1)!;
  const interval = markerIntervals.find((candidate) => candidate >= targetInterval)
    ?? Math.ceil(targetInterval / longestPreset) * longestPreset;
  const markers = Array.from({ length: Math.ceil(durationSeconds / interval) }, (_, index) => index * interval)
    .filter((seconds) => seconds < durationSeconds);
  const last = markers.at(-1);
  if (last !== undefined && formatTime(last) === formatTime(durationSeconds)) markers[markers.length - 1] = durationSeconds;
  else markers.push(durationSeconds);
  return markers.map((seconds) => ({ seconds, position: (seconds / durationSeconds) * 100 }));
}

function buildWaveformPath(peaks: number[]) {
  if (!peaks.length) return "";
  const normalizedPeaks = peaks.map((peak) => Number.isFinite(peak) ? Math.max(0, peak) : 0);
  const sortedPeaks = [...normalizedPeaks].sort((left, right) => left - right);
  const visualPeak = sortedPeaks[Math.floor((sortedPeaks.length - 1) * .98)] || 1;
  const step = 1000 / Math.max(1, peaks.length - 1);
  return normalizedPeaks.map((peak, index) => {
    const amplitude = Math.min(1, peak / visualPeak) * 43;
    const x = index * step;
    return `M${x.toFixed(2)} ${(50 - amplitude).toFixed(2)}V${(50 + amplitude).toFixed(2)}`;
  }).join("");
}

export function InstrumentTimeline({ onSeek, progress, track, visible, onAnalysisComplete }: InstrumentTimelineProps) {
  const [activeTab, setActiveTab] = useState("Overview");
  const [zoom, setZoom] = useState(100);
  const [expanded, setExpanded] = useState(false);
  const waveform = useWaveform(track.path, visible);
  const analysis = useInstrumentAnalysis(track.id, track.path, visible);
  const playheadPosition = Math.min(100, Math.max(0, progress));
  const reportedDuration = analysis.data?.durationSeconds || waveform.data?.durationSeconds || track.durationSeconds || 0;
  const durationSeconds = Number.isFinite(reportedDuration) && reportedDuration > 0 ? reportedDuration : 0;
  const timeMarkers = useMemo(() => buildTimeMarkers(durationSeconds), [durationSeconds]);
  const waveformPath = useMemo(() => buildWaveformPath(waveform.data?.peaks ?? []), [waveform.data]);
  const instrumentRows = useMemo(() => (analysis.data?.instruments ?? []).map((summary) => ({
    ...summary,
    color: getInstrumentColor(summary.instrument),
    segments: analysis.data?.segments.filter((segment) => segment.instrument === summary.instrument) ?? [],
  })), [analysis.data]);
  const runAnalysis = async () => {
    const result = await analysis.analyze();
    if (result) onAnalysisComplete(track.id);
  };
  const seekTo = (percentage: number) => onSeek(Math.min(100, Math.max(0, percentage)));
  const seekFromWaveform = (event: MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width > 0) seekTo(((event.clientX - bounds.left) / bounds.width) * 100);
  };
  const seekWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const fiveSeconds = durationSeconds > 0 ? (5 / durationSeconds) * 100 : 1;
    const nextPosition = {
      ArrowLeft: playheadPosition - fiveSeconds,
      ArrowDown: playheadPosition - fiveSeconds,
      ArrowRight: playheadPosition + fiveSeconds,
      ArrowUp: playheadPosition + fiveSeconds,
      PageDown: playheadPosition - 10,
      PageUp: playheadPosition + 10,
      Home: 0,
      End: 100,
    }[event.key];
    if (nextPosition === undefined) return;
    event.preventDefault();
    seekTo(nextPosition);
  };

  return (
    <section
      className={`timeline-drawer ${visible ? "timeline-drawer--visible" : ""} ${expanded ? "timeline-drawer--expanded" : ""}`}
      aria-hidden={!visible}
      aria-label="Instrument timeline"
      inert={!visible}
    >
      <header className="timeline-toolbar">
        <nav aria-label="Audio analysis views">
          {tabs.map((tab) => <button className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)} aria-pressed={activeTab === tab} key={tab}>{tab}</button>)}
        </nav>
        <div className="timeline-zoom">
          <ZoomOut aria-hidden="true" /><input type="range" min="100" max="200" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label="Timeline zoom" /><ZoomIn aria-hidden="true" />
          <button className="timeline-expand" onClick={() => setExpanded((value) => !value)} title={expanded ? "Exit full screen" : "Expand timeline"}>{expanded ? <Minimize2 /> : <Maximize2 />}</button>
        </div>
      </header>

      <div className="timeline-scroll">
        <div className="timeline-scroll__inner" style={{ width: `${zoom}%` }}>
          <div className={`overview-waveform ${waveform.status === "loading" ? "overview-waveform--loading" : ""}`}>
            {waveform.status === "ready" && (
              <div
                className="overview-waveform__seek"
                onClick={seekFromWaveform}
                onKeyDown={seekWithKeyboard}
                role="slider"
                tabIndex={0}
                aria-label={`Seek in ${track.title}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(playheadPosition)}
                aria-valuetext={`${formatTime((playheadPosition / 100) * durationSeconds)} of ${formatTime(durationSeconds)}`}
              >
                <svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
                  <path className="overview-waveform__shape" d={waveformPath} />
                </svg>
              </div>
            )}
            {waveform.status === "loading" && <div className="overview-waveform__status" role="status">Reading audio waveform…</div>}
            {waveform.status === "idle" && <div className="overview-waveform__status">Select a local track to display its waveform.</div>}
            {waveform.status === "error" && <div className="overview-waveform__status overview-waveform__status--error" role="alert"><span>{waveform.error}</span><button type="button" onClick={waveform.retry}>Retry</button></div>}
            <div className="timeline-playhead" style={{ left: `${playheadPosition}%` }} aria-hidden="true"><i /></div>
          </div>
          <div className="timeline-ruler" aria-label={`Track duration ${formatTime(durationSeconds)}`}>
            <div className="timeline-ruler__inner">
              {timeMarkers.map((marker, index) => <span className={index === 0 ? "timeline-ruler__mark--start" : index === timeMarkers.length - 1 ? "timeline-ruler__mark--end" : ""} style={{ left: `${marker.position}%` }} key={marker.seconds}>{formatTime(marker.seconds)}</span>)}
            </div>
          </div>
          <div className="instrument-map">
            {(analysis.status === "loading" || analysis.status === "analyzing") && (
              <div className="instrument-map__status" role="status">
                <span className="instrument-map__spinner" aria-hidden="true" />
                <b>{analysis.status === "analyzing" ? "Detecting instruments across the track…" : "Loading saved analysis…"}</b>
                {analysis.status === "analyzing" && <small>Long tracks can take a moment. Playback can continue while analysis runs.</small>}
              </div>
            )}
            {analysis.status === "idle" && (
              <div className="instrument-map__status">
                <b>No instrument analysis yet</b>
                <small>Scan the complete track to map where each instrument is active.</small>
                <button type="button" onClick={() => void runAnalysis()} disabled={!track.path}>Analyze track</button>
              </div>
            )}
            {analysis.status === "error" && (
              <div className="instrument-map__status instrument-map__status--error" role="alert">
                <b>Instrument analysis could not finish</b>
                <small>{analysis.error}</small>
                <button type="button" onClick={() => void runAnalysis()}>Try again</button>
              </div>
            )}
            {analysis.status === "ready" && instrumentRows.length === 0 && (
              <div className="instrument-map__status"><b>No supported instruments were detected</b><small>The track was analyzed successfully, but no result crossed the current detection threshold.</small></div>
            )}
            {analysis.status === "ready" && instrumentRows.map((instrument) => (
              <div className="instrument-row" key={instrument.instrument}>
                <div className="instrument-row__label"><i style={{ background: instrument.color }} /><span>{instrument.instrument}</span></div>
                <div className="instrument-row__lane">
                  {instrument.segments.map((segment, index) => {
                    const left = durationSeconds > 0 ? (segment.startSeconds / durationSeconds) * 100 : 0;
                    const width = durationSeconds > 0 ? ((segment.endSeconds - segment.startSeconds) / durationSeconds) * 100 : 0;
                    return <i className="instrument-segment" title={`${formatTime(segment.startSeconds)}–${formatTime(segment.endSeconds)}`} style={{ left: `${left}%`, width: `${width}%`, background: instrument.color, boxShadow: `0 0 8px ${instrument.color}55` }} key={`${segment.startSeconds}-${index}`} />;
                  })}
                  <div className="timeline-playhead timeline-playhead--lane" style={{ left: `${playheadPosition}%` }} aria-hidden="true" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
