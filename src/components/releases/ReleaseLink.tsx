import type { Release } from "../../lib/data";
import { t } from "../../lib/i18n";

/** Names the destination when we can recognise it, so the link is not a shrug. */
function destination(url: string): string {
  if (url.includes("bandcamp.com")) return "Bandcamp";
  if (url.includes("soundcloud.com")) return "SoundCloud";
  if (url.includes("spotify.com")) return "Spotify";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "YouTube";
  return "";
}

/**
 * The one external action. Whoever hosts the record owns the tracklist, the
 * playback and the buying; this site's job is to hand the visitor over at the
 * right moment.
 *
 * With no URL set the control is absent rather than dead: a link that goes
 * nowhere is worse than a visible gap, and the gap is a prompt to fill it in.
 */
export default function ReleaseLink({
  release,
}: {
  release: Release;
}): React.ReactElement {
  if (!release.link) {
    return (
      <p className="bandcamp bandcamp--unset">
        <span className="hud">{t("rel.linkUnset")}</span>
      </p>
    );
  }

  const host = destination(release.link);

  return (
    <a
      className="bandcamp"
      href={release.link}
      target="_blank"
      rel="noopener noreferrer"
      data-cursor="external_link"
    >
      <span className="bandcamp__label">
        {host ? `${t("rel.openOn")} ${host}` : t("rel.open")}
      </span>
      <span className="bandcamp__arrows" aria-hidden="true">
        <span className="bandcamp__out">↗</span>
        <span className="bandcamp__in">→</span>
      </span>
      <span className="bandcamp__note" aria-hidden="true">
        External connection{host ? ` → ${host}` : ""}
      </span>
    </a>
  );
}
