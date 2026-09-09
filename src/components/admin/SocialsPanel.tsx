import { useEffect, useState } from "react";
import { store } from "../../lib/store";
import { validateSocials } from "../../lib/store/validate";
import type { Errors } from "../../lib/store/validate";
import type { Social } from "../../lib/store/types";
import { useCatalogue } from "../../lib/hooks";
import { SaveBar } from "./Fields";

/**
 * Where the label can be found.
 *
 * Two fields per row and nothing else: the network's name, written out, and
 * the link. **The name is typed rather than chosen** — a dropdown of networks
 * is a dropdown that is wrong the week the label joins a new one, and the name
 * is the word a reader actually sees in `01 SYSTEM`.
 *
 * This replaced a `contact` block of three hardcoded fields in `data.ts`, which
 * meant changing where the label could be found was a code edit and a deploy.
 *
 * Unlike the other panels there is no list and no selection: it is one
 * document, so the panel is the record. `useEditor` is not used for the same
 * reason — it owns *a* draft picked from a list, and there is nothing to pick.
 */
export default function SocialsPanel(): React.ReactElement {
  const { socials } = useCatalogue();
  const [rows, setRows] = useState<Social[]>(socials);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  /* Takes the cloud's version while nothing is being typed — the store swaps
     from the seed a moment after this mounts, and a form that ignored that
     would be editing an empty list it had already replaced. */
  useEffect(() => {
    if (!dirty) setRows(socials);
  }, [socials, dirty]);

  const patch = (index: number, changes: Partial<Social>): void => {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...changes } : row))
    );
    setDirty(true);
    setStatus("idle");
    setMessage("");
  };

  const move = (index: number, by: number): void => {
    const target = index + by;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setRows(next);
    setDirty(true);
  };

  const drop = (index: number): void => {
    setRows((current) => current.filter((_, i) => i !== index));
    setDirty(true);
  };

  const onSave = async (): Promise<void> => {
    // Empty rows are dropped rather than refused — see `validateSocials`.
    const kept = rows.filter(
      (row) => row.name.trim() !== "" || row.url.trim() !== ""
    );
    const found = validateSocials(kept);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setStatus("error");
      setMessage("Fix the highlighted rows.");
      return;
    }

    setStatus("saving");
    setMessage("");
    try {
      await store.saveSocials(
        kept.map((row) => ({ name: row.name.trim(), url: row.url.trim() }))
      );
      setRows(kept);
      setDirty(false);
      setStatus("saved");
      setMessage("Saved.");
    } catch (problem) {
      setStatus("error");
      setMessage(
        problem instanceof Error ? problem.message : "The save was refused."
      );
    }
  };

  return (
    <div className="kern__form">
      <div className="kern__listhead kern__listhead--flush">
        <span className="pane__title">Social links</span>
        <button
          className="kern__new"
          onClick={() => {
            setRows([...rows, { name: "", url: "" }]);
            setDirty(true);
          }}
        >
          + Link
        </button>
      </div>

      <p className="fld__hint">
        The name is what reads in 01 SYSTEM, where the contact block used to be.
        Clicking it opens the link.
      </p>

      {rows.length === 0 ? (
        <p className="fld__hint">
          Nothing here yet — 01 SYSTEM shows no row at all rather than an empty
          heading.
        </p>
      ) : (
        rows.map((row, index) => (
          <div className="soc__row" key={index}>
            <span className="mono trk__n">
              {String(index + 1).padStart(2, "0")}
            </span>

            <input
              className="fld__input"
              value={row.name}
              placeholder="Instagram"
              aria-label={`Network ${index + 1} name`}
              onChange={(e) => patch(index, { name: e.target.value })}
            />

            <input
              className="fld__input"
              value={row.url}
              placeholder="https://instagram.com/…"
              aria-label={`Network ${index + 1} link`}
              onChange={(e) => patch(index, { url: e.target.value })}
            />

            <div className="trk__tools">
              <button
                className="trk__tool"
                aria-label={`Move ${index + 1} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                className="trk__tool"
                aria-label={`Move ${index + 1} down`}
                disabled={index === rows.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              <button
                className="trk__tool trk__tool--drop"
                aria-label={`Remove ${index + 1}`}
                onClick={() => drop(index)}
              >
                ✕
              </button>
            </div>

            {(errors[`socials.${index}.name`] ??
              errors[`socials.${index}.url`]) && (
              <p className="fld__error trk__err">
                {errors[`socials.${index}.name`] ??
                  errors[`socials.${index}.url`]}
              </p>
            )}
          </div>
        ))
      )}

      <SaveBar
        status={status}
        message={message}
        dirty={dirty}
        onSave={() => void onSave()}
      />
    </div>
  );
}
