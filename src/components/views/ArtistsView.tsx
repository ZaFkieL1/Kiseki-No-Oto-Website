import { releasesByArtist, roster } from "../../lib/catalogue";
import { t } from "../../lib/i18n";
import { Sigil } from "../Artwork";
import { useCatalogue } from "../../lib/hooks";

/**
 * The roster.
 *
 * **A card is the act's own profile.** Pressing one used to load their newest
 * record into the deck, which was a nice trick and the wrong answer to the
 * gesture: someone tapping a name on a roster page is asking who this is, not
 * asking for a song — songs are what the dock and `02 RELEASES` are for.
 *
 * An act with no `link` keeps the card as a card: information, with nothing to
 * press. The same rule the release button and the stream button follow — a
 * destination the label does not have is a gap, never a dead control.
 */
export default function ArtistsView(): React.ReactElement {
  // Subscribed for the repaint; `roster()` is what decides who is on the list.
  useCatalogue();
  const signed = roster();

  return (
    <div>
      <div className="pane__head">
        <span className="pane__title">{t("art.title")}</span>
        <span className="jp">アーティスト</span>
        <span className="hud pane__count">
          {signed.length} {t("art.count")}
        </span>
      </div>

      <div className="artists">
        {signed.map((artist, index) => {
          const catalogue = releasesByArtist(artist.key);
          const body = (
            <>
              <Sigil seed={artist.name.length * 7919 + index * 104729} />
              <div>
                <span className="hud">
                  ARTIST_{String(index + 1).padStart(4, "0")}
                </span>
                <h2 className="artist__name">{artist.name}</h2>
                {artist.kana && <div className="artist__kana">{artist.kana}</div>}

                {artist.genres.length > 0 && (
                  <div className="tags">
                    {artist.genres.map((genre) => (
                      <span className="tag" key={genre}>
                        {genre}
                      </span>
                    ))}
                  </div>
                )}

                <div className="artist__stats">
                  <div className="field">
                    <span className="hud">{t("art.releases")}</span>
                    <span className="field__v">
                      {String(catalogue.length).padStart(2, "0")}
                    </span>
                  </div>
                  {artist.since && (
                    <div className="field">
                      <span className="hud">{t("art.since")}</span>
                      <span className="field__v">{artist.since}</span>
                    </div>
                  )}
                  <div className="field">
                    <span className="hud">{t("art.status")}</span>
                    <span className="field__v">
                      <i className="dot" />
                      {artist.active ? t("sys.active") : t("sys.dormant")}
                    </span>
                  </div>
                </div>

                {/* Drawn only on a card that goes somewhere, and it names where
                    it goes. A card without it is not a control that failed. */}
                {artist.link && (
                  <span className="artist__go hud">
                    {t("art.profile")} <span aria-hidden="true">↗</span>
                  </span>
                )}
              </div>
            </>
          );

          return artist.link ? (
            <a
              key={artist.key}
              className="artist artist--linked"
              href={artist.link}
              target="_blank"
              rel="noopener noreferrer"
              data-cursor={t("art.profileCursor")}
            >
              {body}
            </a>
          ) : (
            <div key={artist.key} className="artist">
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
