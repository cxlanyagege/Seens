import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, AudioLines, Check, ChevronDown, DiscAlbum, FileAudio, FolderOpen, Library, ListChecks, Minus, Music2, Plus, SlidersHorizontal, Trash2, UserRound, X } from "lucide-react";
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
  onImportFiles: () => void;
  onImportFolder: () => void;
  onRemoveTracks: (ids: number[]) => Promise<boolean>;
  onChooseTrack: (track: Track) => void;
  onSelectTrack: (track: Track) => void;
  onViewChange: (view: LibraryView) => void;
  onFilterChange: (filter: AnalysisFilter) => void;
  onFilterOpenChange: (open: boolean) => void;
};

const filterLabel = (filter: AnalysisFilter) => filter === "all" ? "All music" : filter[0].toUpperCase() + filter.slice(1);
type TrackSortKey = "index" | "title" | "album" | "year" | "analyzed" | "duration";
type SortDirection = "ascending" | "descending";

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
  onImportFiles,
  onImportFolder,
  onRemoveTracks,
  onChooseTrack,
  onSelectTrack,
  onViewChange,
  onFilterChange,
  onFilterOpenChange,
}: LibraryPageProps) {
  const [managing, setManaging] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<number>>(() => new Set());
  const [sortKey, setSortKey] = useState<TrackSortKey>("index");
  const [sortDirection, setSortDirection] = useState<SortDirection>("ascending");
  const totalMinutes = Math.round(tracks.reduce((total, track) => total + (track.durationSeconds ?? 0), 0) / 60);
  const filterCount = (candidate: AnalysisFilter) => candidate === "all"
    ? tracks.length
    : tracks.filter((track) => candidate === "analyzed" ? track.analyzed : !track.analyzed).length;
  const trackPositions = useMemo(() => new Map(tracks.map((track, index) => [track.id, index])), [tracks]);
  const visibleTracks = useMemo(() => {
    const direction = sortDirection === "ascending" ? 1 : -1;
    return [...filteredTracks].sort((left, right) => {
      let comparison = 0;
      if (sortKey === "index") comparison = (trackPositions.get(left.id) ?? 0) - (trackPositions.get(right.id) ?? 0);
      if (sortKey === "title") comparison = left.title.localeCompare(right.title, undefined, { numeric: true, sensitivity: "base" });
      if (sortKey === "album") comparison = left.album.localeCompare(right.album, undefined, { numeric: true, sensitivity: "base" });
      if (sortKey === "year") comparison = left.year.localeCompare(right.year, undefined, { numeric: true });
      if (sortKey === "analyzed") comparison = Number(left.analyzed) - Number(right.analyzed);
      if (sortKey === "duration") comparison = (left.durationSeconds ?? 0) - (right.durationSeconds ?? 0);
      if (comparison === 0) comparison = (trackPositions.get(left.id) ?? 0) - (trackPositions.get(right.id) ?? 0);
      return comparison * direction;
    });
  }, [filteredTracks, sortDirection, sortKey, trackPositions]);
  const allVisibleSelected = visibleTracks.length > 0 && visibleTracks.every((track) => selectedTrackIds.has(track.id));
  const someVisibleSelected = visibleTracks.some((track) => selectedTrackIds.has(track.id));

  const toggleManaging = () => {
    if (!managing && view !== "tracks") onViewChange("tracks");
    if (managing) setSelectedTrackIds(new Set());
    setManaging((current) => !current);
  };

  const changeView = (nextView: LibraryView) => {
    if (nextView !== "tracks") {
      setManaging(false);
      setSelectedTrackIds(new Set());
    }
    onViewChange(nextView);
  };

  const toggleTrack = (id: number) => {
    setSelectedTrackIds((current) => {
      const updated = new Set(current);
      if (updated.has(id)) updated.delete(id);
      else updated.add(id);
      return updated;
    });
  };

  const toggleAllVisible = () => {
    setSelectedTrackIds((current) => {
      const updated = new Set(current);
      visibleTracks.forEach((track) => {
        if (allVisibleSelected) updated.delete(track.id);
        else updated.add(track.id);
      });
      return updated;
    });
  };

  const changeSort = (key: TrackSortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => current === "ascending" ? "descending" : "ascending");
      return;
    }
    setSortKey(key);
    setSortDirection("ascending");
  };

  const removeSelected = async () => {
    if (!selectedTrackIds.size || removing) return;
    setRemoving(true);
    const removed = await onRemoveTracks([...selectedTrackIds]);
    if (removed) setSelectedTrackIds(new Set());
    setRemoving(false);
  };

  if (tracks.length === 0) {
    return (
      <section className="library-panel library-panel--empty">
        <div className="library-empty">
          <span className="library-empty__icon"><Library /></span>
          <h1>Your library is empty</h1>
          <p>Add local audio files to start building your music library.</p>
          <ImportMusicButton onImportFiles={onImportFiles} onImportFolder={onImportFolder} />
        </div>
      </section>
    );
  }

  return (
    <section className="library-panel">
      <div className="section-heading">
        <div><span className="eyebrow">YOUR COLLECTION</span><h1>Music library</h1><p>{tracks.length} tracks · {totalMinutes} minutes</p></div>
        <div className="section-heading__actions">
          <button className={`secondary-button ${managing ? "secondary-button--active" : ""}`} onClick={toggleManaging} disabled={tracks.length === 0}>{managing ? <X /> : <ListChecks />} {managing ? "Done" : "Manage"}</button>
          <ImportMusicButton onImportFiles={onImportFiles} onImportFolder={onImportFolder} />
        </div>
      </div>

      <div className="filter-row">
        <div className="segmented" aria-label="Library classification">
          {(["tracks", "albums", "artists"] as LibraryView[]).map((candidate) => (
            <button className={view === candidate ? "active" : ""} onClick={() => changeView(candidate)} key={candidate}>
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

      {managing && (
        <div className="library-management-bar">
          <span><b>{selectedTrackIds.size}</b> selected</span>
          <button className="library-management-bar__remove" onClick={() => void removeSelected()} disabled={selectedTrackIds.size === 0 || removing}>
            <Trash2 /> {removing ? "Removing…" : "Remove from library"}
          </button>
        </div>
      )}

      {view === "tracks" && (
        <div className="track-list" role="table" aria-label="Music library">
          <TrackHeader
            managing={managing}
            allSelected={allVisibleSelected}
            someSelected={someVisibleSelected}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onToggleAll={toggleAllVisible}
            onSort={changeSort}
          />
          {visibleTracks.map((track) => (
            <TrackRow
              track={track}
              index={trackPositions.get(track.id) ?? 0}
              selected={selected.id === track.id}
              checked={selectedTrackIds.has(track.id)}
              managing={managing}
              playing={selected.id === track.id && isPlaying}
              onChoose={onChooseTrack}
              onToggle={toggleTrack}
              key={track.id}
            />
          ))}
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

      {filteredTracks.length === 0 && <div className="empty-state">No music matches this filter.</div>}
    </section>
  );
}

function ImportMusicButton({ onImportFiles, onImportFolder }: { onImportFiles: () => void; onImportFolder: () => void }) {
  const [open, setOpen] = useState(false);
  const choose = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className="import-menu" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
    }}>
      <button className="primary-button import-menu__trigger" onClick={() => setOpen((current) => !current)} aria-haspopup="menu" aria-expanded={open}>
        <Plus /> Add music <ChevronDown />
      </button>
      {open && (
        <div className="import-menu__popover" role="menu">
          <button onClick={() => choose(onImportFiles)} role="menuitem">
            <FileAudio /><span><b>Audio files</b><small>Select one or more files</small></span>
          </button>
          <button onClick={() => choose(onImportFolder)} role="menuitem">
            <FolderOpen /><span><b>Folder</b><small>Import supported audio recursively</small></span>
          </button>
        </div>
      )}
    </div>
  );
}

export function TrackHeader({
  managing = false,
  allSelected = false,
  someSelected = false,
  sortKey,
  sortDirection = "ascending",
  onToggleAll,
  onSort,
}: {
  managing?: boolean;
  allSelected?: boolean;
  someSelected?: boolean;
  sortKey?: TrackSortKey;
  sortDirection?: SortDirection;
  onToggleAll?: () => void;
  onSort?: (key: TrackSortKey) => void;
}) {
  return (
    <div className="track-row track-row--header" role="row">
      {managing
        ? <button className={`track-checkbox ${allSelected || someSelected ? "active" : ""}`} onClick={onToggleAll} aria-label={allSelected ? "Deselect all visible tracks" : "Select all visible tracks"}>{someSelected && !allSelected ? <Minus /> : <Check />}</button>
        : <SortHeader label="#" column="index" activeColumn={sortKey} direction={sortDirection} onSort={onSort} />}
      <SortHeader label="Title" column="title" activeColumn={sortKey} direction={sortDirection} onSort={onSort} />
      <SortHeader label="Album" column="album" activeColumn={sortKey} direction={sortDirection} onSort={onSort} />
      <SortHeader label="Year" column="year" activeColumn={sortKey} direction={sortDirection} onSort={onSort} />
      <SortHeader label="Analysis" column="analyzed" activeColumn={sortKey} direction={sortDirection} onSort={onSort} />
      <SortHeader label="Time" column="duration" activeColumn={sortKey} direction={sortDirection} onSort={onSort} />
    </div>
  );
}

function SortHeader({ label, column, activeColumn, direction, onSort }: { label: string; column: TrackSortKey; activeColumn?: TrackSortKey; direction: SortDirection; onSort?: (key: TrackSortKey) => void }) {
  if (!onSort) return <span>{label}</span>;
  const active = activeColumn === column;
  return (
    <button className={`track-sort-button ${active ? "active" : ""}`} onClick={() => onSort(column)} aria-label={`Sort by ${label}`} aria-pressed={active}>
      <span>{label}</span>
      {active && (direction === "ascending" ? <ArrowUp /> : <ArrowDown />)}
    </button>
  );
}

export function TrackRow({ track, index, selected, checked = false, managing = false, playing, onChoose, onToggle }: { track: Track; index: number; selected: boolean; checked?: boolean; managing?: boolean; playing: boolean; onChoose: (track: Track) => void; onToggle?: (id: number) => void }) {
  return (
    <button
      className={`track-row ${selected ? "track-row--selected" : ""} ${checked ? "track-row--checked" : ""}`}
      onClick={() => managing ? onToggle?.(track.id) : onChoose(track)}
      aria-label={managing ? `${checked ? "Deselect" : "Select"} ${track.title}` : undefined}
      aria-pressed={managing ? checked : undefined}
      role="row"
    >
      <span className="track-index">{managing ? <i className={`track-checkbox ${checked ? "active" : ""}`}><Check /></i> : playing ? <AudioLines /> : index + 1}</span>
      <span className="track-title"><Cover track={track} compact /><span><b>{track.title}</b><small>{track.artist}</small></span></span>
      <span>{track.album}</span><span>{track.year}</span>
      <span><i className={`status-dot ${track.analyzed ? "status-dot--done" : ""}`} />{track.analyzed ? "Analyzed" : "Pending"}</span>
      <span>{track.duration}</span>
    </button>
  );
}
