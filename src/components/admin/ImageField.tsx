import { useRef, useState } from "react";
import { uploadImage } from "../../lib/upload";
import { Field } from "./Fields";

/**
 * Artwork, uploaded — drop a file on it or pick one.
 *
 * The stored value is still just a URL, so records seeded with a path like
 * `/cover.png` keep working and the site reads uploaded and shipped artwork
 * identically. That held through the move from Firebase Storage to R2: this
 * component did not change, because it never knew where the bytes went.
 *
 * There is deliberately no text input: a field you can type a broken path into
 * is a field that will hold a broken path.
 */
export default function ImageField({
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [failure, setFailure] = useState("");
  const [over, setOver] = useState(false);

  const take = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    setFailure("");
    setPercent(0);
    try {
      const url = await uploadImage(file, folder, { onProgress: setPercent });
      onChange(url);
    } catch (problem) {
      setFailure(
        problem instanceof Error ? problem.message : "The upload failed."
      );
    } finally {
      setPercent(null);
    }
  };

  return (
    <Field name={name} hint={hint} error={error || failure}>
      <div
        className={`drop${over ? " drop--over" : ""}`}
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
          <img className="drop__preview" src={value} alt="" />
        ) : (
          <span className="drop__empty hud">No image</span>
        )}

        <div className="drop__controls">
          <button
            className="drop__pick"
            onClick={() => inputRef.current?.click()}
            disabled={percent !== null}
          >
            {percent !== null
              ? `Uploading ${Math.round(percent)}%`
              : value
              ? "Replace"
              : "Upload image"}
          </button>
          {value && percent === null && (
            <button className="drop__clear" onClick={() => onChange("")}>
              Remove
            </button>
          )}
        </div>

        <input
          ref={inputRef}
          className="drop__file"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif"
          onChange={(e) => {
            void take(e.target.files?.[0]);
            // Cleared so picking the same file twice still fires a change.
            e.target.value = "";
          }}
        />

        {percent !== null && (
          <div className="drop__bar" aria-hidden="true">
            <i style={{ transform: `scaleX(${percent / 100})` }} />
          </div>
        )}
      </div>
    </Field>
  );
}
