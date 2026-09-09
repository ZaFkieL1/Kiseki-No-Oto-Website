import {
  TYPE_LABEL,
  hash,
  releaseArtistKeys,
  type Artist,
  type Release,
  type ReleaseType,
} from "../../lib/data";
import { store } from "../../lib/store";
import { catMatchesType, nextCat, uniqueKey } from "../../lib/store/rules";
import { validateRelease } from "../../lib/store/validate";
import { useCatalogue } from "../../lib/hooks";
import { Cover } from "../Artwork";
import AudioField from "./AudioField";
import { ReadOnlyField, SaveBar, SelectField, TextField } from "./Fields";
import ImageField from "./ImageField";
import TrackEditor from "./TrackEditor";
import { useEditor } from "./useEditor";

const TYPES: ReleaseType[] = ["ALBUM", "EP", "SINGLE", "COMP", "REMIX"];

/** A new record opens as a single, which is what most of them are. */
const STARTING_TYPE: ReleaseType = "SINGLE";

function blankRelease(releases: Release[]): Release {
  return {
    cat: nextCat(STARTING_TYPE, releases),
    title: "",
    type: STARTING_TYPE,
    date: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
    tracks: [],
    seed: 0,
    hue: 340,
  };
}

/** Minted from a tracklist, when the act crediting a song is not on file yet. */
function newArtist(name: string, taken: Artist[]): Artist {
  return {
    key: uniqueKey(name, taken),
    name: name.trim(),
    kana: "",
    genres: [],
    since: String(new Date().getFullYear()),
    active: true,
  };
}

/**
 * The catalogue.
 *
 * **A release has no artist.** The label publishes it; the credits live on the
 * songs, which is what lets a compilation hold four acts without any of them
 * being the record's owner. The form follows the order you know things in:
 * identity, then where it lives, then the running order, then the sleeve.
 *
 * `seed` is never typed — it is derived from the catalogue number and the
 * title exactly as in `data.ts`, which is why the form says out loud that
 * editing either one redraws a generated sleeve.
 */
