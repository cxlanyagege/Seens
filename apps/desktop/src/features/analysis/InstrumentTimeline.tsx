import { Maximize2, Minimize2, ZoomIn, ZoomOut } from "lucide-react";
import { useState } from "react";

type InstrumentTimelineProps = {
  progress: number;
  visible: boolean;
};

const tabs = ["Overview", "Waveform", "Spectrum", "Chords", "Beat"];
const timeLabels = ["0:00", "0:30", "1:00", "1:30", "2:00", "2:30", "3:00", "3:30", "4:00", "4:21"];
// Placeholder analysis data keeps the timeline useful until the analysis engine
// starts supplying waveform samples and instrument regions for the active track.
const waveform = Array.from({ length: 240 }, (_, index) => {
  const envelope = Math.sin((index / 239) * Math.PI) ** .35;
  const detail = Math.abs(Math.sin(index * .53) * .55 + Math.sin(index * 1.71) * .27 + Math.cos(index * .11) * .18);
  return 5 + envelope * detail * 72;
});

const instruments = [
  { name: "Piano", color: "#d8f53d", segments: [[0, 6], [7, 9], [10, 18], [20, 8], [29, 9], [40, 8], [49, 13], [63, 8], [72, 17], [91, 9]] },
  { name: "Drums", color: "#f06c48", segments: [[0, 8], [10, 20], [32, 5], [39, 18], [60, 15], [76, 4], [82, 4], [89, 8], [98, 2]] },
  { name: "Strings", color: "#a33bd2", segments: [[0, 1], [4, 1], [10, 13], [26, 11], [43, 5], [50, 8], [63, 10], [77, 6], [85, 9], [96, 3]] },
  { name: "Pad", color: "#4ac69a", segments: [[7, 3], [22, 13], [48, 3], [58, 16], [76, 2], [84, 1], [90, 1], [94, 6]] },
  { name: "Bass", color: "#2787d5", segments: [[0, 15], [16, 16], [39, 5], [46, 7], [55, 6], [63, 10], [77, 4], [83, 7], [92, 7]] },
];

export function InstrumentTimeline({ progress, visible }: InstrumentTimelineProps) {
  const [activeTab, setActiveTab] = useState("Overview");
  const [zoom, setZoom] = useState(100);
  const [expanded, setExpanded] = useState(false);
  const playheadPosition = Math.min(100, Math.max(0, progress));

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
          <div className="overview-waveform">
            <svg viewBox="0 0 960 100" preserveAspectRatio="none" aria-label="Track waveform">
              {waveform.map((height, index) => <line x1={index * 4 + 2} x2={index * 4 + 2} y1={50 - height / 2} y2={50 + height / 2} key={index} />)}
            </svg>
            <div className="timeline-playhead" style={{ left: `${playheadPosition}%` }} aria-hidden="true"><i /></div>
          </div>
          <div className="timeline-ruler">{timeLabels.map((time) => <span key={time}>{time}</span>)}</div>
          <div className="instrument-map">
            {instruments.map((instrument) => (
              <div className="instrument-row" key={instrument.name}>
                <div className="instrument-row__label"><i style={{ background: instrument.color }} /><span>{instrument.name}</span></div>
                <div className="instrument-row__lane">
                  {instrument.segments.map(([left, width], index) => <i className="instrument-segment" style={{ left: `${left}%`, width: `${width}%`, background: instrument.color, boxShadow: `0 0 8px ${instrument.color}55` }} key={index} />)}
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
