import { releaseCredit } from "../../lib/catalogue";
import { t } from "../../lib/i18n";
import type { Release } from "../../lib/data";
import { Cover } from "../Artwork";

/**
 * The sharp square cover, sitting in front of its own blurred self. Almost
 * undecorated on purpose — the artwork is the decoration.
 */
export default function ReleaseArtwork({
  release,
}: {
  release: Release;
}): React.ReactElement {
  const label = `${t("rel.artworkFor")} ${release.title} — ${releaseCredit(release)}`;

  return (
    <div className="sleeve">
      {release.cover ? (
        <img
          className="sleeve__img"
          src={release.cover}
          alt={label}
          loading="lazy"
          decoding="async"
          width={500}
          height={500}
        />
      ) : (
        // A canvas cannot carry alt text, so the role sits on the wrapper.
        <div className="sleeve__img" role="img" aria-label={label}>
          <Cover
            seed={release.seed}
            hue={release.hue}
            size={460}
            fill
            className="sleeve__canvas"
          />
        </div>
      )}
      <span className="sleeve__edge" aria-hidden="true" />
    </div>
  );
}
