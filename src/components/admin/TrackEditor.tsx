import { useState } from "react";
import type { Artist, Track } from "../../lib/data";
import type { Errors } from "../../lib/store/validate";
import { AudioUpload } from "./AudioField";

/**
 * The running order.
 *
 * **The credit lives here**, one per song, because the label publishes the
 * record and the songs are what an act made. A compilation is then just a
 * record whose rows disagree — `V.A.` is derived from that, never stored as an
 * artist.
 *
 * No artwork: the sleeve belongs to the release, so a twelve track album is
 * one upload, not twelve.
 *
 * Rows keep the order you type them. Nobody sorts a tracklist alphabetically.
 */
export default function TrackEditor({
  tracks,
  artists,
  errors,
  cat,
  featured,
  onChange,
  onUpload,
  onFeature,
  onAddArtist,
}: {
  tracks: Track[];
  artists: Artist[];
  errors: Errors;
  /** Catalogue number — the folder every file of this record is filed under. */
  cat: string;
  /** Index of the song on air, or null if this record is not the one. */
  featured: number | null;
  onChange: (next: Track[]) => void;
  /**
   * A file just landed in the bucket. Separate from `onChange` because this one
   * writes the record: the bytes exist whether or not anybody presses Save.
   */
  onUpload?: (next: Track[]) => void;
  /** Absent until the record has been saved — you cannot air what is not there. */
  onFeature?: (index: number) => void;
  /** Files a new act from here and returns its key. */
  onAddArtist: (name: string) => Promise<string>;
}): React.ReactElement {
  const [guest, setGuest] = useState("");
  const [guestRow, setGuestRow] = useState<number | null>(null);

  const patch = (index: number, changes: Partial<Track>): void => {
    onChange(
      tracks.map((track, i) => (i === index ? { ...track, ...changes } : track))
    );
  };

  const move = (index: number, by: number): void => {
    const target = index + by;
    if (target < 0 || target >= tracks.length) return;
    const next = [...tracks];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };

  const addGuest = async (index: number): Promise<void> => {
    const key = await onAddArtist(guest);
    if (key) patch(index, { artist: key });
    setGuest("");
    setGuestRow(null);
  };

  /** New rows inherit the previous credit: most records are one act. */
  const addTrack = (): void =>
    onChange([...tracks, { title: "", artist: tracks.at(-1)?.artist ?? "" }]);

  return (
    <div className="trk">
      <div className="kern__listhead kern__listhead--flush">
        <span className="pane__title">Tracks</span>
        <button className="kern__new" onClick={addTrack}>
          + Track
        </button>
      </div>

      {errors.tracks && <p className="fld__error">{errors.tracks}</p>}

      {tracks.length === 0 ? (
        <p className="fld__hint">
          A single has one song, an album has as many as it has. Add the first.
        </p>
      ) : (
        tracks.map((track, index) => (
          <div className="trk__row" key={index}>
            <span className="mono trk__n">
              {String(index + 1).padStart(2, "0")}
            </span>

            <input
              className="fld__input"
              value={track.title}
              placeholder="Song title"
              aria-label={`Track ${index + 1} title`}
              onChange={(e) => patch(index, { title: e.target.value })}
            />

            <select
              className="fld__input"
              value={track.artist}
              aria-label={`Track ${index + 1} artist`}
              onChange={(e) => {
                if (e.target.value === "__guest") setGuestRow(index);
                else patch(index, { artist: e.target.value });
              }}
            >
              <option value="">Artist…</option>
              {artists.map((artist) => (
                <option value={artist.key} key={artist.key}>
                  {artist.name}
                </option>
              ))}
              <option value="__guest">+ New artist…</option>
            </select>

            <input
              className="fld__input trk__audio"
              value={track.audio ?? ""}
              placeholder="Link to the song"
              aria-label={`Track ${index + 1} link`}
              onChange={(e) =>
                patch(index, { audio: e.target.value || undefined })
              }
            />

            {/* Writes `file`, never `audio`. The field beside it is where the
                song lives on the web; this is the file we host. */}
            <AudioUpload
              folder={cat}
              label={`Audio file · track ${index + 1}`}
              value={track.file ?? ""}
              onChange={(file) => {
                // Built here rather than patched, so the record can be written
                // with it in the same breath — `patch` is a state setter and
                // would not have landed yet.
                const next = tracks.map((row, i) =>
                  i === index ? { ...row, file: file || undefined } : row
                );
                onChange(next);
                onUpload?.(next);
              }}
            />

            <input
              className="fld__input trk__bpm"
              type="number"
              min={0}
              value={track.bpm ?? ""}
              placeholder="BPM"
              aria-label={`Track ${index + 1} BPM`}
              onChange={(e) =>
                patch(index, {
                  bpm: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />

            <div className="trk__tools">
              <button
                className="trk__tool"
                aria-label={`Move track ${index + 1} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                className="trk__tool"
                aria-label={`Move track ${index + 1} down`}
                disabled={index === tracks.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              <button
                className={`trk__tool${featured === index ? " trk__tool--on" : ""}`}
                aria-label={
                  featured === index
                    ? `Track ${index + 1} is on air`
                    : `Put track ${index + 1} on air`
                }
                title={
                  onFeature
                    ? "Put on air in 01 SYSTEM"
                    : "Save the record before putting a song on air"
                }
                disabled={!onFeature}
                onClick={() => onFeature?.(index)}
              >
                {featured === index ? "●" : "○"}
              </button>
              <button
                className="trk__tool trk__tool--drop"
                aria-label={`Remove track ${index + 1}`}
                onClick={() => onChange(tracks.filter((_, i) => i !== index))}
              >
                ✕
              </button>
            </div>

            {guestRow === index && (
              <div className="trk__guest">
                <input
                  className="fld__input"
                  value={guest}
                  autoFocus
                  placeholder="Name the act"
                  aria-label="New artist"
                  onChange={(e) => setGuest(e.target.value)}
                />
                <button
                  className="kern__new"
                  disabled={guest.trim() === ""}
                  onClick={() => void addGuest(index)}
                >
                  + Add
                </button>
                <button
                  className="trk__tool"
                  aria-label="Cancel adding a guest"
                  onClick={() => {
                    setGuest("");
                    setGuestRow(null);
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            {(errors[`tracks.${index}.title`] ??
              errors[`tracks.${index}.artist`] ??
              errors[`tracks.${index}.audio`] ??
              errors[`tracks.${index}.file`] ??
              errors[`tracks.${index}.bpm`]) && (
              <p className="fld__error trk__err">
                {errors[`tracks.${index}.title`] ??
                  errors[`tracks.${index}.artist`] ??
                  errors[`tracks.${index}.audio`] ??
                  errors[`tracks.${index}.file`] ??
                  errors[`tracks.${index}.bpm`]}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
}
