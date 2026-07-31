import { AudioLines, ListMusic, Plus, Trash2, X } from "lucide-react";
import { Cover } from "../../components/Cover";
import type { PlaylistSummary } from "../../services/playlist-api";
import type { Track } from "../../types/music";

type PlaylistsPageProps = {
  activePlaylist: PlaylistSummary | undefined;
  playlistTracks: Track[];
  availableTracks: Track[];
  selected: Track;
  isPlaying: boolean;
  trackToAdd: string;
  onDelete: () => void;
  onTrackToAddChange: (id: string) => void;
  onAddTrack: () => void;
  onRemoveTrack: (id: number) => void;
  onChooseTrack: (track: Track) => void;
};

export function PlaylistsPage({
  activePlaylist,
  playlistTracks,
  availableTracks,
  selected,
  isPlaying,
  trackToAdd,
  onDelete,
  onTrackToAddChange,
  onAddTrack,
  onRemoveTrack,
  onChooseTrack,
}: PlaylistsPageProps) {
  return (
    <section className="library-panel playlist-page">
      <div className="playlist-detail">
        {activePlaylist ? (
          <>
            <div className="playlist-detail__header">
              <span className="playlist-detail__art"><ListMusic /></span>
              <span><small>PLAYLIST</small><h2>{activePlaylist.name}</h2><p>{activePlaylist.trackCount} {activePlaylist.trackCount === 1 ? "track" : "tracks"} · {Math.round(activePlaylist.durationSeconds / 60)} minutes</p></span>
              <button className="danger-button" onClick={onDelete} title="Delete playlist"><Trash2 /></button>
            </div>

            <div className="playlist-add">
              <select value={trackToAdd} onChange={(event) => onTrackToAddChange(event.target.value)} disabled={availableTracks.length === 0}>
                <option value="">{availableTracks.length ? "Choose a track from your library" : "All library tracks are already added"}</option>
                {availableTracks.map((track) => <option value={track.id} key={track.id}>{track.title} — {track.artist}</option>)}
              </select>
              <button onClick={onAddTrack} disabled={!trackToAdd}><Plus /> Add track</button>
            </div>

            <div className="playlist-track-list">
              {playlistTracks.map((track, index) => (
                <div className={`playlist-track ${selected.id === track.id ? "active" : ""}`} key={track.id}>
                  <button className="playlist-track__play" onClick={() => onChooseTrack(track)}>
                    <span>{selected.id === track.id && isPlaying ? <AudioLines /> : index + 1}</span>
                    <Cover track={track} compact />
                    <span><b>{track.title}</b><small>{track.artist}</small></span>
                    <em>{track.duration}</em>
                  </button>
                  <button className="playlist-track__remove" onClick={() => onRemoveTrack(track.id)} title="Remove from playlist"><X /></button>
                </div>
              ))}
              {playlistTracks.length === 0 && <div className="empty-state">This playlist is empty. Add a track from your library above.</div>}
            </div>
          </>
        ) : (
          <div className="playlist-detail__empty"><ListMusic /><h2>No playlist selected</h2><p>Select a playlist from the sidebar or create a new one next to Settings.</p></div>
        )}
      </div>
    </section>
  );
}
