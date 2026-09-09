import { useCallback, useState } from "react";
import type { Errors } from "../../lib/store/validate";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * One record being edited.
 *
 * Owns the draft, whether it has been touched, and what happened the last time
 * it was saved. Writes are async because the store's are — that is the whole
 * reason this hook has a status at all, and why it will not need changing when
 * the store starts talking to Firestore.
 */
export function useEditor<T>() {
  const [draft, setDraft] = useState<T | null>(null);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  /** Returns false if the caller should stay put — unsaved work would be lost. */
  const select = useCallback(
    (next: T | null): boolean => {
      if (
        dirty &&
        !window.confirm("This record has unsaved changes. Discard them?")
      ) {
        return false;
      }
      setDraft(next);
      setDirty(false);
      setStatus("idle");
      setMessage("");
      setErrors({});
      return true;
    },
    [dirty]
  );

  const update = useCallback((patch: Partial<T>) => {
    setDraft((current) =>
      current === null ? current : { ...current, ...patch }
    );
    setDirty(true);
    setStatus("idle");
    setMessage("");
  }, []);

  /**
   * Save a value the caller is holding, rather than the draft in state.
   *
   * `update()` is a state setter, so anything that patches and then saves in
   * the same tick would write the version from before the patch. An upload does
   * exactly that — it lands a URL and has to persist it immediately — so it
   * hands the merged value in instead of trusting the draft to have caught up.
   */
  const commit = useCallback(
    async (
      value: T,
      validate: (draft: T) => Errors,
      write: (draft: T) => Promise<void>,
      note = "Saved."
    ) => {
      const found = validate(value);
      setErrors(found);
      if (Object.keys(found).length > 0) {
        setStatus("error");
        setMessage("Fix the highlighted fields.");
        return;
      }

      setStatus("saving");
      try {
        await write(value);
        setDirty(false);
        setStatus("saved");
        setMessage(note);
      } catch (error) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "The write failed.");
      }
    },
    []
  );

  const save = useCallback(
    async (
      validate: (draft: T) => Errors,
      write: (draft: T) => Promise<void>
    ) => {
      if (draft === null) return;
      await commit(draft, validate, write);
    },
    [draft, commit]
  );

  const reset = useCallback(() => {
    setDraft(null);
    setDirty(false);
    setStatus("idle");
    setMessage("");
    setErrors({});
  }, []);

  return {
    draft,
    select,
    update,
    dirty,
    status,
    message,
    errors,
    setErrors,
    save,
    commit,
    reset,
  };
}
