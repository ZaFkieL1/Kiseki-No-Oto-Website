import { artistByKey, releaseCredit } from "../../lib/catalogue";
import { releaseArtistKeys, releaseMeta, type Release } from "../../lib/data";
import { deck } from "../../lib/audio";
import { t } from "../../lib/i18n";
import { useDeck } from "../../lib/hooks";
import ReleaseLink from "./ReleaseLink";
import { Pause, Play } from "../icons";

/** How many rows stand open before the list starts scrolling. */
const ROWS_OPEN = 5;

/**
 * Metadata, not copy. Everything here answers one of three questions — what
 * is this, who is on it, where do I hear it — and nothing else.
 *
 * The record's own name leads. It used to be `releaseCredit()` up top, which
 * meant a compilation announced itself as `V.A.` — the one credit that names
 * nobody — while the title sat underneath in the small face. The running order
 * carries the acts now, which is where the credits actually live, so a
 * compilation reads as its four names rather than as an abbreviation.
 */
export default function ReleaseInfo({
  release,
}: {
  release: Release;
}): React.ReactElement {
  const { release: loaded, playing, preview } = useDeck();
  /* This record's preview, and running. Every scene has one of these buttons,
     so it has to be this record's — not merely "something is playing". */
  const running = preview && playing && loaded.cat === release.cat;

  /* One act on the record: name it once, above the list. Several: the rows
     name themselves, and repeating a single name down five lines is noise. */
  const shared = releaseArtistKeys(release).length < 2;
  const tracks = release.tracks;

  return (
    <div className="rel__info">
      <span className="hud rel__id">{release.cat}</span>

      <h2 className="rel__artist">{release.title}</h2>
      {shared && <p className="rel__title">{releaseCredit(release)}</p>}

      <p className="rel__meta mono">{releaseMeta(release)}</p>
      <p className="hud rel__date">{release.date}</p>

      {/* Five rows open, the rest behind a scroll — a twelve-track album must
          not push the actions off the scene. `--more` lights the bottom fade
          that says there is further to go. */}
      {tracks.length > 0 && (
        <ol
          className={`rel__list${tracks.length > ROWS_OPEN ? " rel__list--more" : ""}`}
          aria-label={`${t("rel.runningOrder")} — ${release.title}`}
        >
          {tracks.map((song, index) => {
            const cells = (
              <>
                <span className="rel__n mono">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="rel__song">{song.title}</span>
                {!shared && (
                  <span className="rel__by">
                    {artistByKey(song.artist).name}
                  </span>
                )}
                <span className="rel__go" aria-hidden="true">
                  ↗
                </span>
              </>
            );

            /* `audio` is where the song's own link is kept. A row without one
               stays inert rather than becoming a control that goes nowhere —
               the same call the release button makes. */
            return (
              <li className="rel__item" key={`${index}-${song.title}`}>
                {song.audio ? (
                  <a
                    className="rel__row rel__row--open"
                    href={song.audio}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-cursor="open_track"
                  >
                    {cells}
                  </a>
                ) : (
                  <div className="rel__row">{cells}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <div className="rel__actions">
        <ReleaseLink release={release} />

        {/* Only when the record has a preview uploaded — the alternative is a
            play button that plays nothing. It runs the record's own preview,
            never a track: the rows are where a song is opened. */}
        {release.preview && (
          <button
            className="rel__preview"
            onClick={() =>
              running ? deck.pause() : void deck.loadPreview(release)
            }
            data-cursor="audio_module"
          >
            {running ? <Pause /> : <Play />}
            {running ? t("rel.pausePreview") : t("rel.playPreview")}
          </button>
        )}
      </div>
    </div>
  );
}
