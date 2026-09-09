import type { SaveStatus } from "./useEditor";

/** Label, control, and the one thing wrong with it. */
export function Field({
  name,
  hint,
  error,
  children,
}: {
  name: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <label className={`fld${error ? " fld--bad" : ""}`}>
      <span className="hud fld__name">{name}</span>
      {children}
      {hint && !error && <span className="fld__hint">{hint}</span>}
      {error && <span className="fld__error">{error}</span>}
    </label>
  );
}

export function TextField({
  name,
  value,
  onChange,
  hint,
  error,
  placeholder,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  placeholder?: string;
}): React.ReactElement {
  return (
    <Field name={name} hint={hint} error={error}>
      <input
        className="fld__input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

/**
 * A value the console works out for itself.
 *
 * Not a disabled input: a disabled input is a control that has been switched
 * off, and reads as something that might come back. This is not a control at
 * all — the catalogue number is derived from the type and the catalogue, and
 * there is nothing here for anyone to type a broken one into.
 */
export function ReadOnlyField({
  name,
  value,
  hint,
  error,
}: {
  name: string;
  value: string;
  hint?: string;
  error?: string;
}): React.ReactElement {
  return (
    <Field name={name} hint={hint} error={error}>
      <span className="fld__input fld__input--static">{value}</span>
    </Field>
  );
}

export function NumberField({
  name,
  value,
  onChange,
  hint,
  error,
}: {
  name: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
  error?: string;
}): React.ReactElement {
  return (
    <Field name={name} hint={hint} error={error}>
      <input
        className="fld__input"
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  );
}

export function SelectField({
  name,
  value,
  options,
  onChange,
  hint,
  error,
}: {
  name: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
}): React.ReactElement {
  return (
    <Field name={name} hint={hint} error={error}>
      <select
        className="fld__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {options.map((option) => (
          <option value={option.value} key={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function ToggleField({
  name,
  value,
  onChange,
  hint,
}: {
  name: string;
  value: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
}): React.ReactElement {
  return (
    <label className="fld fld--toggle">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="hud fld__name">{name}</span>
      {hint && <span className="fld__hint">{hint}</span>}
    </label>
  );
}

/** Save, delete, and what happened last time. */
export function SaveBar({
  status,
  message,
  dirty,
  onSave,
  onDelete,
  deleteLabel = "Delete",
}: {
  status: SaveStatus;
  message: string;
  dirty: boolean;
  onSave: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
}): React.ReactElement {
  return (
    <div className="savebar">
      <button
        className="playcta"
        onClick={onSave}
        disabled={status === "saving"}
      >
        {status === "saving" ? "Saving" : "Save"}
      </button>
      {onDelete && (
        <button className="savebar__danger" onClick={onDelete}>
          {deleteLabel}
        </button>
      )}
      <span className={`savebar__msg savebar__msg--${status}`}>
        {message || (dirty ? "Unsaved changes" : "")}
      </span>
    </div>
  );
}
