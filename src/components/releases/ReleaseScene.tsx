import type { Release } from "../../lib/data";
import ReleaseArtwork from "./ReleaseArtwork";
import ReleaseBackground from "./ReleaseBackground";
import ReleaseInfo from "./ReleaseInfo";

/**
 * One release, one viewport. The layout alternates side to side down the
 * catalogue so scrolling reads as a sequence of spreads rather than a
 * repeated template — and so nothing lands dead centre.
 *
 * `near` gates all the heavy artwork. A scene that is nowhere near the
 * viewport renders as an empty coloured box.
 */
export default function ReleaseScene({
  release,
  index,
  active,
  near,
}: {
  release: Release;
  index: number;
  active: boolean;
  near: boolean;
}): React.ReactElement {
  return (
    <section
      className={`scene${index % 2 === 1 ? " scene--flip" : ""}`}
      data-index={index}
      style={{ "--hue": release.hue } as React.CSSProperties}
      aria-label={`${release.cat} — ${release.title}`}
    >
      {near ? (
        <ReleaseBackground release={release} active={active} />
      ) : (
        <div className="env env--holding" aria-hidden="true" />
      )}

      <div className="scene__inner">
        <div className="scene__art">{near && <ReleaseArtwork release={release} />}</div>
        <div className="scene__info">
          <ReleaseInfo release={release} />
        </div>
      </div>
    </section>
  );
}
