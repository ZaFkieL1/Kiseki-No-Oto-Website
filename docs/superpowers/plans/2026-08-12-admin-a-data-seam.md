# Admin A — Data Seam Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the site off module-constant data onto a live store backed by `localStorage`, behind an interface Firestore will implement later, and rebuild events as online events with flyer and schedule.

**Architecture:** A `Store` singleton exposes `subscribe`/`getSnapshot` (the pair `deck` already uses) and async writes. `data.ts` becomes the seed. Entity types move to `store/types.ts` so nothing imports in a cycle. Components read through a `useCatalogue()` hook; helpers like `artistByKey` move to `lib/catalogue.ts` and read the snapshot internally.

**Tech Stack:** Astro 7, React 19 (single island per page), TypeScript, pnpm, Vitest (added by Task 1).

## Global Constraints

- Package manager is **pnpm**. Node >= 22.12.0.
- Writes are `async` from day one even though `localStorage` is synchronous — Firestore's will be.
- Initial read is **synchronous**: `deck` is constructed at module scope in `audio.ts` and needs a release before first render.
- Every module that touches `localStorage` must guard `typeof globalThis.localStorage === "undefined"` — Astro builds on Node and `index.astro` pulls this graph in at build time.
- No import cycles. Dependency direction is `types.ts → data.ts → seed.ts → local.ts → index.ts → catalogue.ts → components`.
- Machine-generated content uses `Martian Mono` (`--mono`), human-authored content uses `Zen Kaku Gothic New` (`--sans`). Never mix.
- Tests cover pure logic only: store, validation, derived values. No component tests.
- Placeholder data stays clearly placeholder. Only `KSK-038` and `kernbrecher` are real.

---

### Task 1: Vitest and the type foundation

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/store/types.ts`
- Modify: `src/lib/data.ts` (remove type declarations, import and re-export them)
- Test: `src/lib/store/types.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ReleaseType`, `Artist`, `Release`, `Slot`, `LabelEvent`, `EventState`, `Snapshot`, `Store` from `src/lib/store/types.ts`. `src/lib/data.ts` re-exports all of them so its 13 existing importers keep working.

- [ ] **Step 1: Add Vitest**

```bash
pnpm add -D vitest@^3
```

Then add the script to `package.json`:

```json
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "astro": "astro",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

- [ ] **Step 2: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // node, not jsdom: everything under test is pure logic. The one browser
    // API we touch (localStorage) is faked per-test in three lines.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Write the failing test**

Create `src/lib/store/types.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { LabelEvent, Release, Snapshot } from "./types";

describe("types", () => {
  it("models an online event with a schedule", () => {
    const event: LabelEvent = {
      id: "evt-1",
      date: "2026.09.12",
      name: "KISEKI NIGHT 07",
      platform: "TWITCH",
      stream: "https://twitch.tv/kisekinooto",
      flyer: "/events/kiseki-night-07.png",
      timezone: "JST",
      schedule: [{ start: "20:00", artist: "KERN_BRECHER", artistKey: "kernbrecher" }],
    };
    expect(event.schedule[0]!.artistKey).toBe("kernbrecher");
  });

  it("models a snapshot with a featured catalogue number", () => {
    const release: Release = {
      id: 38,
      cat: "KSK-038",
      title: "草SpeedRebirth",
      artist: "kernbrecher",
      type: "SINGLE",
      date: "2026.08.11",
      tracks: 1,
      seed: 1,
      hue: 340,
      bpm: 0,
      duration: 0,
    };
    const snapshot: Snapshot = {
      releases: [release],
      artists: [],
      events: [],
      featured: "KSK-038",
      origin: "seed",
    };
    expect(snapshot.featured).toBe("KSK-038");
  });
});
```

- [ ] **Step 4: Run it and watch it fail**

Run: `pnpm test`
Expected: FAIL — `Cannot find module './types'`.

- [ ] **Step 5: Write the types**

Create `src/lib/store/types.ts`:

```ts
/**
 * Every entity shape in one place, with no imports of its own.
 *
 * These used to live in `data.ts`. They moved here so `data.ts` can be the
 * seed — if the types stayed there, `data.ts` would have to import the store
 * for its helpers and the store would have to import `data.ts` for the seed.
 */

export type ReleaseType = "ALBUM" | "EP" | "SINGLE" | "COMP" | "REMIX";

export interface Artist {
  key: string;
  name: string;
  kana: string;
  genres: string[];
  since: string;
  base: string;
  active: boolean;
  /** V.A. is a catalogue credit, not a roster member. Feeds the hero count. */
  roster: boolean;
}

export interface Release {
  id: number;
  /** Catalogue number, e.g. KSK-037. The key. */
  cat: string;
  title: string;
  /** An `Artist.key`. */
  artist: string;
  type: ReleaseType;
  /** YYYY.MM.DD */
  date: string;
  tracks: number;
  /** Derived from hash(cat + title). Never captured by hand. */
  seed: number;
  hue: number;
  bpm: number;
  /** Fallback only. For real files the deck reads duration off the element. */
  duration: number;
  audio?: string;
  cover?: string;
  desktopArtwork?: string;
  bandcamp?: string;
}

export interface Slot {
  /** HH:MM, in the event's own timezone. */
  start: string;
  end?: string;
  /** As printed on the flyer. */
  artist: string;
  /** Optional link to a roster entry. Guests from outside stay text. */
  artistKey?: string;
}

export interface LabelEvent {
  id: string;
  /** YYYY.MM.DD */
  date: string;
  name: string;
  /** TWITCH · YOUTUBE — takes the place the venue used to hold. */
  platform?: string;
  stream?: string;
  /** Path under public/ or a URL. */
  flyer?: string;
  /** JST · GMT-6. Displayed, never converted. */
  timezone: string;
  schedule: Slot[];
}

/** Derived from the date. Deliberately not a stored field. */
export type EventState = "SCHEDULED" | "ENDED";

export interface Snapshot {
  releases: Release[];
  artists: Artist[];
  events: LabelEvent[];
  /** Catalogue number of the record the hero boots with. */
  featured: string | null;
  /** Where this came from. Shown in the admin header. */
  origin: "seed" | "local";
}

export interface Store {
  subscribe(listener: () => void): () => void;
  getSnapshot(): Snapshot;

  saveRelease(release: Release): Promise<void>;
  removeRelease(cat: string): Promise<void>;
  saveArtist(artist: Artist): Promise<void>;
  removeArtist(key: string): Promise<void>;
  saveEvent(event: LabelEvent): Promise<void>;
  removeEvent(id: string): Promise<void>;
  setFeatured(cat: string): Promise<void>;
  resetToSeed(): Promise<void>;
}
```

