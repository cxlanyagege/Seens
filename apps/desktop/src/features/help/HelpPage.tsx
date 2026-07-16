import { FolderPlus, ListMusic, Play, Search, SlidersHorizontal } from "lucide-react";

const guides = [
  { icon: FolderPlus, title: "Import your music", text: "Open Library and select Add music. Choose a supported local audio file to save it to your library and begin playback." },
  { icon: Play, title: "Control playback", text: "Use the player bar to play or pause, seek through the current track, adjust volume, and move to the previous or next track." },
  { icon: SlidersHorizontal, title: "Browse your library", text: "Switch between Tracks, Albums, and Artists. Use the filter to show all music, analyzed tracks, or tracks waiting for analysis." },
  { icon: ListMusic, title: "Build playlists", text: "Open Playlists, create a named playlist, then choose tracks from your library. Removing a track from a playlist does not delete it from Library." },
  { icon: Search, title: "Find music", text: "Search by track title, artist, or album in the sidebar. Select a suggestion or press Enter to see every matching result." },
];

export function HelpPage() {
  return (
    <section className="library-panel information-page">
      <div className="section-heading">
        <div><span className="eyebrow">GETTING STARTED</span><h1>Help</h1><p>Learn the basics of Seenstruments</p></div>
      </div>
      <div className="help-list">
        {guides.map(({ icon: Icon, title, text }, index) => (
          <article className="help-item" key={title}>
            <span className="help-item__number">{String(index + 1).padStart(2, "0")}</span>
            <span className="information-icon"><Icon /></span>
            <span><h2>{title}</h2><p>{text}</p></span>
          </article>
        ))}
      </div>
    </section>
  );
}

