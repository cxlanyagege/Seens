import { AudioLines, FolderPlus, ListMusic, Plus, Trash2, X } from "lucide-react";
import { Cover } from "../../components/Cover";
import type { PlaylistSummary } from "../../services/playlist-api";
import type { Track } from "../../types/music";

type PlaylistsPageProps = {
  playlists: PlaylistSummary[];
  activePlaylist: PlaylistSummary | undefined;
  playlistTracks: Track[];
  availableTracks: Track[];
  selected: Track;
  isPlaying: boolean;
  trackToAdd: string;
  onCreate: () => void;
  onSelectPlaylist: (id: number) => void;
  onDelete: () => void;
  onTrackToAddChange: (id: string) => void;
  onAddTrack: () => void;
  onRemoveTrack: (id: number) => void;
  onChooseTrack: (track: Track) => void;
};

export function PlaylistsPage({
  playlists,
  activePlaylist,
  playlistTracks,
  availableTracks,
  selected,
  isPlaying,
  trackToAdd,
  onCreate,
  onSelectPlaylist,
  onDelete,
  onTrackToAddChange,
  onAddTrack,
  onRemoveTrack,
  onChooseTrack,
}: PlaylistsPageProps) {
  return (
    <section className="library-panel playlist-page">
      <div className="section-heading">
        <div><span className="eyebrow">YOUR COLLECTION</span><h1>Playlists</h1><p>{playlists.length} custom {playlists.length === 1 ? "playlist" : "playlists"}</p></div>
        <button className="primary-button" onClick={onCreate}><FolderPlus /> New playlist</button>
      </div>

      <div className="playlist-layout">
        <aside className="playlist-index">
          <div className="playlist-index__heading"><span>Your playlists</span><small>{playlists.length}</small></div>
          {playlists.map((playlist) => (
            <button className={`playlist-index__item ${activePlaylist?.id === playlist.id ? "active" : ""}`} onClick={() => onSelectPlaylist(playlist.id)} key={playlist.id}>
              <span className="playlist-index__icon"><ListMusic /></span>
              <span><b>{playlist.name}</b><small>{playlist.trackCount} {playlist.trackCount === 1 ? "track" : "tracks"}</small></span>
            </button>
          ))}
          {playlists.length === 0 && <div className="playlist-index__empty">Create your first playlist to organize tracks.</div>}
        </aside>

        <div className="playlist-detail">
          {activePlaylist ? (
            <>
              <div className="playlist-detail__header">
                <span className="playlist-detail__art"><ListMusic /></span>
                <span><small>PLAYLIST</small><h2>{activePlaylist.name}</h2><p>{activePlaylist.trackCount} tracks · {Math.round(activePlaylist.durationSeconds / 60)} minutes</p></span>
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
            <div className="playlist-detail__empty"><ListMusic /><h2>No playlist selected</h2><p>Use New playlist in the upper-right corner to start building your collection.</p></div>
          )}
        </div>
      </div>
    </section>
  );
}