- [ ] **Step 6: Point `data.ts` at the new types**

In `src/lib/data.ts`, delete the `ReleaseType`, `Artist`, `Release` and `LabelEvent` declarations and add at the top of the file, under the existing header comment:

```ts
import type {
  Artist,
  LabelEvent,
  Release,
  ReleaseType,
  Slot,
} from "./store/types";

/** Re-exported so the thirteen files that import types from here keep working. */
export type { Artist, LabelEvent, Release, ReleaseType, Slot };
```

Leave every other export in `data.ts` untouched for now — `label`, `TYPE_LABEL`, `releaseMeta`, `mulberry32`, `hash`, `formatTime`, `artists`, `roster`, `releases`, `events`, `shop`, `artistByKey`, `releaseByCat`, `releasesByArtist`. Task 5 moves the helpers.

Note: `data.ts` will not typecheck against the new `LabelEvent` yet — its `events` array still has `venue`, `city` and `state`. Task 2 rewrites it. Vite strips types at build so this does not break `pnpm build` in the meantime.

- [ ] **Step 7: Run the tests**

Run: `pnpm test`
Expected: PASS, 2 tests.

- [ ] **Step 8: Verify the site still builds**

Run: `pnpm build`
Expected: `[build] Complete!`

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts src/lib/store/types.ts src/lib/store/types.test.ts src/lib/data.ts
git commit -m "feat(store): add vitest and lift entity types out of data.ts"
```

---

### Task 2: Reshape the events seed

**Files:**
- Modify: `src/lib/data.ts` (the `events` array)
- Test: `src/lib/data.test.ts`

**Interfaces:**
- Consumes: `LabelEvent`, `Slot` from Task 1.
- Produces: `events: LabelEvent[]` in `src/lib/data.ts` — six online events, ids stable, sorted newest first.

- [ ] **Step 1: Write the failing test**

Create `src/lib/data.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { events, releases, roster } from "./data";

