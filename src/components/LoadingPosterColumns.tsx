import type { CSSProperties } from 'react';
import { LOADING_POSTER_COLUMNS, type LoadingPoster } from '@/lib/loading-posters';

type PosterStyle = CSSProperties & { '--poster-image': string; '--poster-tilt': string };
type ColumnStyle = CSSProperties & {
  '--column-duration': string;
  '--column-delay': string;
  '--column-opacity': number;
  '--column-tilt': string;
};

function PosterGroup({ posters, duplicate = false }: { posters: LoadingPoster[]; duplicate?: boolean }) {
  return (
    <div className="cv-poster-group" aria-hidden={duplicate || undefined}>
      {posters.map((poster, index) => {
        const style = {
          '--poster-image': `url("${poster.url}")`,
          '--poster-tilt': `${poster.tilt}deg`,
        } as PosterStyle;

        return <span className="cv-column-poster" style={style} key={`${poster.title}-${index}`} />;
      })}
    </div>
  );
}

/**
 * Pure server-rendered poster wall. Each column contains two identical groups; translating exactly one group length
 * makes the edge-to-edge loop seamless without timers, client state, or hydration work.
 */
export default function LoadingPosterColumns() {
  return (
    <div className="cv-loading__posters" aria-hidden="true">
      {LOADING_POSTER_COLUMNS.map((column) => {
        const style = {
          '--column-duration': `${column.duration}s`,
          '--column-delay': `${column.delay}s`,
          '--column-opacity': column.opacity,
          '--column-tilt': `${column.tilt}deg`,
        } as ColumnStyle;

        return (
          <div
            className={`cv-poster-column cv-poster-column--${column.side} cv-poster-column--${column.position} cv-poster-column--tier-${column.tier}`}
            style={style}
            key={column.id}
          >
            <div className={`cv-poster-track cv-poster-track--${column.direction}`}>
              <PosterGroup posters={column.posters} />
              <PosterGroup posters={column.posters} duplicate />
            </div>
          </div>
        );
      })}
    </div>
  );
}
