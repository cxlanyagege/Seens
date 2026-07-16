export function InstrumentTimeline({ progress }: { progress: number }) {
  return (
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
  );
}

