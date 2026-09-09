# Admin B — KERNEL Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Prerequisite:** Plan A (`2026-08-12-admin-a-data-seam.md`) is complete. The `Store` singleton, `useCatalogue()`, `catalogue.ts` and the online `LabelEvent` all exist.

**Goal:** A maintenance console at `/admin` that creates, edits and deletes releases, artists and events, and marks which release the hero boots with.

**Architecture:** A second Astro page mounting one React island, so nothing here ships to the public bundle. Master/detail per section, driven by a shared `useEditor` hook that owns the draft, the dirty flag and the save state. Validation is pure and tested; the store is the only thing that writes.

**Tech Stack:** Astro 7, React 19, TypeScript, pnpm, Vitest.

## Global Constraints

- The console is titled **KERNEL** — `KISEKI_OS · KERNEL`. Never "admin" or "maintenance" in user-facing copy.
- Machine-generated content uses `Martian Mono` (`--mono`); human-authored content uses `Zen Kaku Gothic New` (`--sans`). Catalogue numbers, dates, formats and times are machine. Artist names, release titles and event names are human.
- Reuse the existing tokens from `global.css`: `--void`, `--panel`, `--line`, `--line-strong`, `--text`, `--dim`, `--dimmer`, `--hot`, `--hot-ink`, `--gut`, `--t-hud`, `--t-sm`, `--t-base`, `--ease`, `--ease-snap`. Do not introduce a second palette.
- Every write goes through `store`. No component mutates a snapshot.
- Actions keep the same name through a flow: a button that says **Save** produces a state that says **Saved**.
- Errors say what happened and how to fix it. They do not apologise and they are never vague.
- Tests cover `validate.ts` only. No component tests.

---

### Task 1: Validation

**Files:**
- Create: `src/lib/store/validate.ts`
- Test: `src/lib/store/validate.test.ts`

**Interfaces:**
- Consumes: `Artist`, `LabelEvent`, `Release`, `Slot` from `src/lib/store/types.ts`.
- Produces: `type Errors = Record<string, string>`, `isRealDate(value: string): boolean`, `validateRelease(draft: Release, others: Release[]): Errors`, `validateArtist(draft: Artist, others: Artist[]): Errors`, `validateEvent(draft: LabelEvent): Errors`. Slot errors are keyed `schedule.<index>.<field>`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/store/validate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isRealDate, validateArtist, validateEvent, validateRelease } from "./validate";
import type { Artist, LabelEvent, Release } from "./types";

function release(overrides: Partial<Release> = {}): Release {
  return {
    id: 40,
    cat: "KSK-040",
    title: "TEST RECORD",
    artist: "senko",
    type: "EP",
    date: "2026.09.01",
    tracks: 4,
    seed: 1,
    hue: 200,
    bpm: 180,
    duration: 240,
    ...overrides,
  };
}

function artist(overrides: Partial<Artist> = {}): Artist {
  return {
    key: "testartist",
    name: "TEST ARTIST",
    kana: "テスト",
    genres: ["J-CORE"],
    since: "2026",
    base: "",
    active: true,
    roster: true,
    ...overrides,
  };
}

function event(overrides: Partial<LabelEvent> = {}): LabelEvent {
  return {
    id: "evt-test",
    date: "2026.09.12",
    name: "TEST NIGHT",
    platform: "TWITCH",
    timezone: "JST",
    schedule: [],
    ...overrides,
  };
}

describe("isRealDate", () => {
  it("accepts a real date", () => {
    expect(isRealDate("2026.09.12")).toBe(true);
  });

  it("rejects the wrong separator or width", () => {
    expect(isRealDate("2026-09-12")).toBe(false);
    expect(isRealDate("2026.9.12")).toBe(false);
  });

  it("rejects a day that does not exist", () => {
    expect(isRealDate("2026.02.30")).toBe(false);
  });
});

describe("validateRelease", () => {
  it("accepts a good record", () => {
    expect(validateRelease(release(), [])).toEqual({});
  });

  it("requires the KSK-### shape", () => {
    expect(validateRelease(release({ cat: "KSK-40" }), []).cat).toMatch(/KSK-/);
  });

  it("rejects a duplicate catalogue number", () => {
    const existing = [release({ cat: "KSK-040" })];
    expect(validateRelease(release({ cat: "KSK-040" }), existing).cat).toMatch(/already/i);
  });

  it("requires a title and an artist", () => {
    const errors = validateRelease(release({ title: "  ", artist: "" }), []);
    expect(errors.title).toBeTruthy();
    expect(errors.artist).toBeTruthy();
  });

  it("rejects a bad date", () => {
    expect(validateRelease(release({ date: "2026/09/01" }), []).date).toBeTruthy();
  });

  it("rejects negative counts", () => {
    expect(validateRelease(release({ tracks: -1 }), []).tracks).toBeTruthy();
  });

  it("requires paths to be absolute or a URL", () => {
    expect(validateRelease(release({ cover: "cover.png" }), []).cover).toBeTruthy();
    expect(validateRelease(release({ cover: "/cover.png" }), []).cover).toBeUndefined();
    expect(validateRelease(release({ bandcamp: "https://x.bandcamp.com" }), []).bandcamp).toBeUndefined();
  });
});

describe("validateArtist", () => {
  it("accepts a good artist", () => {
    expect(validateArtist(artist(), [])).toEqual({});
  });

  it("requires a lowercase slug key", () => {
    expect(validateArtist(artist({ key: "Test Artist" }), []).key).toBeTruthy();
  });

  it("rejects a duplicate key", () => {
    expect(validateArtist(artist(), [artist()]).key).toMatch(/already/i);
  });

  it("requires a name", () => {
    expect(validateArtist(artist({ name: "" }), []).name).toBeTruthy();
  });
});

