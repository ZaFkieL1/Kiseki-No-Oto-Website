import { useEffect, useRef, useState } from "react";
import { removeUpload, uploadAudio } from "../../lib/upload";
import { Field } from "./Fields";

/**
 * Music, uploaded to R2.
 *
 * Two shapes over one behaviour: `AudioUpload` is the cloud in a track row,
 * which opens a panel of its own, and `AudioField` is the labelled control for
 * a record's preview, which has room to sit open.
 *
 * **The upload never touches the row's link.** `Track.audio` is where the song
 * lives out on the web and is typed by hand; `Track.file` is what we put in the
 * bucket. They are different questions, they are stored apart, and a control
 * that filled one with the other is the bug this shape exists to prevent.
 */

const ACCEPT = "audio/mpeg,audio/wav,audio/flac,audio/ogg,audio/mp4,audio/aac";

/** Green once there is a file. Hollow while there is not. */
function Cloud({ full }: { full: boolean }): React.ReactElement {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M4.2 13a3.2 3.2 0 0 1-.35-6.38A4.3 4.3 0 0 1 12.1 6.1a2.9 2.9 0 0 1 .4 5.74"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {full ? (
        /* A tick, because the cloud is no longer asking for anything. */
        <path
          d="M5.6 9.9 7.3 11.6l3.2-3.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M8 13.5V7.6M5.9 9.6 8 7.4l2.1 2.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

/** The name we gave the object, dug back out of the URL it was stored as. */
function fileName(url: string): string {
  const last = url.split("/").pop() ?? url;
  // Keys are `<timestamp>-<name>`; the timestamp is ours, not the reader's.
  return decodeURIComponent(last.replace(/^\d+-/, ""));
}

/** The upload itself, without any opinion about how it is framed. */
function useUpload(
  folder: string,
  onChange: (url: string) => void
): {
  percent: number | null;
  failure: string;
  done: boolean;
  take: (file: File | undefined) => Promise<void>;
  drop: (current: string) => Promise<void>;
  clearFailure: () => void;
} {
  const [percent, setPercent] = useState<number | null>(null);
  const [failure, setFailure] = useState("");
  const [done, setDone] = useState(false);

  const take = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    setFailure("");
    setDone(false);
    setPercent(0);
    try {
      onChange(await uploadAudio(file, folder, { onProgress: setPercent }));
      setDone(true);
    } catch (problem) {
      setFailure(
        problem instanceof Error ? problem.message : "The upload failed."
      );
    } finally {
      setPercent(null);
    }
  };

  /* Takes the bytes out of the bucket as well as the URL out of the record —
     see `removeUpload`, which leaves anything we did not upload alone. */
  const drop = async (current: string): Promise<void> => {
    setFailure("");
    setDone(false);
    try {
      await removeUpload(current);
      onChange("");
    } catch (problem) {
      setFailure(
        problem instanceof Error ? problem.message : "Could not delete it."
      );
    }
  };

  return { percent, failure, done, take, drop, clearFailure: () => setFailure("") };
}

/**
 * What is inside both the row's panel and the preview field: the state of the
 * file, and the two things you can do about it.
 */
function UploadBody({
  value,
  folder,
  onChange,
  emptyLabel,
}: {
  value: string;
  folder: string;
  onChange: (url: string) => void;
  emptyLabel: string;
}): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const { percent, failure, done, take, drop } = useUpload(folder, onChange);
  const busy = percent !== null;

  return (
    <div
      className={`drop drop--audio${over ? " drop--over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void take(e.dataTransfer.files[0]);
      }}
    >
      {value ? (
        <div className="drop__has">
          {/* The confirmation that matters: not a message saying it worked,
              but the file itself, playable, named. */}
          <p className="drop__name mono">
            {done ? "Uploaded · " : ""}
            {fileName(value)}
          </p>
          <audio className="drop__audio" src={value} controls preload="none" />
        </div>
      ) : (
        <span className="drop__empty hud">{emptyLabel}</span>
      )}

      <div className="drop__controls">
        <button
          className="drop__pick"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy
            ? `Uploading ${Math.round(percent)}%`
            : value
            ? "Replace file"
            : "Choose a file"}
        </button>
        {value && !busy && (
          <button className="drop__clear" onClick={() => void drop(value)}>
            Delete file
          </button>
        )}
      </div>

      <p className="fld__hint">
        MP3, WAV, FLAC, OGG or AAC · up to 96MB · drop it here if you like
      </p>

      {failure && <p className="fld__error">{failure}</p>}

      <input
        ref={inputRef}
        className="drop__file"
        type="file"
        accept={ACCEPT}
        onChange={(e) => {
          void take(e.target.files?.[0]);
          // Cleared so picking the same file twice still fires a change.
          e.target.value = "";
        }}
      />

      {busy && (
        <div className="drop__bar" aria-hidden="true">
          <i style={{ transform: `scaleX(${(percent ?? 0) / 100})` }} />
        </div>
      )}
    </div>
  );
}

/**
 * The cloud in a track row, and the panel it opens.
 *
 * A row has space for one glyph, and a file has more to say than that — is
 * there one, what is it, does it play, and how do I get rid of it. So the glyph
 * carries the *state* (green with a tick once there is a file) and the panel
 * carries the answers. It is a `<dialog>`: Escape closes it and focus stays
 * inside without any of that being written here.
 */
export function AudioUpload({
  folder,
  label,
  value,
  onChange,
}: {
  folder: string;
  /** Named for the row it belongs to, since the glyph carries no text. */
  label: string;
  value: string;
  onChange: (url: string) => void;
}): React.ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  // `showModal()` is what makes it modal — rendering the element open does not.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button
        className={`trk__upload${value ? " trk__upload--full" : ""}`}
        aria-label={label}
        title={value ? `Uploaded: ${fileName(value)}` : "No file uploaded"}
        onClick={() => setOpen(true)}
      >
        <Cloud full={Boolean(value)} />
      </button>

      <dialog
        ref={dialogRef}
        className="sheet"
        onClose={() => setOpen(false)}
        /* The backdrop is part of the dialog's own box, so a click lands here
           when it lands outside the panel. */
        onClick={(e) => {
          if (e.target === dialogRef.current) setOpen(false);
        }}
      >
        <div className="sheet__panel">
          <div className="sheet__head">
            <span className="pane__title">{label}</span>
            <button
              className="trk__tool"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </div>

          <UploadBody
            value={value}
            folder={folder}
            onChange={onChange}
            emptyLabel="Nothing uploaded for this song yet"
          />

          <p className="fld__hint sheet__note">
            This is the file the deck plays. The song's link is a separate
            field and nothing here touches it.
          </p>
        </div>
      </dialog>
    </>
  );
}

/**
 * The full one, for a record's preview — no dialog, because a form has room
 * for it and there is only one per record.
 */
export default function AudioField({
  name,
  value,
  folder,
  onChange,
  hint,
  error,
}: {
  name: string;
  value: string;
  folder: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
}): React.ReactElement {
  return (
    <Field name={name} hint={hint} error={error}>
      <UploadBody
        value={value}
        folder={folder}
        onChange={onChange}
        emptyLabel="No preview"
      />
    </Field>
  );
}
