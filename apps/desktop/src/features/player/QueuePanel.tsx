import { AudioLines, ListMusic, X } from "lucide-react";
import { Cover } from "../../components/Cover";
import type { Track } from "../../types/music";

type QueuePanelProps = {
  selected: Track;
  tracks: Track[];
  isPlaying: boolean;
  onChooseTrack: (track: Track) => void;
  onClose: () => void;
};

export function QueuePanel({ selected, tracks, isPlaying, onChooseTrack, onClose }: QueuePanelProps) {
  const playableTracks = tracks.filter((track) => track.path);
  const currentIndex = playableTracks.findIndex((track) => track.id === selected.id);
  const upcomingTracks = currentIndex < 0
    ? playableTracks
    : [...playableTracks.slice(currentIndex + 1), ...playableTracks.slice(0, currentIndex)];

  return (
    <aside className="queue-panel utility-panel" aria-label="Current play queue">
      <header className="queue-panel__header">
        <span><ListMusic /> Play queue</span>
        <button onClick={onClose} aria-label="Close play queue" title="Close play queue"><X /></button>
      </header>

      <div className="queue-panel__scroll">
        {selected.path ? (
          <section className="queue-section">
            <div className="queue-section__heading"><span>Now playing</span></div>
            <div className="queue-track queue-track--current">
              <Cover track={selected} compact />
              <span className="queue-track__copy"><b>{selected.title}</b><small>{selected.artist}</small></span>
              <AudioLines className={isPlaying ? "queue-track__playing" : ""} aria-hidden="true" />
            </div>
          </section>
        ) : null}

        <section className="queue-section queue-section--up-next">
          <div className="queue-section__heading">
            <span>Up next</span>
            <small>{upcomingTracks.length} {upcomingTracks.length === 1 ? "track" : "tracks"}</small>
          </div>
          {upcomingTracks.length ? (
            <div className="queue-list">
              {upcomingTracks.map((track, index) => (
                <button className="queue-track" key={track.id} onClick={() => onChooseTrack(track)}>
                  <span className="queue-track__position">{index + 1}</span>
                  <Cover track={track} compact />
                  <span className="queue-track__copy"><b>{track.title}</b><small>{track.artist}</small></span>
                  <small className="queue-track__duration">{track.duration}</small>
                </button>
              ))}
            </div>
          ) : (
            <div className="queue-panel__empty"><ListMusic /><span>Nothing else is queued.</span></div>
          )}
        </section>
      </div>
    </aside>
  );
}