export default function ReleasesPanel(): React.ReactElement {
  const { releases, artists, featured } = useCatalogue();
  const editor = useEditor<Release>();
  const { draft, errors, update } = editor;

  const others = releases.filter((r) => r.cat !== draft?.cat);
  const saved = draft !== null && releases.some((r) => r.cat === draft.cat);
  const onAir =
    draft !== null && featured?.cat === draft.cat ? featured.track : null;

  /**
   * Where this record would move to, or null when it is already filed right.
   *
   * Only ever offered for a saved record: an unsaved one re-mints its number
   * from the dropdown, so there is nothing to move.
   */
  const renumberTo =
    draft !== null && saved && !catMatchesType(draft.cat, draft.type)
      ? nextCat(draft.type, releases)
      : null;

  const withSeed = (value: Release): Release => ({
    ...value,
    seed: hash(value.cat + value.title),
  });

  const onSave = (): void =>
    void editor.save(
      (value) => validateRelease(withSeed(value), others),
      (value) => store.saveRelease(withSeed(value))
    );

  /**
   * What happens the moment a file lands in the bucket.
   *
   * An upload is already irreversible — the bytes are in R2 — so leaving the
   * URL in the draft until somebody presses Save meant the record could end up
   * knowing nothing about a file that exists, and the green cloud went out the
   * next time the panel was opened. The upload writes the record itself now.
   *
   * **Only for a record that already exists.** A new one has no document to
   * update, and writing a half-typed draft to create one would file a release
   * under whatever catalogue number happened to be in the box. There the URL
   * stays in the draft and Save persists it, as with every other field.
   */
  const persistUpload = (patch: Partial<Release>): void => {
    update(patch);
    if (!saved || draft === null) return;
    void editor.commit(
      { ...draft, ...patch },
      (value) => validateRelease(withSeed(value), others),
      (value) => store.saveRelease(withSeed(value)),
      "Uploaded and saved."
    );
  };

  /**
   * Move a saved record to the number its type calls for.
   *
   * Never automatic. The catalogue number is the document id and the folder
   * uploads go to, and changing it out from under someone who was editing a
   * title is not something a dropdown should be able to do.
   */
  const onRenumber = async (): Promise<void> => {
    if (!draft || !renumberTo) return;
    if (
      !window.confirm(
        `Renumber ${draft.cat} to ${renumberTo}? Files already uploaded stay where they are.`
      )
    ) {
      return;
    }
    try {
      await store.renumberRelease(draft.cat, renumberTo);
      editor.select(withSeed({ ...draft, cat: renumberTo }));
    } catch (error) {
      editor.setErrors({
        cat: error instanceof Error ? error.message : "The renumbering failed.",
      });
    }
  };

  const onDelete = (): void => {
    if (!draft) return;
    if (!window.confirm(`Delete ${draft.cat}? This cannot be undone.`)) return;
    void store.removeRelease(draft.cat).then(editor.reset);
  };

  const onAddArtist = async (name: string): Promise<string> => {
    const entry = newArtist(name, artists);
    if (!entry.key) return "";
    await store.saveArtist(entry);
    return entry.key;
  };

  return (
    <>
      <div className="kern__list">
        <div className="kern__listhead">
          <span className="pane__title">Releases</span>
          <button
            className="kern__new"
            onClick={() => editor.select(blankRelease(releases))}
          >
            + New
          </button>
        </div>

        {releases.map((release) => (
          <button
            className="kern__row"
            key={release.cat}
            aria-current={release.cat === draft?.cat}
            onClick={() =>
              editor.select({
                ...release,
                tracks: release.tracks.map((track) => ({ ...track })),
              })
            }
          >
            <span className="kern__onair">
              {release.cat === featured?.cat ? "●" : ""}
            </span>
            <span className="mono">{release.cat}</span>
            <span className="kern__rowname">{release.title}</span>
            <span className="mono kern__rowstate">
              {release.tracks.length}
              {releaseArtistKeys(release).length > 1 ? " · V.A." : ""}
            </span>
          </button>
        ))}
      </div>

      {draft === null ? (
        <div className="kern__blank">
          <p className="hud">No record selected.</p>
          <button
            className="playcta"
            onClick={() => editor.select(blankRelease(releases))}
          >
            Add the first one
          </button>
        </div>
      ) : (
        <div className="kern__form">
          <div className="kern__grid">
            <ReadOnlyField
              name="Catalogue"
              value={draft.cat}
              error={errors.cat}
              hint={
                saved
                  ? "Frozen — it is this record's id and the folder its files live in"
                  : "Follows the type · changes the generated sleeve"
              }
            />
            <TextField
              name="Date"
              value={draft.date}
              error={errors.date}
              hint="YYYY.MM.DD"
              onChange={(date) => update({ date })}
            />
            <SelectField
              name="Type"
              value={draft.type}
              options={TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
              /* On a record that has not been saved yet the number follows the
                 type, so correcting the type is one gesture rather than two.
                 On a saved one it cannot: the number is the document id, and
                 moving it is the renumber control below. */
              onChange={(value) => {
                const type = value as ReleaseType;
                update(
                  saved
                    ? { type }
                    : { type, cat: nextCat(type, releases) }
                );
              }}
            />
          </div>

          {renumberTo && (
            <div className="kern__renumber">
              <p>
                Filed as <span className="mono">{draft.cat}</span>, but this is
                a {TYPE_LABEL[draft.type]}.
              </p>
              <button
                className="playcta"
                disabled={editor.dirty || editor.status === "saving"}
                onClick={() => void onRenumber()}
              >
                Renumber to {renumberTo}
              </button>
              <span className="fld__hint">
                {editor.dirty
                  ? "Save your changes first."
                  : "Uploaded files stay where they are. A generated sleeve is redrawn."}
              </span>
            </div>
          )}

          <TextField
            name="Title"
            value={draft.title}
            error={errors.title}
            hint="Changes the generated sleeve"
            onChange={(title) => update({ title })}
          />

          <TextField
            name="Release link"
            value={draft.link ?? ""}
            error={errors.link}
            hint="Bandcamp, SoundCloud, wherever it lives · unset shows a visible gap"
            onChange={(link) => update({ link: link || undefined })}
          />

          {/* Up here with the record's own information, not down among the
              songs: a preview is the record, and it is the only thing a
              visitor can start playing from the release scene. */}
          <AudioField
            name="Preview"
            value={draft.preview ?? ""}
            folder={draft.cat}
            error={errors.preview}
            hint="Plays behind PLAY PREVIEW in 02 RELEASES · unset hides the control"
            onChange={(preview) => persistUpload({ preview: preview || undefined })}
          />

          <div className="kern__section">
            <TrackEditor
              tracks={draft.tracks}
              artists={artists}
              errors={errors}
              cat={draft.cat}
              featured={onAir}
              onChange={(tracks) => update({ tracks })}
              onUpload={(tracks) => persistUpload({ tracks })}
              onAddArtist={onAddArtist}
              onFeature={
                saved
                  ? (index) => void store.setFeatured(draft.cat, index)
                  : undefined
              }
            />
          </div>

          <div className="kern__section kern__preview">
            <ImageField
              name="Cover"
              value={draft.cover ?? ""}
              folder={draft.cat}
              error={errors.cover}
              hint="One sleeve for the whole record"
              onChange={(cover) => persistUpload({ cover: cover || undefined })}
            />

            <div>
              <span className="hud">As the site draws it</span>
              <Cover
                seed={hash(draft.cat + draft.title)}
                hue={draft.hue}
                cover={draft.cover}
                size={180}
              />
            </div>
          </div>

          <SaveBar
            status={editor.status}
            message={editor.message}
            dirty={editor.dirty}
            onSave={onSave}
            onDelete={saved ? onDelete : undefined}
            deleteLabel="Delete release"
          />
        </div>
      )}
    </>
  );
}