describe("events seed", () => {
  it("has no venue-era fields left", () => {
    for (const event of events) {
      expect(event).not.toHaveProperty("venue");
      expect(event).not.toHaveProperty("city");
      expect(event).not.toHaveProperty("state");
    }
  });

  it("gives every event a stable id and a timezone", () => {
    const ids = events.map((e) => e.id);
    expect(new Set(ids).size).toBe(events.length);
    for (const event of events) {
      expect(event.timezone).not.toBe("");
    }
  });

  it("runs newest first", () => {
    const dates = events.map((e) => e.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it("carries at least one worked example of a schedule", () => {
    const withSchedule = events.filter((e) => e.schedule.length > 0);
    expect(withSchedule.length).toBeGreaterThan(0);
    for (const slot of withSchedule[0]!.schedule) {
      expect(slot.start).toMatch(/^\d{2}:\d{2}$/);
    }
  });
});

describe("catalogue seed", () => {
  it("still has the real record and the roster", () => {
    expect(releases.some((r) => r.cat === "KSK-038")).toBe(true);
    expect(roster.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test src/lib/data.test.ts`
Expected: FAIL — events still have `venue`, `city` and `state`.

- [ ] **Step 3: Replace the events block**

In `src/lib/data.ts`, replace the whole `events` section (the `LabelEvent` interface is already gone from Task 1; replace the `export const events` array) with:

```ts
/* -------------------------------------------------------------------------
   events — the label streams, it does not book rooms
   ------------------------------------------------------------------------- */

/**
 * Placeholder except for the shape. Real dates, links and flyers go in
 * through the admin.
 *
 * There is no `state` field: it is derived from the date in `catalogue.ts`,
 * because a hand-set status is a status that goes stale.
 */
export const events: LabelEvent[] = [
  {
    id: "evt-kiseki-night-07",
    date: "2026.09.12",
    name: "KISEKI NIGHT 07",
    platform: "TWITCH",
    stream: undefined,
    flyer: undefined,
    timezone: "JST",
    schedule: [
      { start: "20:00", end: "20:45", artist: "senko", artistKey: "senko" },
      { start: "20:45", end: "21:30", artist: "lumen", artistKey: "lumen" },
      { start: "21:30", end: "22:15", artist: "KERN_BRECHER", artistKey: "kernbrecher" },
      { start: "22:15", end: "23:00", artist: "nekodrive", artistKey: "nekodrive" },
      { start: "23:00", end: "24:00", artist: "GUEST TBA" },
    ],
  },
  {
    id: "evt-hardcore-syndrome",
    date: "2026.08.29",
    name: "HARDCORE SYNDROME",
    platform: "YOUTUBE",
    stream: undefined,
    flyer: undefined,
    timezone: "JST",
    schedule: [
      { start: "21:00", end: "22:00", artist: "hyperkoto", artistKey: "hyperkoto" },
      { start: "22:00", end: "23:00", artist: "voidpop", artistKey: "voidpop" },
    ],
  },
  {
    id: "evt-antigravity-release-party",
    date: "2026.08.15",
    name: "ANTIGRAVITY RELEASE PARTY",
    platform: "TWITCH",
    stream: undefined,
    flyer: undefined,
    timezone: "JST",
    schedule: [],
  },
  {
    id: "evt-summer-overdrive",
    date: "2026.07.04",
    name: "SUMMER OVERDRIVE",
    platform: "YOUTUBE",
    stream: undefined,
    flyer: undefined,
    timezone: "JST",
    schedule: [],
  },
  {
    id: "evt-kiseki-night-06",
    date: "2026.05.30",
    name: "KISEKI NIGHT 06",
    platform: "TWITCH",
    stream: undefined,
    flyer: undefined,
    timezone: "JST",
    schedule: [],
  },
  {
    id: "evt-breakcore-funeral",
    date: "2026.04.11",
    name: "BREAKCORE FUNERAL",
    platform: "TWITCH",
    stream: undefined,
    flyer: undefined,
    timezone: "GMT+2",
    schedule: [],
  },
];
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test src/lib/data.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Check what broke**

Run: `pnpm build`
Expected: PASS. `EventsView.tsx` still reads `event.venue`, `event.city` and `event.state`, which are now `undefined` at runtime — Vite strips types, so the build succeeds and the view renders "undefined · undefined". Task 7 rebuilds it. Do not patch it here.

- [ ] **Step 6: Commit**

```bash
git add src/lib/data.ts src/lib/data.test.ts
git commit -m "feat(events): reshape the seed as online events with schedules"
```

---

### Task 3: The localStorage adapter

**Files:**
- Create: `src/lib/store/seed.ts`
- Create: `src/lib/store/local.ts`
- Test: `src/lib/store/local.test.ts`

**Interfaces:**
- Consumes: `Snapshot` from Task 1, `releases`/`artists`/`events` from Task 2.
- Produces: `buildSeed(): Snapshot` and `DEFAULT_FEATURED: string` from `seed.ts`; `STORAGE_KEY: string`, `readSnapshot(): Snapshot`, `writeSnapshot(s: Snapshot): void`, `clearSnapshot(): void` from `local.ts`.

- [ ] **Step 1: Write the seed module**

Create `src/lib/store/seed.ts`:

```ts
import { artists, events, releases } from "../data";
import type { Snapshot } from "./types";

/** The record the hero boots with until someone marks another one. */
export const DEFAULT_FEATURED = "KSK-038";

/**
 * A fresh copy of the shipped catalogue.
 *
 * Deep-copied on purpose: the store mutates nothing, but a shallow copy would
 * let a stray edit reach back into the module constants and poison every
 * later reset.
 */
export function buildSeed(): Snapshot {
  return {
    releases: releases.map((release) => ({ ...release })),
    artists: artists.map((artist) => ({
      ...artist,
      genres: [...artist.genres],
    })),
    events: events.map((event) => ({
      ...event,
      schedule: event.schedule.map((slot) => ({ ...slot })),
    })),
    featured: DEFAULT_FEATURED,
    origin: "seed",
  };
}
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/store/local.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import {
  STORAGE_KEY,
  clearSnapshot,
  readSnapshot,
  writeSnapshot,
} from "./local";

/** Three lines instead of jsdom. */
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage;
}

beforeEach(() => {
  globalThis.localStorage = fakeStorage();
});

describe("readSnapshot", () => {
  it("seeds when storage is empty", () => {
    const snapshot = readSnapshot();
    expect(snapshot.origin).toBe("seed");
    expect(snapshot.releases.length).toBeGreaterThan(0);
    expect(snapshot.featured).toBe("KSK-038");
  });

  it("round-trips what was written", () => {
    const seed = buildSeed();
    seed.featured = "KSK-012";
    writeSnapshot(seed);

    const read = readSnapshot();
    expect(read.origin).toBe("local");
    expect(read.featured).toBe("KSK-012");
    expect(read.releases.length).toBe(seed.releases.length);
  });

  it("falls back to the seed when the payload is not parseable", () => {
    globalThis.localStorage.setItem(STORAGE_KEY, "{ not json");
    expect(readSnapshot().origin).toBe("seed");
  });

  it("falls back to the seed when the schema version is wrong", () => {
    globalThis.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 99, releases: [], artists: [], events: [], featured: null })
    );
    expect(readSnapshot().origin).toBe("seed");
  });

  it("falls back to the seed when a required array is missing", () => {
    globalThis.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, releases: [], artists: [] })
    );
    expect(readSnapshot().origin).toBe("seed");
  });

  it("survives having no localStorage at all", () => {
    // @ts-expect-error — deleting a global on purpose, this is the SSR case
    delete globalThis.localStorage;
    expect(readSnapshot().origin).toBe("seed");
  });
});

describe("clearSnapshot", () => {
  it("puts reading back on the seed", () => {
    writeSnapshot(buildSeed());
    expect(readSnapshot().origin).toBe("local");
    clearSnapshot();
    expect(readSnapshot().origin).toBe("seed");
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `pnpm test src/lib/store/local.test.ts`
Expected: FAIL — `Cannot find module './local'`.

- [ ] **Step 4: Write the adapter**

Create `src/lib/store/local.ts`:

```ts
import { buildSeed } from "./seed";
import type { Snapshot } from "./types";

export const STORAGE_KEY = "kiseki.store.v1";
const VERSION = 1;

/**
 * The persisted shape. `origin` is not stored — it describes where the
 * snapshot in hand came from, which storage cannot know about itself.
 */
interface Persisted {
  version: number;
  releases: Snapshot["releases"];
  artists: Snapshot["artists"];
  events: Snapshot["events"];
  featured: Snapshot["featured"];
}

/** Undefined during the Astro build, which runs on Node. */
function storage(): Storage | null {
  return typeof globalThis.localStorage === "undefined"
    ? null
    : globalThis.localStorage;
}

function isPersisted(value: unknown): value is Persisted {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<Persisted>;
  return (
    candidate.version === VERSION &&
    Array.isArray(candidate.releases) &&
    Array.isArray(candidate.artists) &&
    Array.isArray(candidate.events)
  );
}

/**
 * Anything unreadable falls back to the seed rather than throwing. A stored
 * value from an older schema must never be able to take the site down.
 */
export function readSnapshot(): Snapshot {
  const store = storage();
  if (!store) return buildSeed();

  const raw = store.getItem(STORAGE_KEY);
  if (raw === null) return buildSeed();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return buildSeed();
  }
  if (!isPersisted(parsed)) return buildSeed();

  return {
    releases: parsed.releases,
    artists: parsed.artists,
    events: parsed.events,
    featured: parsed.featured ?? null,
    origin: "local",
  };
}

export function writeSnapshot(snapshot: Snapshot): void {
  const store = storage();
  if (!store) return;

  const payload: Persisted = {
    version: VERSION,
    releases: snapshot.releases,
    artists: snapshot.artists,
    events: snapshot.events,
    featured: snapshot.featured,
  };
  store.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearSnapshot(): void {
  storage()?.removeItem(STORAGE_KEY);
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm test src/lib/store/local.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/store/seed.ts src/lib/store/local.ts src/lib/store/local.test.ts
git commit -m "feat(store): localStorage adapter with seed fallback"
```

---

### Task 4: The store singleton

**Files:**
- Create: `src/lib/store/index.ts`
- Test: `src/lib/store/index.test.ts`

**Interfaces:**
- Consumes: `Store`, `Snapshot` from Task 1; `readSnapshot`/`writeSnapshot`/`clearSnapshot`/`STORAGE_KEY` from Task 3.
- Produces: `createStore(): Store` and `store: Store` from `src/lib/store/index.ts`. Sorting rule: `releases` and `events` are kept sorted by `date` descending after every write.

- [ ] **Step 1: Write the failing test**

Create `src/lib/store/index.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "./index";
import type { Release } from "./types";

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage;
}

function draft(cat: string, date: string): Release {
  return {
    id: Number(cat.slice(-3)),
    cat,
    title: `TEST ${cat}`,
    artist: "senko",
    type: "EP",
    date,
    tracks: 3,
    seed: 1,
    hue: 200,
    bpm: 180,
    duration: 200,
  };
}

beforeEach(() => {
  globalThis.localStorage = fakeStorage();
});

describe("createStore", () => {
  it("starts from the seed", () => {
    const store = createStore();
    expect(store.getSnapshot().origin).toBe("seed");
  });

  it("notifies subscribers on write and stops after unsubscribe", async () => {
    const store = createStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    await store.saveRelease(draft("KSK-900", "2027.01.01"));
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    await store.saveRelease(draft("KSK-901", "2027.02.01"));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("hands out a new snapshot object per write", async () => {
    const store = createStore();
    const before = store.getSnapshot();
    await store.saveRelease(draft("KSK-900", "2027.01.01"));
    expect(store.getSnapshot()).not.toBe(before);
  });

  it("upserts a release by catalogue number and keeps dates descending", async () => {
    const store = createStore();
    await store.saveRelease(draft("KSK-900", "2020.01.01"));
    await store.saveRelease(draft("KSK-901", "2030.01.01"));

    const dates = store.getSnapshot().releases.map((r) => r.date);
    expect([...dates].sort().reverse()).toEqual(dates);

    const edited = { ...draft("KSK-900", "2020.01.01"), title: "EDITED" };
    await store.saveRelease(edited);
    const matches = store.getSnapshot().releases.filter((r) => r.cat === "KSK-900");
    expect(matches).toHaveLength(1);
    expect(matches[0]!.title).toBe("EDITED");
  });

  it("moves the featured mark and never holds two", async () => {
    const store = createStore();
    await store.setFeatured("KSK-012");
    expect(store.getSnapshot().featured).toBe("KSK-012");
    await store.setFeatured("KSK-020");
    expect(store.getSnapshot().featured).toBe("KSK-020");
  });

  it("refuses to feature a catalogue number that does not exist", async () => {
    const store = createStore();
    await expect(store.setFeatured("KSK-999")).rejects.toThrow(/KSK-999/);
  });

  it("re-points the featured mark when the featured release is removed", async () => {
    const store = createStore();
    await store.setFeatured("KSK-038");
    await store.removeRelease("KSK-038");

    const snapshot = store.getSnapshot();
    expect(snapshot.releases.some((r) => r.cat === "KSK-038")).toBe(false);
    expect(snapshot.featured).toBe(snapshot.releases[0]!.cat);
  });

  it("refuses to remove an artist that still has releases", async () => {
    const store = createStore();
    await expect(store.removeArtist("kernbrecher")).rejects.toThrow(/1 release/);
  });

  it("removes an artist with no releases", async () => {
    const store = createStore();
    await store.saveArtist({
      key: "orphan",
      name: "ORPHAN",
      kana: "",
      genres: [],
      since: "2026",
      base: "",
      active: true,
      roster: true,
    });
    await store.removeArtist("orphan");
    expect(store.getSnapshot().artists.some((a) => a.key === "orphan")).toBe(false);
  });

  it("persists across a reload", async () => {
    const first = createStore();
    await first.setFeatured("KSK-012");

    const second = createStore();
    expect(second.getSnapshot().origin).toBe("local");
    expect(second.getSnapshot().featured).toBe("KSK-012");
  });

  it("resets to the seed", async () => {
    const store = createStore();
    await store.setFeatured("KSK-012");
    await store.resetToSeed();
    expect(store.getSnapshot().origin).toBe("seed");
    expect(store.getSnapshot().featured).toBe("KSK-038");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test src/lib/store/index.test.ts`
Expected: FAIL — `Cannot find module './index'`.

- [ ] **Step 3: Write the store**

Create `src/lib/store/index.ts`:

```ts
import { STORAGE_KEY, clearSnapshot, readSnapshot, writeSnapshot } from "./local";
import { buildSeed } from "./seed";
import type { Artist, LabelEvent, Release, Snapshot, Store } from "./types";

/** Newest first, everywhere, so no view has to sort defensively. */
function byDateDesc<T extends { date: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * The live catalogue.
 *
 * `subscribe` + `getSnapshot` is the same pair `deck` exposes in `audio.ts`,
 * consumed with `useSyncExternalStore`. Reads are synchronous because the deck
 * is built at module scope and needs a record before the first render; writes
 * are async because Firestore's will be, and a UI written against synchronous
 * writes has nowhere to put a saving state.
 */
function createLocalStore(): Store {
  let snapshot = readSnapshot();
  const listeners = new Set<() => void>();

  const emit = (): void => {
    for (const listener of listeners) listener();
  };

  const commit = async (next: Snapshot): Promise<void> => {
    snapshot = next;
    writeSnapshot(snapshot);
    emit();
  };

  // Edit in /admin, watch the site tab update. Costs five lines.
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (event.key !== STORAGE_KEY) return;
      snapshot = readSnapshot();
      emit();
    });
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },

    getSnapshot() {
      return snapshot;
    },

    async saveRelease(release: Release) {
      const others = snapshot.releases.filter((r) => r.cat !== release.cat);
      await commit({
        ...snapshot,
        origin: "local",
        releases: byDateDesc([...others, release]),
      });
    },

    async removeRelease(cat: string) {
      const releases = snapshot.releases.filter((r) => r.cat !== cat);
      // A dangling mark would leave the hero with no record at all.
      const featured =
        snapshot.featured === cat ? releases[0]?.cat ?? null : snapshot.featured;
      await commit({ ...snapshot, origin: "local", releases, featured });
    },

    async saveArtist(artist: Artist) {
      const others = snapshot.artists.filter((a) => a.key !== artist.key);
      await commit({
        ...snapshot,
        origin: "local",
        artists: [...others, artist].sort((a, b) => a.name.localeCompare(b.name)),
      });
    },

    async removeArtist(key: string) {
      const dependents = snapshot.releases.filter((r) => r.artist === key);
      if (dependents.length > 0) {
        throw new Error(
          `${dependents.length} release${dependents.length === 1 ? "" : "s"} still credit this artist. Reassign them first.`
        );
      }
      await commit({
        ...snapshot,
        origin: "local",
        artists: snapshot.artists.filter((a) => a.key !== key),
      });
    },

    async saveEvent(event: LabelEvent) {
      const others = snapshot.events.filter((e) => e.id !== event.id);
      const schedule = [...event.schedule].sort((a, b) =>
        a.start.localeCompare(b.start)
      );
      await commit({
        ...snapshot,
        origin: "local",
        events: byDateDesc([...others, { ...event, schedule }]),
      });
    },

    async removeEvent(id: string) {
      await commit({
        ...snapshot,
        origin: "local",
        events: snapshot.events.filter((e) => e.id !== id),
      });
    },

    async setFeatured(cat: string) {
      if (!snapshot.releases.some((r) => r.cat === cat)) {
        throw new Error(`${cat} is not in the catalogue.`);
      }
      await commit({ ...snapshot, origin: "local", featured: cat });
    },

    async resetToSeed() {
      clearSnapshot();
      snapshot = buildSeed();
      emit();
    },
  };
}

/** Exported for tests, which need a store per fake storage. */
export const createStore = createLocalStore;

export const store: Store = createLocalStore();
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test src/lib/store/index.test.ts`
Expected: PASS, 12 tests.

If `removeArtist("kernbrecher")` does not reject, check that the seed's real release credits `kernbrecher` — the error message asserts on "1 release".

- [ ] **Step 5: Commit**

```bash
git add src/lib/store/index.ts src/lib/store/index.test.ts
git commit -m "feat(store): live catalogue singleton with async writes"
```

---

### Task 5: Derived values and the catalogue helpers

**Files:**
- Create: `src/lib/catalogue.ts`
- Modify: `src/lib/data.ts` (delete `roster`, `artistByKey`, `releaseByCat`, `releasesByArtist`)
- Modify: `src/components/releases/ReleaseBackground.tsx:4`, `src/components/releases/ReleaseArtwork.tsx:1`, `src/components/releases/ReleaseInfo.tsx:1`, `src/components/TransportDock.tsx:1`, `src/components/views/ArchiveView.tsx:1`, `src/components/views/ArtistsView.tsx:1` (import path only)
- Test: `src/lib/catalogue.test.ts`

**Interfaces:**
- Consumes: `store` from Task 4.
- Produces: from `src/lib/catalogue.ts` — `roster(): Artist[]`, `artistByKey(key: string): Artist`, `releaseByCat(cat: string): Release | undefined`, `releasesByArtist(key: string): Release[]`, `featuredRelease(): Release`, `eventState(date: string, now?: Date): EventState`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/catalogue.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { artistByKey, eventState, featuredRelease, releasesByArtist, roster } from "./catalogue";

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage;
}

beforeEach(() => {
  globalThis.localStorage = fakeStorage();
});

describe("eventState", () => {
  const now = new Date(2026, 7, 12, 12, 0, 0); // 2026.08.12, midday

  it("calls a future date scheduled", () => {
    expect(eventState("2026.09.12", now)).toBe("SCHEDULED");
  });

  it("calls a past date ended", () => {
    expect(eventState("2026.07.04", now)).toBe("ENDED");
  });

  it("keeps today scheduled until the day is over", () => {
    expect(eventState("2026.08.12", now)).toBe("SCHEDULED");
  });
});

describe("roster", () => {
  it("excludes catalogue-only credits", () => {
    expect(roster().every((artist) => artist.roster)).toBe(true);
  });
});

describe("artistByKey", () => {
  it("finds a seeded artist", () => {
    expect(artistByKey("kernbrecher").name).toBe("KERN_BRECHER");
  });

  it("returns a readable placeholder for an unknown key", () => {
    expect(artistByKey("nobody").name).toBe("UNKNOWN");
  });
});

describe("releasesByArtist", () => {
  it("returns only that artist's records", () => {
    const rows = releasesByArtist("kernbrecher");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.artist === "kernbrecher")).toBe(true);
  });
});

describe("featuredRelease", () => {
  it("returns the marked record", () => {
    expect(featuredRelease().cat).toBe("KSK-038");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test src/lib/catalogue.test.ts`
Expected: FAIL — `Cannot find module './catalogue'`.

- [ ] **Step 3: Write the helpers**

Create `src/lib/catalogue.ts`:

```ts
import { store } from "./store";
import type { Artist, EventState, Release } from "./store/types";

/**
 * Reads of the live catalogue.
 *
 * These take no snapshot argument on purpose: their callers are always
 * rendered under a component that subscribes, so they repaint when the data
 * changes without every leaf having to thread state down.
 */

export function roster(): Artist[] {
  return store.getSnapshot().artists.filter((artist) => artist.roster);
}

const UNKNOWN: Artist = {
  key: "unknown",
  name: "UNKNOWN",
  kana: "",
  genres: [],
  since: "",
  base: "",
  active: false,
  roster: false,
};

/** Never throws: a missing credit must not take a release scene down. */
export function artistByKey(key: string): Artist {
  return store.getSnapshot().artists.find((a) => a.key === key) ?? UNKNOWN;
}

export function releaseByCat(cat: string): Release | undefined {
  return store.getSnapshot().releases.find((release) => release.cat === cat);
}

export function releasesByArtist(key: string): Release[] {
  return store.getSnapshot().releases.filter((release) => release.artist === key);
}

/** What the hero boots with. Falls back to the newest record. */
export function featuredRelease(): Release {
  const { releases, featured } = store.getSnapshot();
  return releases.find((release) => release.cat === featured) ?? releases[0]!;
}

/**
 * Derived rather than stored: a hand-set status is a status nobody remembers
 * to change. The event stays scheduled until its own day is over, in the
 * reader's local time — close enough without pretending we can resolve a
 * free-text timezone label.
 */
export function eventState(date: string, now: Date = new Date()): EventState {
  const [year, month, day] = date.split(".").map(Number);
  const endOfDay = new Date(year!, month! - 1, day!, 23, 59, 59);
  return now.getTime() > endOfDay.getTime() ? "ENDED" : "SCHEDULED";
}
```

- [ ] **Step 4: Strip the moved helpers out of `data.ts`**

In `src/lib/data.ts`, delete these four exports — they now live in `catalogue.ts`:

- `export const roster = artists.filter((a) => a.roster);`
- `export function artistByKey(...)`
- `export function releaseByCat(...)`
- `export function releasesByArtist(...)`

Keep `export const artists`, `export const releases`, `export const events` — the seed still needs them.

- [ ] **Step 5: Repoint the six importers**

One import line each. Nothing else in these files changes.

- `src/components/releases/ReleaseBackground.tsx:4` → `import { artistByKey } from "../../lib/catalogue";`
- `src/components/releases/ReleaseArtwork.tsx:1` → split into `import type { Release } from "../../lib/data";` and `import { artistByKey } from "../../lib/catalogue";`
- `src/components/releases/ReleaseInfo.tsx:1` → `import { releaseMeta, type Release } from "../../lib/data";` plus `import { artistByKey } from "../../lib/catalogue";`
- `src/components/TransportDock.tsx:1` → `import { formatTime } from "../lib/data";` plus `import { artistByKey } from "../lib/catalogue";`
- `src/components/views/ArchiveView.tsx:1` → `import { releases } from "../../lib/data";` plus `import { artistByKey } from "../../lib/catalogue";` (Task 6 replaces the `releases` import)
- `src/components/views/ArtistsView.tsx:1` → `import { releasesByArtist, roster } from "../../lib/catalogue";` plus `import { releases } from "../../lib/data";` (Task 6 replaces both)

Note: `roster` is now a function. In `ArtistsView.tsx` change `roster.map` to `roster().map` and `roster.length` to `roster().length`. Same in any other file that reads it — Task 6 covers `BootSequence.tsx` and `SignalPanel.tsx`.

- [ ] **Step 6: Run the tests**

Run: `pnpm test`
Expected: PASS, all suites.

- [ ] **Step 7: Verify the build**

Run: `pnpm build`
Expected: `[build] Complete!`

- [ ] **Step 8: Commit**

```bash
git add src/lib/catalogue.ts src/lib/catalogue.test.ts src/lib/data.ts src/components
git commit -m "feat(store): move catalogue reads onto the live snapshot"
```

---

### Task 6: Read the store from the interface

**Files:**
- Modify: `src/lib/hooks.ts` (add `useCatalogue`)
- Modify: `src/lib/audio.ts:14` and the deck's initial release
- Modify: `src/components/LabelOS.tsx`, `src/components/BootSequence.tsx`, `src/components/system/SignalPanel.tsx`, `src/components/releases/ReleaseDatabase.tsx`, `src/components/views/ArtistsView.tsx`, `src/components/views/ArchiveView.tsx`

**Interfaces:**
- Consumes: `store` from Task 4, `featuredRelease`/`roster` from Task 5.
- Produces: `useCatalogue(): Snapshot` from `src/lib/hooks.ts`.

- [ ] **Step 1: Add the hook**

In `src/lib/hooks.ts`, add alongside the existing `useDeck`:

```ts
import { store } from "./store";
import type { Snapshot } from "./store/types";

/**
 * The live catalogue. Same shape as `useDeck` — the store is another external
 * source of truth that has to outlive any one component.
 */
export function useCatalogue(): Snapshot {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot
  );
}
```

Make sure `useSyncExternalStore` is in the file's React import. The third argument is the server snapshot: the same function, because the store returns the seed under Node.

- [ ] **Step 2: Boot the deck from the featured record**

In `src/lib/audio.ts`, change line 14 from:

```ts
import { mulberry32, releases, type Release } from "./data";
```

to:

```ts
import { mulberry32, type Release } from "./data";
import { featuredRelease } from "./catalogue";
```

Then find where the deck initialises its release (`releases[0]`) and replace it with `featuredRelease()`.

Also update the file's header comment, which tells the reader to set `audio` on the release "in `data.ts`": records are edited in `/admin` now, and `data.ts` is only the seed.

- [ ] **Step 3: Fix the module-scope read in `LabelOS.tsx`**

`VIEWS` is built at module scope and interpolates `releases.length` into the access line `"38 RELEASES FOUND"`. Left alone, that number freezes at whatever the build shipped.

Move the array inside the component. Replace `const VIEWS: ViewDef[] = [ ... ];` with a builder above the component:

```ts
function buildViews(releaseCount: number): ViewDef[] {
  return [
    /* ...the existing six entries verbatim, with the releases entry's access
       line reading `${releaseCount} RELEASES FOUND` ... */
  ];
}
```

and inside `LabelOS`:

```ts
const { releases } = useCatalogue();
const VIEWS = useMemo(() => buildViews(releases.length), [releases.length]);
```

`useMemo` is already imported. Keep the comment above the array — the digits are still the keyboard shortcuts.

Watch for the two other places in `LabelOS` that use view state: `VIEWS.find(...)` in `go` and `active`. They now close over the memoised array, so add `VIEWS` to the `useCallback` dependency list for `go`.

- [ ] **Step 4: Switch the remaining five components**

Each one drops its `data` import for the arrays and reads the hook instead:

- `BootSequence.tsx:2` — delete `import { releases, roster } from "../lib/data";`. Add `import { useCatalogue } from "../lib/hooks";`. Inside the component: `const { releases, artists } = useCatalogue();` and compute `const rosterCount = artists.filter((a) => a.roster).length;`. `SCRIPT` is a module constant that interpolates both counts, so move it into the component the same way as `VIEWS`: a `buildScript(releaseCount, rosterCount)` function memoised with `useMemo`.
- `SignalPanel.tsx:1-7` — drop `releases` and `roster` from the `data` import, add `const { releases, artists } = useCatalogue();` and derive the roster count locally. Keep `TYPE_LABEL`, `formatTime` from `data`, and take `artistByKey` from `../../lib/catalogue`.
- `ReleaseDatabase.tsx:2` — replace with `const { releases } = useCatalogue();`.
- `ArtistsView.tsx:1` — replace with `const { releases } = useCatalogue();` and `roster()` from `catalogue.ts`.
- `ArchiveView.tsx:1` — replace with `const { releases } = useCatalogue();`.

- [ ] **Step 5: Verify by hand**

Run: `pnpm astro dev --background`, then open `http://localhost:4321`.

Check, in order:
1. The boot log reports 38 releases and 12 artists.
2. `01 SYSTEM` loads `KSK-038` in the signal column and the catalogue index reads `001 / 038`.
3. Pressing `2` shows `38 RELEASES FOUND` in the access sequence.
4. In DevTools, `localStorage.setItem("kiseki.store.v1", ...)` is absent until something writes — the site is running off the seed, which is correct at this stage.

- [ ] **Step 6: Verify the build and tests**

Run: `pnpm test && pnpm build`
Expected: all tests pass, `[build] Complete!`

- [ ] **Step 7: Commit**

```bash
git add src/lib/hooks.ts src/lib/audio.ts src/components
git commit -m "feat(store): read the catalogue through useCatalogue"
```

---

### Task 7: Events as online events

**Files:**
- Modify: `src/components/views/EventsView.tsx` (rewrite)
- Create: `src/components/events/EventCard.tsx`
- Create: `src/components/events/EventSchedule.tsx`
- Modify: `src/styles/global.css` (replace the `.state--*` block, add `.evt*`)

**Interfaces:**
- Consumes: `useCatalogue` from Task 6, `eventState`/`artistByKey` from Task 5, `LabelEvent`/`Slot` from Task 1.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Write the schedule component**

Create `src/components/events/EventSchedule.tsx`:

```tsx
import { artistByKey } from "../../lib/catalogue";
import type { Slot } from "../../lib/store/types";

/**
 * The running order, in the event's own timezone.
 *
 * Times are shown exactly as they were captured — the flyer is the source, and
 * converting them would put the site and the flyer at odds. The timezone label
 * travels with them so the reader can do the arithmetic themselves.
 */
export default function EventSchedule({
  schedule,
  timezone,
}: {
  schedule: Slot[];
  timezone: string;
}): React.ReactElement {
  return (
    <div className="sched">
      <p className="hud sched__tz">All times {timezone}</p>
      <ol className="sched__list">
        {schedule.map((slot) => {
          const linked = slot.artistKey ? artistByKey(slot.artistKey) : null;
          return (
            <li className="sched__slot" key={slot.start + slot.artist}>
              <span className="mono sched__time">
                {slot.start}
                {slot.end ? `–${slot.end}` : ""}
              </span>
              <span className="sched__artist">{slot.artist}</span>
              {linked && linked.kana && (
                <span className="jp sched__kana">{linked.kana}</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
```

- [ ] **Step 2: Write the card**

Create `src/components/events/EventCard.tsx`:

```tsx
import { useState } from "react";
import { eventState } from "../../lib/catalogue";
import type { LabelEvent } from "../../lib/store/types";
import EventSchedule from "./EventSchedule";

/**
 * One transmission. The stream link is the primary action while the event is
 * still ahead; the flyer and the running order are the two things a reader
 * actually wants before deciding to show up.
 *
 * Anything unset shows as a visible gap rather than a dead control — same rule
 * the Bandcamp button follows.
 */
export default function EventCard({
  event,
}: {
  event: LabelEvent;
}): React.ReactElement {
  const [showSchedule, setShowSchedule] = useState(false);
  const state = eventState(event.date);
  const hasSchedule = event.schedule.length > 0;

  return (
    <article className={`evt evt--${state.toLowerCase()}`}>
      <header className="evt__head">
        <span className="row__meta evt__date">{event.date}</span>
        <span className={`state state--${state.toLowerCase()}`}>{state}</span>
      </header>

      <h2 className="evt__name">{event.name}</h2>
      <p className="evt__sub hud">
        {event.platform ?? "PLATFORM TBA"} · {event.timezone}
      </p>

      <div className="evt__actions">
        {event.stream ? (
          <a
            className="playcta"
            href={event.stream}
            target="_blank"
            rel="noopener noreferrer"
            data-cursor="external_link"
          >
            {state === "ENDED" ? "Open channel" : "Watch live"}
            <span aria-hidden="true">↗</span>
          </a>
        ) : (
          <span className="hud evt__unset">Stream link not set</span>
        )}

        {event.flyer ? (
          <a
            className="evt__link"
            href={event.flyer}
            target="_blank"
            rel="noopener noreferrer"
            data-cursor="open flyer"
          >
            View invitation ↗
          </a>
        ) : (
          <span className="hud evt__unset">No invitation</span>
        )}

        {hasSchedule && (
          <button
            className="evt__link"
            onClick={() => setShowSchedule((open) => !open)}
            aria-expanded={showSchedule}
            data-cursor={showSchedule ? "hide schedule" : "show schedule"}
          >
            Schedule ({event.schedule.length}) {showSchedule ? "↑" : "↓"}
          </button>
        )}
      </div>

      {showSchedule && (
        <EventSchedule schedule={event.schedule} timezone={event.timezone} />
      )}
    </article>
  );
}
```

- [ ] **Step 3: Rewrite the view**

Replace `src/components/views/EventsView.tsx` entirely:

```tsx
import { eventState } from "../../lib/catalogue";
import { useCatalogue } from "../../lib/hooks";
import EventCard from "../events/EventCard";

export default function EventsView(): React.ReactElement {
  const { events } = useCatalogue();
  const upcoming = events.filter((e) => eventState(e.date) === "SCHEDULED");

  return (
    <div>
      <div className="pane__head">
        <span className="pane__title">Events</span>
        <span className="jp">イベント</span>
        <span className="hud pane__count">{upcoming.length} upcoming</span>
      </div>

      {events.length === 0 ? (
        <p className="hud empty">No transmissions scheduled.</p>
      ) : (
        <div className="stack">
          {events.map((event) => (
            <EventCard event={event} key={event.id} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Style it**

In `src/styles/global.css`, find the `.state--open` / `.state--gone` / `.state--past` rules and replace them with `.state--scheduled` and `.state--ended`, keeping the same colours (`--hot` for live, `--dimmer` for past). Then add, in the events section:

```css
/* ---- events ---- */
.evt {
  display: grid;
  gap: 0.35rem;
  padding: clamp(1.25rem, 3vh, 2rem) var(--gut);
  border-bottom: 1px solid var(--line);
}

.evt--ended {
  color: var(--dim);
}

.evt__head {
  display: flex;
  align-items: baseline;
  gap: 1rem;
}

.evt__name {
  font-family: var(--sans);
  font-weight: 900;
  font-size: clamp(1.25rem, 2.4vw, 2rem);
  line-height: 1.05;
  letter-spacing: -0.02em;
  margin: 0.2rem 0 0;
}

.evt__sub {
  margin: 0;
}

.evt__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
}

.evt__link {
  font-family: var(--mono);
  font-size: var(--t-sm);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--hot-ink);
  border-bottom: 1px solid transparent;
  transition: border-color 140ms var(--ease);
}

.evt__link:hover {
  border-bottom-color: var(--hot);
}

.evt__unset {
  color: var(--dimmer);
}

/* The running order. Mono throughout: these are machine facts. */
.sched {
  margin-top: 1.25rem;
  border-left: 1px solid var(--line-strong);
  padding-left: clamp(1rem, 2vw, 1.75rem);
  animation: reveal 320ms var(--ease-snap) both;
}

.sched__tz {
  margin: 0 0 0.75rem;
}

.sched__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}

.sched__slot {
  display: flex;
  align-items: baseline;
  gap: 1.25rem;
}

.sched__time {
  font-size: var(--t-sm);
  color: var(--hot-ink);
  min-width: 8.5rem;
}

/* Human names in the human face, machine times in the machine face. */
.sched__artist {
  font-family: var(--sans);
  font-weight: 700;
}

.sched__kana {
  font-size: var(--t-sm);
}

.empty {
  padding: var(--gut);
  color: var(--dimmer);
}
```

- [ ] **Step 5: Verify by hand**

With the dev server running, press `5` for Events and check:
1. `KISEKI NIGHT 07` shows `SCHEDULED`, `BREAKCORE FUNERAL` shows `ENDED`.
2. The two events with schedules show a `Schedule (5)` / `Schedule (2)` toggle; the four without show none.
3. Every event shows `Stream link not set` and `No invitation` — correct, the seed has neither.
4. Nothing renders the word `undefined`.

- [ ] **Step 6: Verify the build and tests**

Run: `pnpm test && pnpm build`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/events src/components/views/EventsView.tsx src/styles/global.css
git commit -m "feat(events): online events with flyer and running order"
```

---

### Task 8: Document the seam

**Files:**
- Modify: `CLAUDE.md`
- Modify: `AGENTS.md` (copy of `CLAUDE.md`)

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

- [ ] **Step 1: Update the commands table**

Add the test rows and correct the paragraph that says there is no test runner:

```markdown
| `pnpm test` | Run the unit tests once |
| `pnpm test:watch` | Run them in watch mode |
```

Replace the sentence "There is no test runner and no linter/formatter configured, so there is no test or lint command to run; don't invent one." with:

```markdown
Vitest covers pure logic only — the store, its validation, and derived values.
There are deliberately no component tests: canvas, `useSyncExternalStore` and
`AudioContext` make them expensive and fragile, and they are most of this code.
There is still no linter or formatter; don't invent one.
```

- [ ] **Step 2: Replace the data paragraph**

Replace the "**Most catalogue data is invented placeholder content**" paragraph with:

```markdown
**`src/lib/data.ts` is the seed, not the source.** The live catalogue is
`src/lib/store/` — a `subscribe`/`getSnapshot` singleton backed by
`localStorage`, read through `useCatalogue()`. On first run it copies `data.ts`
into storage; from then on storage wins, and `resetToSeed()` is the way back.
Writes are `async` even though `localStorage` is not, because Firestore's will
be. Entity types live in `store/types.ts` so nothing imports in a cycle.

**Most catalogue data is invented placeholder content.** Only `KSK-038` and
`kernbrecher` are real; every other record, artist and event is fiction.
Replace the data, keep the shapes.
```

- [ ] **Step 3: Correct the catalogue-order note**

The bullet that says `REAL_RELEASES` is listed first "so the newest real record is what boots loaded" is no longer true. Replace that clause with:

```markdown
The catalogue is sorted by date descending and the deck boots with whatever
release carries the `featured` mark, falling back to the newest.
```

- [ ] **Step 4: Add the events note**

Under "What this is", add:

```markdown
**Events are online.** `LabelEvent` has a `platform` and a `stream` where a
venue and a city used to be, a `flyer` (the invitation image), a `timezone`
label and a `schedule` of slots. There is no stored `state`: it is derived from
the date in `catalogue.ts`, because a hand-set status goes stale. Times are
displayed exactly as captured and never converted — the flyer is the source.
```

- [ ] **Step 5: Add the noscript caveat**

Under Architecture, add a bullet:

```markdown
- **The `<noscript>` listing is built from the seed, not the store.**
  `index.astro` renders at build time and cannot read `localStorage`. It will
  show the shipped catalogue rather than live edits, and still will under
  Firestore while the site builds static. That is accepted, not a bug.
```

- [ ] **Step 6: Sync `AGENTS.md`**

```bash
cp CLAUDE.md AGENTS.md
```

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md AGENTS.md
git commit -m "docs: describe the store seam, online events and the noscript caveat"
```

---

## Done when

- `pnpm test` passes with suites for types, seed data, the localStorage adapter, the store, and the catalogue helpers.
- `pnpm build` completes.
- The site boots from the store: counts, the featured record and the catalogue all come from `useCatalogue()`.
- Events render as online events with a working schedule toggle.
- Nothing writes to the store yet — that is Plan B.
