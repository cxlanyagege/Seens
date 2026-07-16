import { Activity, AudioLines, MoreHorizontal, Music2, Piano, SlidersHorizontal, Sparkles } from "lucide-react";
import { Cover } from "../../components/Cover";
import type { Track } from "../../types/music";

// Placeholder data until the local analysis sidecar supplies real results.
const instruments = [
  { name: "Drums", confidence: 98, color: "#ef765f", icon: Activity },
  { name: "Bass", confidence: 94, color: "#b97cf2", icon: AudioLines },
  { name: "Electric guitar", confidence: 89, color: "#5ca9ef", icon: Music2 },
  { name: "Synthesizer", confidence: 83, color: "#65c99b", icon: SlidersHorizontal },
  { name: "Piano", confidence: 61, color: "#e1b85b", icon: Piano },
];

export function InsightsPanel({ selected }: { selected: Track }) {
  return (
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
  );
}

