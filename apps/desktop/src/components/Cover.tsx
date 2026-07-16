import { Disc3 } from "lucide-react";
import type { CSSProperties } from "react";
import type { Track } from "../types/music";

type CoverProps = {
  track: Track;
  compact?: boolean;
};

export function Cover({ track, compact = false }: CoverProps) {
  return (
    <div className={`cover ${compact ? "cover--compact" : ""}`} style={{ "--cover": track.color } as CSSProperties}>
      {track.coverDataUrl && <img className="cover__image" src={track.coverDataUrl} alt="" />}
      <div className="cover__orb" />
      <Disc3 aria-hidden="true" />
    </div>
  );
}

