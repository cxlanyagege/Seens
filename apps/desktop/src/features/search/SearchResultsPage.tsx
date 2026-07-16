import type { Track } from "../../types/music";
import { TrackHeader, TrackRow } from "../library/LibraryPage";

type SearchResultsPageProps = {
  query: string;
  results: Track[];
  selected: Track;
  isPlaying: boolean;
  onChooseTrack: (track: Track) => void;
};

export function SearchResultsPage({ query, results, selected, isPlaying, onChooseTrack }: SearchResultsPageProps) {
  return (
    <section className="library-panel search-results-page">
      <div className="section-heading">
        <div><span className="eyebrow">LIBRARY SEARCH</span><h1>Search results</h1><p>{results.length} {results.length === 1 ? "result" : "results"} for “{query.trim()}”</p></div>
      </div>
      <div className="search-results-list" role="table" aria-label="Search results">
        <TrackHeader />
        {results.map((track, index) => <TrackRow track={track} index={index} selected={selected.id === track.id} playing={selected.id === track.id && isPlaying} onChoose={onChooseTrack} key={track.id} />)}
        {results.length === 0 && <div className="empty-state">No tracks, artists, or albums match this search.</div>}
      </div>
    </section>
  );
}