describe("validateEvent", () => {
  it("accepts a good event", () => {
    expect(validateEvent(event())).toEqual({});
  });

  it("requires a name, a date and a timezone", () => {
    const errors = validateEvent(event({ name: "", date: "nope", timezone: "" }));
    expect(errors.name).toBeTruthy();
    expect(errors.date).toBeTruthy();
    expect(errors.timezone).toBeTruthy();
  });

  it("checks the stream and flyer look like links", () => {
    const errors = validateEvent(event({ stream: "twitch.tv/x", flyer: "flyer.png" }));
    expect(errors.stream).toBeTruthy();
    expect(errors.flyer).toBeTruthy();
  });

  it("keys slot errors by index", () => {
    const errors = validateEvent(
      event({ schedule: [{ start: "8pm", artist: "" }] })
    );
    expect(errors["schedule.0.start"]).toBeTruthy();
    expect(errors["schedule.0.artist"]).toBeTruthy();
  });

  it("accepts 24:00 as an end time", () => {
    const errors = validateEvent(
      event({ schedule: [{ start: "23:00", end: "24:00", artist: "GUEST" }] })
    );
    expect(errors).toEqual({});
  });

  it("rejects an end time before its start", () => {
    const errors = validateEvent(
      event({ schedule: [{ start: "22:00", end: "21:00", artist: "GUEST" }] })
    );
    expect(errors["schedule.0.end"]).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test src/lib/store/validate.test.ts`
Expected: FAIL — `Cannot find module './validate'`.

- [ ] **Step 3: Write the validator**

Create `src/lib/store/validate.ts`:

```ts
import type { Artist, LabelEvent, Release } from "./types";

/** Field name → what is wrong and how to fix it. Empty means valid. */
export type Errors = Record<string, string>;

const CAT = /^KSK-\d{3}$/;
const DATE = /^\d{4}\.\d{2}\.\d{2}$/;
const TIME = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
/** Absolute path under public/, or a full URL. Nothing relative. */
const LOCATION = /^(https?:\/\/|\/)/;

export function isRealDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const [year, month, day] = value.split(".").map(Number);
  const date = new Date(year!, month! - 1, day!);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month! - 1 &&
    date.getDate() === day
  );
}

function blank(value: string | undefined): boolean {
  return (value ?? "").trim() === "";
}

function checkLocation(errors: Errors, field: string, value?: string): void {
  if (!blank(value) && !LOCATION.test(value!)) {
    errors[field] = "Use a path starting with / or a full https:// URL.";
  }
}

function checkCount(errors: Errors, field: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    errors[field] = "Whole number, 0 or more. 0 means unknown.";
  }
}

export function validateRelease(draft: Release, others: Release[]): Errors {
  const errors: Errors = {};

  if (blank(draft.cat)) errors.cat = "A catalogue number is required.";
  else if (!CAT.test(draft.cat)) errors.cat = "Format is KSK-### — three digits.";
  else if (others.some((r) => r.cat === draft.cat)) {
    errors.cat = `${draft.cat} already exists in the catalogue.`;
  }

  if (blank(draft.title)) errors.title = "A title is required.";
  if (blank(draft.artist)) errors.artist = "Pick the artist this is credited to.";
  if (!isRealDate(draft.date)) errors.date = "Format is YYYY.MM.DD, and it has to be a real date.";

  checkCount(errors, "tracks", draft.tracks);
  checkCount(errors, "bpm", draft.bpm);
  checkCount(errors, "duration", draft.duration);

  checkLocation(errors, "audio", draft.audio);
  checkLocation(errors, "cover", draft.cover);
  checkLocation(errors, "desktopArtwork", draft.desktopArtwork);
  checkLocation(errors, "bandcamp", draft.bandcamp);

  return errors;
}

export function validateArtist(draft: Artist, others: Artist[]): Errors {
  const errors: Errors = {};

  if (blank(draft.key)) errors.key = "A key is required — it is how releases credit this artist.";
  else if (!SLUG.test(draft.key)) {
    errors.key = "Lowercase letters, numbers and hyphens only.";
  } else if (others.some((a) => a.key === draft.key)) {
    errors.key = `${draft.key} already belongs to another artist.`;
  }

  if (blank(draft.name)) errors.name = "A name is required.";
  if (blank(draft.since)) errors.since = "A start year is required.";

  return errors;
}

export function validateEvent(draft: LabelEvent): Errors {
  const errors: Errors = {};

  if (blank(draft.name)) errors.name = "A name is required.";
  if (!isRealDate(draft.date)) errors.date = "Format is YYYY.MM.DD, and it has to be a real date.";
  if (blank(draft.timezone)) errors.timezone = "A timezone label is required — it travels with every time on the schedule.";

  checkLocation(errors, "stream", draft.stream);
  checkLocation(errors, "flyer", draft.flyer);

  draft.schedule.forEach((slot, index) => {
    if (!TIME.test(slot.start)) {
      errors[`schedule.${index}.start`] = "Format is HH:MM.";
    }
    if (blank(slot.artist)) {
      errors[`schedule.${index}.artist`] = "Name the act, as it reads on the flyer.";
    }
    if (!blank(slot.end)) {
      if (!TIME.test(slot.end!)) {
        errors[`schedule.${index}.end`] = "Format is HH:MM.";
      } else if (TIME.test(slot.start) && slot.end! <= slot.start) {
        errors[`schedule.${index}.end`] = "The end has to come after the start.";
      }
    }
  });

  return errors;
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test src/lib/store/validate.test.ts`
Expected: PASS, 21 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/store/validate.ts src/lib/store/validate.test.ts
git commit -m "feat(kernel): validation rules for releases, artists and events"
```

---

### Task 2: The console shell

**Files:**
- Create: `src/pages/admin.astro`
- Create: `src/components/admin/AdminOS.tsx`
- Create: `src/components/admin/useEditor.ts`
- Create: `src/components/admin/Fields.tsx`
- Create: `src/styles/admin.css`

**Interfaces:**
- Consumes: `store` and `useCatalogue` from Plan A, `Errors` from Task 1.
- Produces:
  - `useEditor<T>(): { draft, select, update, dirty, status, message, errors, setErrors, save, reset }` from `useEditor.ts`. `status` is `"idle" | "saving" | "saved" | "error"`.
  - `Field`, `TextField`, `NumberField`, `SelectField`, `ToggleField`, `SaveBar`, `Confirm` from `Fields.tsx`.

- [ ] **Step 1: Write the editor hook**

Create `src/components/admin/useEditor.ts`:

```ts
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
    setDraft((current) => (current === null ? current : { ...current, ...patch }));
    setDirty(true);
    setStatus("idle");
  }, []);

  const save = useCallback(
    async (validate: (draft: T) => Errors, write: (draft: T) => Promise<void>) => {
      if (draft === null) return;

      const found = validate(draft);
      setErrors(found);
      if (Object.keys(found).length > 0) {
        setStatus("error");
        setMessage("Fix the highlighted fields.");
        return;
      }

      setStatus("saving");
      try {
        await write(draft);
        setDirty(false);
        setStatus("saved");
        setMessage("Saved.");
      } catch (error) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "The write failed.");
      }
    },
    [draft]
  );

  const reset = useCallback(() => {
    setDraft(null);
    setDirty(false);
    setStatus("idle");
    setMessage("");
    setErrors({});
  }, []);

  return { draft, select, update, dirty, status, message, errors, setErrors, save, reset };
}
```

- [ ] **Step 2: Write the form primitives**

Create `src/components/admin/Fields.tsx`:

```tsx
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
      <button className="playcta" onClick={onSave} disabled={status === "saving"}>
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
```

- [ ] **Step 3: Write the console**

Create `src/components/admin/AdminOS.tsx`:

```tsx
import { useState } from "react";
import { store } from "../../lib/store";
import { useCatalogue } from "../../lib/hooks";

type SectionKey = "releases" | "artists" | "events";

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "releases", label: "Releases" },
  { key: "artists", label: "Artists" },
  { key: "events", label: "Events" },
];

/**
 * The maintenance console. Not part of the public island — this page is the
 * only thing that mounts it, so none of this code reaches a visitor.
 *
 * Same chassis idea as `LabelOS`: a section key in state, no router. Denser and
 * plainer, because this one is a tool rather than a record sleeve.
 */
export default function AdminOS(): React.ReactElement {
  const [section, setSection] = useState<SectionKey>("releases");
  const { releases, artists, events, origin } = useCatalogue();

  const onReset = async (): Promise<void> => {
    const ok = window.confirm(
      "Reset to the shipped catalogue? Every release, artist and event you have edited here will be replaced. This cannot be undone."
    );
    if (ok) await store.resetToSeed();
  };

  return (
    <div className="kern">
      <header className="kern__bar">
        <span className="kern__mark">
          KISEKI_OS<em>·KERNEL</em>
        </span>
        <span className="bar__spacer" />
        <span className="hud kern__origin">
          {origin === "local" ? "Local store" : "Seed"} · {releases.length}/
          {artists.length}/{events.length}
        </span>
        <button className="kern__reset" onClick={() => void onReset()}>
          Reset seed
        </button>
      </header>

      <div className="kern__body">
        <nav className="kern__rail" aria-label="Kernel">
          {SECTIONS.map((entry, index) => (
            <button
              key={entry.key}
              className="nav__item"
              aria-current={entry.key === section}
              onClick={() => setSection(entry.key)}
            >
              <span className="nav__num">
                {String(index + 1).padStart(2, "0")}
              </span>
              {entry.label}
            </button>
          ))}
        </nav>

        <main className="kern__work">
          {section === "releases" && <p className="hud">Releases — Task 3.</p>}
          {section === "artists" && <p className="hud">Artists — Task 4.</p>}
          {section === "events" && <p className="hud">Events — Task 5.</p>}
        </main>
      </div>
    </div>
  );
}
```

The three placeholders are replaced in Tasks 3–5. They exist so this task ends on something you can open and click.

- [ ] **Step 4: Write the page**

Create `src/pages/admin.astro`:

```astro
---
import AdminOS from "../components/admin/AdminOS.tsx";
import { label } from "../lib/data";
import "../styles/global.css";
import "../styles/admin.css";
---

<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="theme-color" content="#06070b" />
    <title>KERNEL — {label.name}</title>

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Martian+Mono:wght@300;400;600&family=Zen+Kaku+Gothic+New:wght@400;700;900&display=swap"
      rel="stylesheet"
    />
  </head>

  <body class="kernel-body">
    <!-- client:only, not client:load: this console reads localStorage, and
         server-rendering it would paint the seed and then swap. -->
    <AdminOS client:only="react" />
  </body>
</html>
```

- [ ] **Step 5: Write the stylesheet**

Create `src/styles/admin.css`:

```css
/* ==========================================================================
   KERNEL — the maintenance console.
   Same tokens as the OS, none of the theatre. This one is a tool.
   ========================================================================== */

.kernel-body {
  overflow: hidden;
}

.kern {
  height: 100dvh;
  display: grid;
  grid-template-rows: 2.75rem 1fr;
  background: var(--void);
  color: var(--text);
}

.kern__bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-inline: var(--gut);
  border-bottom: 1px solid var(--line);
  background: var(--panel);
}

.kern__mark {
  font-family: var(--mono);
  font-size: var(--t-sm);
  font-weight: 600;
  letter-spacing: 0.2em;
}

.kern__mark em {
  font-style: normal;
  color: var(--hot-ink);
}

.kern__origin {
  color: var(--dim);
}

.kern__reset {
  font-family: var(--mono);
  font-size: var(--t-hud);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--dim);
  border: 1px solid var(--line-strong);
  padding: 0.35rem 0.8rem;
  transition: color 140ms var(--ease), border-color 140ms var(--ease);
}

.kern__reset:hover {
  color: var(--amber);
  border-color: var(--amber);
}

.kern__body {
  display: grid;
  grid-template-columns: 11rem 1fr;
  min-height: 0;
}

.kern__rail {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--line);
  padding-top: 0.75rem;
}

.kern__work {
  min-height: 0;
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, 22rem) minmax(0, 1fr);
}

/* ---- master list ---- */
.kern__list {
  border-right: 1px solid var(--line);
  overflow-y: auto;
  scrollbar-width: thin;
}

.kern__listhead {
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem var(--gut);
  background: var(--void);
  border-bottom: 1px solid var(--line);
}

.kern__new {
  margin-left: auto;
  font-family: var(--mono);
  font-size: var(--t-hud);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--hot-ink);
}

.kern__row {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  width: 100%;
  text-align: left;
  padding: 0.6rem var(--gut);
  border-bottom: 1px solid var(--line);
  transition: background 120ms var(--ease);
}

.kern__row:hover {
  background: var(--panel);
}

.kern__row[aria-current="true"] {
  background: var(--panel-2);
  box-shadow: inset 2px 0 0 var(--hot);
}

.kern__row .mono {
  font-size: var(--t-sm);
  color: var(--dim);
}

/* Human names in the human face, even in a tool. */
.kern__rowname {
  font-family: var(--sans);
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kern__mark--featured {
  color: var(--hot);
}

/* ---- detail form ---- */
.kern__form {
  overflow-y: auto;
  padding: var(--gut);
  display: grid;
  align-content: start;
  gap: 1rem;
  scrollbar-width: thin;
}

.kern__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 1rem;
}

.kern__section {
  border-top: 1px solid var(--line);
  padding-top: 1rem;
  margin-top: 0.5rem;
}

.fld {
  display: grid;
  gap: 0.3rem;
}

.fld__name {
  color: var(--dim);
}

.fld__input {
  font-family: var(--mono);
  font-size: var(--t-base);
  color: var(--text);
  background: var(--panel);
  border: 1px solid var(--line-strong);
  padding: 0.5rem 0.65rem;
  width: 100%;
}

.fld__input:focus-visible {
  outline: 2px solid var(--hot);
  outline-offset: 1px;
}

.fld--bad .fld__input {
  border-color: var(--amber);
}

.fld__hint,
.fld__error {
  font-family: var(--mono);
  font-size: var(--t-hud);
  letter-spacing: 0.08em;
}

.fld__hint {
  color: var(--dimmer);
}

.fld__error {
  color: var(--amber);
}

.fld--toggle {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.savebar {
  display: flex;
  align-items: center;
  gap: 1rem;
  border-top: 1px solid var(--line);
  padding-top: 1rem;
  margin-top: 0.5rem;
}

.savebar__danger {
  font-family: var(--mono);
  font-size: var(--t-sm);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--dim);
  border: 1px solid var(--line-strong);
  padding: 0.8rem 1.2rem;
}

.savebar__danger:hover {
  color: var(--amber);
  border-color: var(--amber);
}

.savebar__msg {
  font-family: var(--mono);
  font-size: var(--t-hud);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--dim);
}

.savebar__msg--saved {
  color: var(--ice);
}

.savebar__msg--error {
  color: var(--amber);
}

.kern__blank {
  display: grid;
  align-content: center;
  justify-items: start;
  gap: 0.75rem;
  padding: var(--gut);
  color: var(--dimmer);
}

@media (max-width: 62rem) {
  .kern__body {
    grid-template-columns: 1fr;
  }

  .kern__rail {
    flex-direction: row;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }

  .kern__work {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 6: Verify by hand**

Run: `pnpm astro dev --background`, open `http://localhost:4321/admin`.

Check:
1. The header reads `KISEKI_OS·KERNEL` and `Seed · 38/12/6`.
2. The three rail entries switch the placeholder text.
3. `Reset seed` asks for confirmation and does nothing on cancel.
4. `http://localhost:4321` still works and looks untouched.

- [ ] **Step 7: Verify the build**

Run: `pnpm build`
Expected: two pages built — `/index.html` and `/admin/index.html`.

- [ ] **Step 8: Commit**

```bash
git add src/pages/admin.astro src/components/admin src/styles/admin.css
git commit -m "feat(kernel): console shell, editor hook and form primitives"
```

---

### Task 3: Releases

**Files:**
- Create: `src/components/admin/ReleasesPanel.tsx`
- Modify: `src/components/admin/AdminOS.tsx` (replace the releases placeholder)

**Interfaces:**
- Consumes: `useEditor`, `Fields`, `validateRelease`, `store`, `useCatalogue`, `hash` from `data.ts`, `Cover` from `../Artwork`.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Write the panel**

Create `src/components/admin/ReleasesPanel.tsx`:

```tsx
import { hash, TYPE_LABEL, type Release, type ReleaseType } from "../../lib/data";
import { store } from "../../lib/store";
import { validateRelease } from "../../lib/store/validate";
import { useCatalogue } from "../../lib/hooks";
import { Cover } from "../Artwork";
import { NumberField, SaveBar, SelectField, TextField } from "./Fields";
import { useEditor } from "./useEditor";

const TYPES: ReleaseType[] = ["ALBUM", "EP", "SINGLE", "COMP", "REMIX"];

function blankRelease(nextId: number): Release {
  return {
    id: nextId,
    cat: `KSK-${String(nextId).padStart(3, "0")}`,
    title: "",
    artist: "",
    type: "SINGLE",
    date: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
    tracks: 1,
    seed: 0,
    hue: 340,
    bpm: 0,
    duration: 0,
  };
}

/**
 * The catalogue.
 *
 * `seed` is never typed in — it is derived from the catalogue number and the
 * title, exactly as in `data.ts`, which is why the form says out loud that
 * changing either one redraws a generated sleeve. That is the kind of
 * invisible consequence that bites six months later.
 */
export default function ReleasesPanel(): React.ReactElement {
  const { releases, artists, featured } = useCatalogue();
  const editor = useEditor<Release>();
  const { draft, errors } = editor;

  const nextId = releases.reduce((max, r) => Math.max(max, r.id), 0) + 1;
  const others = releases.filter((r) => r.cat !== draft?.cat);

  const onSave = (): void =>
    void editor.save(
      (value) => validateRelease({ ...value, seed: hash(value.cat + value.title) }, others),
      (value) => store.saveRelease({ ...value, seed: hash(value.cat + value.title) })
    );

  const onDelete = (): void => {
    if (!draft) return;
    if (!window.confirm(`Delete ${draft.cat}? This cannot be undone.`)) return;
    void store.removeRelease(draft.cat).then(editor.reset);
  };

  const onFeature = (): void => {
    if (!draft) return;
    void store.setFeatured(draft.cat);
  };

  return (
    <>
      <div className="kern__list">
        <div className="kern__listhead">
          <span className="pane__title">Releases</span>
          <button
            className="kern__new"
            onClick={() => editor.select(blankRelease(nextId))}
          >
            + New
          </button>
        </div>

        {releases.map((release) => (
          <button
            className="kern__row"
            key={release.cat}
            aria-current={release.cat === draft?.cat}
            onClick={() => editor.select({ ...release })}
          >
            <span className="kern__mark--featured">
              {release.cat === featured ? "●" : " "}
            </span>
            <span className="mono">{release.cat}</span>
            <span className="kern__rowname">{release.title}</span>
          </button>
        ))}
      </div>

      {draft === null ? (
        <div className="kern__blank">
          <p className="hud">No record selected.</p>
          <button
            className="playcta"
            onClick={() => editor.select(blankRelease(nextId))}
          >
            Add the first one
          </button>
        </div>
      ) : (
        <div className="kern__form">
          <div className="kern__grid">
            <TextField
              name="Catalogue"
              value={draft.cat}
              error={errors.cat}
              hint="KSK-### · changes the generated sleeve"
              onChange={(cat) => editor.update({ cat } as Partial<Release>)}
            />
            <TextField
              name="Date"
              value={draft.date}
              error={errors.date}
              hint="YYYY.MM.DD"
              onChange={(date) => editor.update({ date } as Partial<Release>)}
            />
          </div>

          <TextField
            name="Title"
            value={draft.title}
            error={errors.title}
            hint="Changes the generated sleeve"
            onChange={(title) => editor.update({ title } as Partial<Release>)}
          />

          <div className="kern__grid">
            <SelectField
              name="Artist"
              value={draft.artist}
              error={errors.artist}
              options={artists.map((a) => ({ value: a.key, label: a.name }))}
              onChange={(artist) => editor.update({ artist } as Partial<Release>)}
            />
            <SelectField
              name="Type"
              value={draft.type}
              options={TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
              onChange={(type) =>
                editor.update({ type: type as ReleaseType } as Partial<Release>)
              }
            />
          </div>

          <div className="kern__grid">
            <NumberField
              name="Tracks"
              value={draft.tracks}
              error={errors.tracks}
              onChange={(tracks) => editor.update({ tracks } as Partial<Release>)}
            />
            <NumberField
              name="BPM"
              value={draft.bpm}
              error={errors.bpm}
              hint="0 = unknown"
              onChange={(bpm) => editor.update({ bpm } as Partial<Release>)}
            />
            <NumberField
              name="Duration"
              value={draft.duration}
              error={errors.duration}
              hint="Seconds · 0 = read off the file"
              onChange={(duration) => editor.update({ duration } as Partial<Release>)}
            />
            <NumberField
              name="Hue"
              value={draft.hue}
              hint="0–360 · sampled from a real sleeve at runtime"
              onChange={(hue) => editor.update({ hue } as Partial<Release>)}
            />
          </div>

          <div className="kern__section kern__grid">
            <TextField
              name="Audio"
              value={draft.audio ?? ""}
              error={errors.audio}
              hint="Path under public/ or a URL"
              onChange={(audio) =>
                editor.update({ audio: audio || undefined } as Partial<Release>)
              }
            />
            <TextField
              name="Cover"
              value={draft.cover ?? ""}
              error={errors.cover}
              hint="Square sleeve"
              onChange={(cover) =>
                editor.update({ cover: cover || undefined } as Partial<Release>)
              }
            />
            <TextField
              name="Desktop artwork"
              value={draft.desktopArtwork ?? ""}
              error={errors.desktopArtwork}
              hint="Wide art for the release scene"
              onChange={(desktopArtwork) =>
                editor.update({ desktopArtwork: desktopArtwork || undefined } as Partial<Release>)
              }
            />
            <TextField
              name="Bandcamp"
              value={draft.bandcamp ?? ""}
              error={errors.bandcamp}
              hint="Unset shows a visible gap, not a dead link"
              onChange={(bandcamp) =>
                editor.update({ bandcamp: bandcamp || undefined } as Partial<Release>)
              }
            />
          </div>

          <div className="kern__section">
            <span className="hud">Sleeve preview</span>
            <Cover
              seed={hash(draft.cat + draft.title)}
              hue={draft.hue}
              cover={draft.cover}
              size={180}
            />
            <p className="hud">
              {draft.cat === featured
                ? "● On air in 01 SYSTEM"
                : "Not the record the hero boots with"}
            </p>
            {draft.cat !== featured && releases.some((r) => r.cat === draft.cat) && (
              <button className="playcta" onClick={onFeature}>
                Put on air
              </button>
            )}
          </div>

          <SaveBar
            status={editor.status}
            message={editor.message}
            dirty={editor.dirty}
            onSave={onSave}
            onDelete={releases.some((r) => r.cat === draft.cat) ? onDelete : undefined}
            deleteLabel="Delete release"
          />
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Check `hash` is exported**

`src/lib/data.ts` defines `hash` for seeds. If it is not exported, export it: `export function hash(...)`. `ReleasesPanel` needs it to derive `seed` the same way the seed data does.

- [ ] **Step 3: Mount it**

In `AdminOS.tsx`, replace `{section === "releases" && <p className="hud">Releases — Task 3.</p>}` with `{section === "releases" && <ReleasesPanel />}` and add the import.

- [ ] **Step 4: Verify by hand**

At `/admin`:
1. Click `KSK-038`. Every field fills. The preview shows `/cover.png`.
2. Change the title, leave it. The confirm dialog appears; cancel keeps you put.
3. Set the catalogue number to `KSK-037` and save — the error reads "KSK-037 already exists in the catalogue."
4. Fix it, save. The header switches from `Seed` to `Local store`.
5. Open `/` in a second tab and confirm the title changed there too, without a reload.
6. `+ New` → fill `KSK-039`, a title and an artist → Save → it appears in the list and on the site.
7. Select it, `Put on air`, then reload `/` — the hero boots with it.
8. Delete it. The featured mark moves to the newest remaining record rather than going blank.

- [ ] **Step 5: Verify the build and tests**

Run: `pnpm test && pnpm build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin src/lib/data.ts
git commit -m "feat(kernel): releases panel with sleeve preview and on-air mark"
```

---

### Task 4: Artists

**Files:**
- Create: `src/components/admin/ArtistsPanel.tsx`
- Modify: `src/components/admin/AdminOS.tsx`

**Interfaces:**
- Consumes: `useEditor`, `Fields`, `validateArtist`, `store`, `useCatalogue`.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Write the panel**

Create `src/components/admin/ArtistsPanel.tsx`:

```tsx
import type { Artist } from "../../lib/data";
import { store } from "../../lib/store";
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
    base: "",
    active: true,
    roster: true,
  };
}

