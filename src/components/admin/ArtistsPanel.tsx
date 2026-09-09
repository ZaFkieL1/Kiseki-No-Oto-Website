import type { Artist } from "../../lib/data";
import { store } from "../../lib/store";
import { uniqueKey } from "../../lib/store/rules";
import { validateArtist } from "../../lib/store/validate";
import { useCatalogue } from "../../lib/hooks";
import { SaveBar, TextField, ToggleField } from "./Fields";
import { useEditor } from "./useEditor";

function blankArtist(): Artist {
  return {
    key: "",
    name: "",
    kana: "",
    genres: [],
    since: String(new Date().getFullYear()),
    active: true,
    guest: false,
    link: undefined,
  };
}

/**
 * The roster.
 *
 * Everyone credited on a song has an entry here, including acts added in
 * passing from a tracklist — a track cannot credit what does not exist. What
 * `Guest` decides is whether the entry is *the label's*: a guest is filed,
 * credited and linkable, but kept out of the public artist database and out of
 * the counts that describe it. The rule itself lives in `roster()`.
 *
 * The key is never typed. It is minted from the name when the artist is
 * created and frozen from then on: it is what every track credits, so renaming
 * an act must not move it.
 *
 * Deleting an artist with releases is refused by the store; the panel shows the
 * dependency count up front so the refusal is never a surprise.
 */
export default function ArtistsPanel(): React.ReactElement {
  const { artists, releases } = useCatalogue();
  const editor = useEditor<Artist>();
  const { draft, errors, update } = editor;

  const saved = draft !== null && artists.some((a) => a.key === draft.key);
  const others = artists.filter((a) => a.key !== draft?.key);
  const dependents = draft
    ? releases.filter((release) =>
        release.tracks.some((track) => track.artist === draft.key)
      ).length
    : 0;

  /** Frozen once it exists; minted from the name while it does not. */
  const withKey = (value: Artist): Artist =>
    saved ? value : { ...value, key: uniqueKey(value.name, artists) };

  const onSave = (): void =>
    void editor.save(
      (value) => validateArtist(withKey(value), others),
      (value) => store.saveArtist(withKey(value))
    );

  const onDelete = (): void => {
    if (!draft) return;
    if (!window.confirm(`Delete ${draft.name}? This cannot be undone.`)) return;
    void editor.save(
      () => ({}),
      async (value) => {
        await store.removeArtist(value.key);
        editor.reset();
      }
    );
  };

  return (
    <>
      <div className="kern__list">
        <div className="kern__listhead">
          <span className="pane__title">Artists</span>
          <button className="kern__new" onClick={() => editor.select(blankArtist())}>
            + New
          </button>
        </div>

        {artists.map((artist) => (
          <button
            className="kern__row"
            key={artist.key}
            aria-current={artist.key === draft?.key}
            onClick={() =>
              editor.select({ ...artist, genres: [...artist.genres] })
            }
          >
            <span className="mono">{artist.active ? "ACTIVE" : "DORMANT"}</span>
            <span className="kern__rowname">{artist.name}</span>
            {/* Whether the entry is public is the one thing the list cannot
                make you open the record to find out. */}
            {artist.guest && (
              <span className="mono kern__rowstate">GUEST</span>
            )}
          </button>
        ))}
      </div>

      {draft === null ? (
        <div className="kern__blank">
          <p className="hud">No artist selected.</p>
          <button className="playcta" onClick={() => editor.select(blankArtist())}>
            Add the first one
          </button>
        </div>
      ) : (
        <div className="kern__form">
          <div className="kern__grid">
            <TextField
              name="Name"
              value={draft.name}
              error={errors.name}
              hint={saved ? `Filed as ${draft.key}` : undefined}
              onChange={(name) => update({ name })}
            />
            <TextField
              name="Kana"
              value={draft.kana}
              hint="Japanese reading · optional"
              onChange={(kana) => update({ kana })}
            />
            <TextField
              name="Since"
              value={draft.since}
              error={errors.since}
              hint="Year"
              onChange={(since) => update({ since })}
            />
          </div>

          <TextField
            name="Profile link"
            value={draft.link ?? ""}
            error={errors.link}
            hint="Bandcamp, SoundCloud, Instagram — where the card in 03 ARTISTS sends a reader · unset leaves the card unclickable"
            onChange={(link) => update({ link: link || undefined })}
          />

          <TextField
            name="Genres"
            value={draft.genres.join(", ")}
            hint="Comma separated"
            onChange={(value) =>
              update({
                genres: value
                  .split(",")
                  .map((genre) => genre.trim())
                  .filter(Boolean),
              })
            }
          />

          <div className="kern__section">
            <ToggleField
              name="Active"
              value={draft.active}
              hint="Off marks an act that has stopped releasing"
              onChange={(active) => update({ active })}
            />
            <ToggleField
              name="Guest"
              value={draft.guest === true}
              hint="On keeps the act off the public artist database — their songs still credit them"
              onChange={(guest) => update({ guest })}
            />
          </div>

          {dependents > 0 && (
            <p className="fld__hint kern__dependents">
              {dependents} release{dependents === 1 ? "" : "s"} credit this
              artist. Reassign them before deleting.
            </p>
          )}

          <SaveBar
            status={editor.status}
            message={editor.message}
            dirty={editor.dirty}
            onSave={onSave}
            onDelete={saved && dependents === 0 ? onDelete : undefined}
            deleteLabel="Delete artist"
          />
        </div>
      )}
    </>
  );
}
