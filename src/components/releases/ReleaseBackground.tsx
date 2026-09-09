import { useEffect, useRef } from "react";
import { renderCover } from "../../lib/artwork";
import type { Release } from "../../lib/data";
import { releaseCredit } from "../../lib/catalogue";
import { t } from "../../lib/i18n";

/**
 * The environment.
 *
 * Three tiers, in order of preference:
 *   1. dedicated wide artwork, scaled slightly and scrimmed
 *   2. the square cover, blown up and blurred into an atmosphere
 *   3. a gradient built from the release hue, when there is no image at all
 *
 * Tier 2 is the one that matters: most releases will never have desktop art,
 * and the section only works if those still look deliberate rather than
 * unfinished.
 */
export default function ReleaseBackground({
  release,
  active,
}: {
  release: Release;
  active: boolean;
}): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const generated = !release.cover;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !generated) return;
    // Small render: it is about to be blurred into a wash, so resolution
    // here would be paid for and then thrown away.
    const source = renderCover(release.seed, release.hue, 320);
    canvas.width = source.width;
    canvas.height = source.height;
    canvas.getContext("2d")!.drawImage(source, 0, 0);
  }, [release.seed, release.hue, generated]);

  const artist = releaseCredit(release);

  return (
    <div
      className={`env env--cover${active ? " env--active" : ""}`}
      style={{ "--hue": release.hue } as React.CSSProperties}
      aria-hidden="true"
    >
      {release.cover ? (
        <img
          className="env__art"
          src={release.cover}
          alt=""
          loading="lazy"
          decoding="async"
        />
      ) : (
        <canvas className="env__art" ref={canvasRef} />
      )}

      {/* Tier 3 lives underneath the others too: it keeps the scene coloured
          while a lazy image is still arriving. */}
      <div className="env__glow" />
      <div className="env__scrim" />
      <span className="sr">{`${t("rel.artworkFor")} ${release.title} — ${artist}`}</span>
    </div>
  );
}