/**
 * The roster.
 *
 * `roster` is the flag that separates a signed act from a catalogue credit
 * like V.A., and it is what the hero counts — so the form says so rather than
 * leaving a bare checkbox for someone to guess at.
 *
 * Deleting an artist with releases is refused by the store; the panel shows the
 * dependency count up front so the refusal is never a surprise.
 */
export default function ArtistsPanel(): React.ReactElement {
  const { artists, releases } = useCatalogue();
  const editor = useEditor<Artist>();
  const { draft, errors } = editor;

  const exists = artists.some((a) => a.key === draft?.key);
  const others = artists.filter((a) => a.key !== draft?.key);
  const dependents = draft
    ? releases.filter((r) => r.artist === draft.key).length
    : 0;

  const onSave = (): void =>
    void editor.save(
      (value) => validateArtist(value, others),
      (value) => store.saveArtist(value)
    );

  const onDelete = (): void => {
    if (!draft) return;
    if (!window.confirm(`Delete ${draft.name}? This cannot be undone.`)) return;
    void editor.save(
      () => ({}),
      async () => {
        await store.removeArtist(draft.key);
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
            onClick={() => editor.select({ ...artist, genres: [...artist.genres] })}
          >
            <span className="mono">{artist.roster ? "ROSTER" : "CREDIT"}</span>
            <span className="kern__rowname">{artist.name}</span>
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
              name="Key"
              value={draft.key}
              error={errors.key}
              hint="Lowercase slug · how releases credit this artist"
              onChange={(key) => editor.update({ key })}
            />
            <TextField
              name="Since"
              value={draft.since}
              error={errors.since}
              hint="Year"
              onChange={(since) => editor.update({ since })}
            />
          </div>

          <div className="kern__grid">
            <TextField
              name="Name"
              value={draft.name}
              error={errors.name}
              onChange={(name) => editor.update({ name })}
            />
            <TextField
              name="Kana"
              value={draft.kana}
              hint="Japanese reading · optional"
              onChange={(kana) => editor.update({ kana })}
            />
          </div>

          <TextField
            name="Genres"
            value={draft.genres.join(", ")}
            hint="Comma separated"
            onChange={(value) =>
              editor.update({
                genres: value
                  .split(",")
                  .map((genre) => genre.trim())
                  .filter(Boolean),
              })
            }
          />

          <TextField
            name="Base"
            value={draft.base}
            hint="Optional · left blank stays blank in the UI"
            onChange={(base) => editor.update({ base })}
          />

          <div className="kern__section">
            <ToggleField
              name="On the roster"
              value={draft.roster}
              hint="Off means a catalogue credit like V.A. — not counted in 012 ARTISTS"
              onChange={(roster) => editor.update({ roster })}
            />
            <ToggleField
              name="Active"
              value={draft.active}
              onChange={(active) => editor.update({ active })}
            />
          </div>

          {dependents > 0 && (
            <p className="hud fld__hint">
              {dependents} release{dependents === 1 ? "" : "s"} credit this
              artist. Reassign them before deleting.
            </p>
          )}

          <SaveBar
            status={editor.status}
            message={editor.message}
            dirty={editor.dirty}
            onSave={onSave}
            onDelete={exists && dependents === 0 ? onDelete : undefined}
            deleteLabel="Delete artist"
          />
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Mount it**

In `AdminOS.tsx`, replace the artists placeholder with `<ArtistsPanel />` and add the import.

- [ ] **Step 3: Verify by hand**

At `/admin`, section 02:
1. Select `KERN_BRECHER`. The dependency note says 1 release credits this artist, and there is no delete button.
2. `+ New` with key `Test Artist` → save → the error reads "Lowercase letters, numbers and hyphens only."
3. Fix to `testartist`, save. It appears in the list, and pressing `3` on the public site shows it in the roster with the count up by one.
4. Turn `On the roster` off and save — the hero count drops back, and the artist stays in the list marked `CREDIT`.
5. Delete it. It disappears from both.

- [ ] **Step 4: Verify the build and tests**

Run: `pnpm test && pnpm build`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin
git commit -m "feat(kernel): artists panel with roster flag and dependency guard"
```

---

### Task 5: Events and the schedule editor

**Files:**
- Create: `src/components/admin/EventsPanel.tsx`
- Create: `src/components/admin/ScheduleEditor.tsx`
- Modify: `src/components/admin/AdminOS.tsx`
- Modify: `src/styles/admin.css` (add `.sched-edit*`)

**Interfaces:**
- Consumes: `useEditor`, `Fields`, `validateEvent`, `store`, `useCatalogue`, `eventState` from `catalogue.ts`, `hash` from `data.ts`.
- Produces: `ScheduleEditor` — props `{ schedule: Slot[]; artists: Artist[]; errors: Errors; onChange(next: Slot[]): void }`.

- [ ] **Step 1: Write the schedule editor**

Create `src/components/admin/ScheduleEditor.tsx`:

```tsx
import type { Artist, Slot } from "../../lib/data";
import type { Errors } from "../../lib/store/validate";

/**
 * The running order.
 *
 * The artist is free text because most guests are not on the label, with an
 * optional link to a roster entry for the ones that are — signing a guest up
 * just to schedule them would inflate the count the hero reads.
 *
 * Rows are not sorted while you type. The store sorts by start time on save,
 * so a half-typed "2" never jumps the row out from under the cursor.
 */
export default function ScheduleEditor({
  schedule,
  artists,
  errors,
  onChange,
}: {
  schedule: Slot[];
  artists: Artist[];
  errors: Errors;
  onChange: (next: Slot[]) => void;
}): React.ReactElement {
  const patch = (index: number, changes: Partial<Slot>): void => {
    onChange(schedule.map((slot, i) => (i === index ? { ...slot, ...changes } : slot)));
  };

  return (
    <div className="sched-edit">
      <div className="kern__listhead">
        <span className="pane__title">Schedule</span>
        <button
          className="kern__new"
          onClick={() => onChange([...schedule, { start: "", artist: "" }])}
        >
          + Slot
        </button>
      </div>

      {schedule.length === 0 ? (
        <p className="hud fld__hint">
          No slots yet. The public card hides the schedule toggle until there is
          at least one.
        </p>
      ) : (
        schedule.map((slot, index) => (
          <div className="sched-edit__row" key={index}>
            <input
              className="fld__input sched-edit__time"
              value={slot.start}
              placeholder="20:00"
              aria-label={`Slot ${index + 1} start`}
              onChange={(e) => patch(index, { start: e.target.value })}
            />
            <input
              className="fld__input sched-edit__time"
              value={slot.end ?? ""}
              placeholder="20:45"
              aria-label={`Slot ${index + 1} end`}
              onChange={(e) => patch(index, { end: e.target.value || undefined })}
            />
            <input
              className="fld__input"
              value={slot.artist}
              placeholder="As it reads on the flyer"
              aria-label={`Slot ${index + 1} artist`}
              onChange={(e) => patch(index, { artist: e.target.value })}
            />
            <select
              className="fld__input sched-edit__link"
              value={slot.artistKey ?? ""}
              aria-label={`Slot ${index + 1} roster link`}
              onChange={(e) =>
                patch(index, { artistKey: e.target.value || undefined })
              }
            >
              <option value="">Guest</option>
              {artists.map((artist) => (
                <option value={artist.key} key={artist.key}>
                  {artist.name}
                </option>
              ))}
            </select>
            <button
              className="sched-edit__drop"
              aria-label={`Remove slot ${index + 1}`}
              onClick={() => onChange(schedule.filter((_, i) => i !== index))}
            >
              ✕
            </button>

            {(errors[`schedule.${index}.start`] ||
              errors[`schedule.${index}.end`] ||
              errors[`schedule.${index}.artist`]) && (
              <p className="fld__error sched-edit__err">
                {errors[`schedule.${index}.start`] ??
                  errors[`schedule.${index}.end`] ??
                  errors[`schedule.${index}.artist`]}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write the panel**

Create `src/components/admin/EventsPanel.tsx`:

```tsx
import { hash, type LabelEvent } from "../../lib/data";
import { eventState } from "../../lib/catalogue";
import { store } from "../../lib/store";
import { validateEvent } from "../../lib/store/validate";
import { useCatalogue } from "../../lib/hooks";
import { SaveBar, TextField } from "./Fields";
import ScheduleEditor from "./ScheduleEditor";
import { useEditor } from "./useEditor";

function blankEvent(): LabelEvent {
  return {
    id: "",
    date: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
    name: "",
    platform: "",
    stream: undefined,
    flyer: undefined,
    timezone: "JST",
    schedule: [],
  };
}

/**
 * The transmissions.
 *
 * There is no status field: it is derived from the date. The id is minted once
 * on first save from the date and the name, and then never moves — the
 * schedule hangs off it, and both of those fields are editable.
 */
export default function EventsPanel(): React.ReactElement {
  const { events, artists } = useCatalogue();
  const editor = useEditor<LabelEvent>();
  const { draft, errors } = editor;

  const exists = events.some((e) => e.id === draft?.id);

  const onSave = (): void =>
    void editor.save(validateEvent, (value) =>
      store.saveEvent({
        ...value,
        id: value.id || `evt-${hash(value.date + value.name)}`,
      })
    );

  const onDelete = (): void => {
    if (!draft) return;
    if (!window.confirm(`Delete ${draft.name}? This cannot be undone.`)) return;
    void store.removeEvent(draft.id).then(editor.reset);
  };

  return (
    <>
      <div className="kern__list">
        <div className="kern__listhead">
          <span className="pane__title">Events</span>
          <button className="kern__new" onClick={() => editor.select(blankEvent())}>
            + New
          </button>
        </div>

        {events.map((event) => (
          <button
            className="kern__row"
            key={event.id}
            aria-current={event.id === draft?.id}
            onClick={() =>
              editor.select({
                ...event,
                schedule: event.schedule.map((slot) => ({ ...slot })),
              })
            }
          >
            <span className="mono">{event.date}</span>
            <span className="kern__rowname">{event.name}</span>
            <span className="mono">{eventState(event.date)}</span>
          </button>
        ))}
      </div>

      {draft === null ? (
        <div className="kern__blank">
          <p className="hud">No event selected.</p>
          <button className="playcta" onClick={() => editor.select(blankEvent())}>
            Add the first one
          </button>
        </div>
      ) : (
        <div className="kern__form">
          <TextField
            name="Name"
            value={draft.name}
            error={errors.name}
            onChange={(name) => editor.update({ name })}
          />

          <div className="kern__grid">
            <TextField
              name="Date"
              value={draft.date}
              error={errors.date}
              hint="YYYY.MM.DD · the status is read off this"
              onChange={(date) => editor.update({ date })}
            />
            <TextField
              name="Timezone"
              value={draft.timezone}
              error={errors.timezone}
              hint="JST · GMT-6 — shown, never converted"
              onChange={(timezone) => editor.update({ timezone })}
            />
            <TextField
              name="Platform"
              value={draft.platform ?? ""}
              hint="TWITCH · YOUTUBE"
              onChange={(platform) => editor.update({ platform: platform || undefined })}
            />
          </div>

          <div className="kern__grid">
            <TextField
              name="Stream"
              value={draft.stream ?? ""}
              error={errors.stream}
              hint="Unset shows a gap, not a dead link"
              onChange={(stream) => editor.update({ stream: stream || undefined })}
            />
            <TextField
              name="Invitation"
              value={draft.flyer ?? ""}
              error={errors.flyer}
              hint="Path under public/ or a URL"
              onChange={(flyer) => editor.update({ flyer: flyer || undefined })}
            />
          </div>

          {draft.flyer && (
            <div className="kern__section">
              <span className="hud">Invitation</span>
              <img className="kern__flyer" src={draft.flyer} alt="" />
            </div>
          )}

          <div className="kern__section">
            <ScheduleEditor
              schedule={draft.schedule}
              artists={artists}
              errors={errors}
              onChange={(schedule) => editor.update({ schedule })}
            />
          </div>

          <SaveBar
            status={editor.status}
            message={editor.message}
            dirty={editor.dirty}
            onSave={onSave}
            onDelete={exists ? onDelete : undefined}
            deleteLabel="Delete event"
          />
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Style the schedule rows**

Append to `src/styles/admin.css`:

```css
/* ---- schedule editor ---- */
.sched-edit__row {
  display: grid;
  grid-template-columns: 6rem 6rem minmax(0, 1fr) 10rem 2rem;
  gap: 0.5rem;
  align-items: center;
  padding-block: 0.35rem;
}

.sched-edit__time {
  font-variant-numeric: tabular-nums;
}

.sched-edit__drop {
  color: var(--dim);
  font-size: var(--t-sm);
}

.sched-edit__drop:hover {
  color: var(--amber);
}

.sched-edit__err {
  grid-column: 1 / -1;
  margin: 0;
}

.kern__flyer {
  display: block;
  max-width: min(100%, 22rem);
  border: 1px solid var(--line-strong);
  margin-top: 0.5rem;
}

@media (max-width: 62rem) {
  .sched-edit__row {
    grid-template-columns: 5rem 5rem minmax(0, 1fr) 2rem;
  }

  .sched-edit__link {
    grid-column: 1 / -1;
  }
}
```

- [ ] **Step 4: Mount it**

In `AdminOS.tsx`, replace the events placeholder with `<EventsPanel />` and add the import.

- [ ] **Step 5: Verify by hand**

At `/admin`, section 03:
1. Select `KISEKI NIGHT 07`. Five slots load with their roster links set.
2. Add a slot, type `8pm` in the start, save — the error reads "Format is HH:MM." on that row only.
3. Fix it to `23:30`, put it out of order, save. Reopening shows it sorted into place.
4. Set the invitation to `/cover.png` and save. The preview renders, and on the public Events view `View invitation` opens it.
5. Set a stream URL, save, check `Watch live` appears on the public card.
6. `+ New`, fill name and date, save — the id is minted and it appears in the list.
7. Set a past date on it and confirm both the list and the public card say `ENDED`.

- [ ] **Step 6: Verify the build and tests**

Run: `pnpm test && pnpm build`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin src/styles/admin.css
git commit -m "feat(kernel): events panel with flyer preview and schedule editor"
```

---

### Task 6: Document the console

**Files:**
- Modify: `CLAUDE.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Add the section**

Add after Architecture in `CLAUDE.md`:

```markdown
## KERNEL — the console at `/admin`

A second Astro page with its own island (`components/admin/`), so none of the
editing code reaches a visitor. It is called **KERNEL**, never "admin" or
"maintenance", in every piece of user-facing copy.

- **`client:only="react"`, not `client:load`.** The console reads
  `localStorage`; server-rendering it would paint the seed and then swap.
- **`useEditor` owns the draft, the dirty flag and the save state.** Writes are
  `async` because the store's are, which is why there is a saving state at all
  — none of it changes when Firestore lands.
- **`seed` is derived, never typed.** `hash(cat + title)`, exactly as in
  `data.ts`. The form says out loud that editing either field redraws a
  generated sleeve.
- **Validation is pure and tested** (`store/validate.ts`). Slot errors are keyed
  `schedule.<index>.<field>` so a row can show its own message.
- **Deleting an artist with releases is refused by the store**, not just hidden
  in the UI — the rule lives where it cannot be bypassed.
- **Schedule rows are not sorted while you type.** The store sorts on save, so a
  half-typed hour never jumps out from under the cursor.
- There is **no authentication**. `/admin` is open and carries `noindex`. Auth
  arrives with Firestore.
```

- [ ] **Step 2: Sync and commit**

```bash
cp CLAUDE.md AGENTS.md
git add CLAUDE.md AGENTS.md
git commit -m "docs: describe the KERNEL console"
```

---

## Done when

- `/admin` creates, edits and deletes releases, artists and events.
- The on-air mark changes which record the hero boots with.
- Events take a stream link, an invitation path and a running order, and the public view shows all three.
- `pnpm test` and `pnpm build` pass.
- Nothing in the public bundle imports `components/admin/`.

## Still open

The invitation image never arrived, so `Slot` is `{ start, end?, artist, artistKey? }` — a guess. If the flyer turns out to carry b2b billing, blocks, set lengths or hosts, `Slot`, `validateEvent`, `ScheduleEditor` and `EventSchedule` all change together.
