import { AudioLines, ChevronDown, DiscAlbum, Music2, Plus, SlidersHorizontal, UserRound } from "lucide-react";
import { Cover } from "../../components/Cover";
import type { AlbumGroup, AnalysisFilter, ArtistGroup, LibraryView, Track } from "../../types/music";

type LibraryPageProps = {
  tracks: Track[];
  filteredTracks: Track[];
  albums: AlbumGroup[];
  artists: ArtistGroup[];
  selected: Track;
  isPlaying: boolean;
  view: LibraryView;
  filter: AnalysisFilter;
  filterOpen: boolean;
  onImport: () => void;
  onChooseTrack: (track: Track) => void;
  onSelectTrack: (track: Track) => void;
  onViewChange: (view: LibraryView) => void;
  onFilterChange: (filter: AnalysisFilter) => void;
  onFilterOpenChange: (open: boolean) => void;
};

const filterLabel = (filter: AnalysisFilter) => filter === "all" ? "All music" : filter[0].toUpperCase() + filter.slice(1);

export function LibraryPage({
  tracks,
  filteredTracks,
  albums,
  artists,
  selected,
  isPlaying,
  view,
  filter,
  filterOpen,
  onImport,
  onChooseTrack,
  onSelectTrack,
  onViewChange,
  onFilterChange,
  onFilterOpenChange,
}: LibraryPageProps) {
  const totalMinutes = Math.round(tracks.reduce((total, track) => total + (track.durationSeconds ?? 0), 0) / 60);
  const filterCount = (candidate: AnalysisFilter) => candidate === "all"
    ? tracks.length
    : tracks.filter((track) => candidate === "analyzed" ? track.analyzed : !track.analyzed).length;

  return (
    <section className="library-panel">
      <div className="section-heading">
        <div><span className="eyebrow">YOUR COLLECTION</span><h1>Music library</h1><p>{tracks.length} tracks · {totalMinutes} minutes</p></div>
        <button className="primary-button" onClick={onImport}><Plus /> Add music</button>
      </div>

      <div className="filter-row">
        <div className="segmented" aria-label="Library classification">
          {(["tracks", "albums", "artists"] as LibraryView[]).map((candidate) => (
            <button className={view === candidate ? "active" : ""} onClick={() => onViewChange(candidate)} key={candidate}>
              {candidate[0].toUpperCase() + candidate.slice(1)}
            </button>
          ))}
        </div>
        <div className="filter-menu">
          <button className={`filter-button ${filter !== "all" ? "filter-button--active" : ""}`} onClick={() => onFilterOpenChange(!filterOpen)} aria-expanded={filterOpen}>
            <SlidersHorizontal /> {filterLabel(filter)} <ChevronDown />
          </button>
          {filterOpen && (
            <div className="filter-menu__popover">
              {(["all", "analyzed", "pending"] as AnalysisFilter[]).map((candidate) => (
                <button className={filter === candidate ? "active" : ""} onClick={() => { onFilterChange(candidate); onFilterOpenChange(false); }} key={candidate}>
                  <span>{filterLabel(candidate)}</span><small>{filterCount(candidate)}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {view === "tracks" && (
        <div className="track-list" role="table" aria-label="Music library">
          <TrackHeader />
          {filteredTracks.map((track, index) => <TrackRow track={track} index={index} selected={selected.id === track.id} playing={selected.id === track.id && isPlaying} onChoose={onChooseTrack} key={track.id} />)}
        </div>
      )}

      {view === "albums" && (
        <div className="collection-grid" aria-label="Albums">
          {albums.map((album) => (
            <button className="collection-card" onClick={() => onSelectTrack(album.tracks[0])} key={`${album.name}-${album.artist}`}>
              <Cover track={album.tracks[0]} />
              <span className="collection-card__copy"><b>{album.name}</b><small>{album.artist}</small><em><DiscAlbum /> {album.tracks.length} {album.tracks.length === 1 ? "track" : "tracks"}</em></span>
            </button>
          ))}
        </div>
      )}

      {view === "artists" && (
        <div className="collection-grid collection-grid--artists" aria-label="Artists">
          {artists.map((artist) => (
            <button className="collection-card artist-card" onClick={() => onSelectTrack(artist.tracks[0])} key={artist.name}>
              <div className="artist-card__portrait">{artist.tracks[0].coverDataUrl ? <Cover track={artist.tracks[0]} /> : <UserRound />}</div>
              <span className="collection-card__copy"><b>{artist.name}</b><small>{new Set(artist.tracks.map((track) => track.album)).size} albums</small><em><Music2 /> {artist.tracks.length} {artist.tracks.length === 1 ? "track" : "tracks"}</em></span>
            </button>
          ))}
        </div>
      )}

      {filteredTracks.length === 0 && <div className="empty-state">{tracks.length === 0 ? "Your library is empty. Add a local audio file to get started." : "No music matches this filter."}</div>}
    </section>
  );
}

export function TrackHeader() {
  return <div className="track-row track-row--header" role="row"><span>#</span><span>Title</span><span>Album</span><span>Year</span><span>Analysis</span><span>Time</span></div>;
}

export function TrackRow({ track, index, selected, playing, onChoose }: { track: Track; index: number; selected: boolean; playing: boolean; onChoose: (track: Track) => void }) {
  return (
    <button className={`track-row ${selected ? "track-row--selected" : ""}`} onClick={() => onChoose(track)} role="row">
      <span className="track-index">{playing ? <AudioLines /> : index + 1}</span>
      <span className="track-title"><Cover track={track} compact /><span><b>{track.title}</b><small>{track.artist}</small></span></span>
      <span>{track.album}</span><span>{track.year}</span>
      <span><i className={`status-dot ${track.analyzed ? "status-dot--done" : ""}`} />{track.analyzed ? "Analyzed" : "Pending"}</span>
      <span>{track.duration}</span>
    </button>
  );
}
