import type { Artist, Release, ReleaseType } from "./types";

/**
 * The catalogue's own rules, kept away from any one backend.
 *
 * These used to live inside the localStorage adapter, which meant the
 * Firestore adapter had to restate them and could drift. They are pure, so
 * they are also the part worth testing.
 */

/* -------------------------------------------------------------------------
   catalogue numbers
   ------------------------------------------------------------------------- */

/**
 * The prefix each kind of record is filed under.
 *
 * Every record used to be `KSK-###` whatever it was, so the number said nothing
 * about the release. Each type runs its own series now — `KNOEP-0001` and
 * `KNOSNG-0001` both exist — which is what makes the prefix worth carrying: the
 * number tells you how many EPs the label has put out, not where the record
 * sits in one undifferentiated pile.
 *
 * Separate from `TYPE_LABEL` in `data.ts` on purpose. That is what a reader is
 * shown (`REMIX` reads as `REMIXES`); this is what the record is filed under.
 */
export const CAT_PREFIX: Record<ReleaseType, string> = {
  ALBUM: "KNOLP",
  EP: "KNOEP",
  SINGLE: "KNOSNG",
  COMP: "KNOCOMP",
  REMIX: "KNORMX",
};

const CAT_DIGITS = 4;

/**
 * The shape of a catalogue number — for one type, or for any of them.
 *
 * **This is the only place the format is written.** It used to be spelled out
 * by hand in `validate.ts` and again in the KERNEL form, which meant the shape
 * that was accepted and the shape that was minted could drift apart. Both read
 * this now.
 */
export function catPattern(type?: ReleaseType): RegExp {
  const prefixes = type ? [CAT_PREFIX[type]] : Object.values(CAT_PREFIX);
  return new RegExp(`^(${prefixes.join("|")})-\\d{${CAT_DIGITS}}$`);
}

/** Whether a record is filed under the right prefix for what it is. */
export function catMatchesType(cat: string, type: ReleaseType): boolean {
  return catPattern(type).test(cat);
}

/**
 * The next free number in a type's series.
 *
 * Deliberately the highest one used plus one, not the count plus one: deleting
 * `KNOEP-0002` out of the middle must not hand its number to the next record.
 * A number that has been published belongs to what was published under it.
 */
export function nextCat(type: ReleaseType, releases: Release[]): string {
  const prefix = CAT_PREFIX[type];
  const shape = catPattern(type);
  const highest = releases.reduce((max, release) => {
    if (!shape.test(release.cat)) return max;
    return Math.max(max, Number(release.cat.slice(prefix.length + 1)));
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(CAT_DIGITS, "0")}`;
}

/**
 * An artist's key, from their name.
 *
 * Derived rather than typed: it is the document id and what every track
 * credits, so it is not something anyone should be editing by hand. It is
 * minted once when the artist is created and then **frozen** — renaming an act
 * changes the name, never the key, or every song crediting them would point at
 * nothing.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Two acts can share a name. Two documents cannot share an id. */
export function uniqueKey(name: string, taken: Artist[]): string {
  const base = slugify(name);
  if (!base) return "";

  const used = new Set(taken.map((artist) => artist.key));
  if (!used.has(base)) return base;

  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** Newest first, everywhere, so no view has to sort defensively. */
export function byDateDesc<T extends { date: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.date.localeCompare(a.date));
}

export function byName<T extends { name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The label's acts. A guest is credited on their songs but is not on the list.
 *
 * Kept here, taking the array rather than reading the store, because it is the
 * rule and not the read: `roster()` is the one caller, and everything that
 * shows or counts the roster goes through that.
 */
export function publicRoster(artists: Artist[]): Artist[] {
  return artists.filter((artist) => !artist.guest);
}

/**
 * Removing an artist that records still credit would leave those releases
 * pointing at nothing. Thrown rather than returned: this is a refusal, and the
 * save bar shows the message.
 */
export function assertArtistRemovable(key: string, releases: Release[]): void {
  const dependents = releases.filter((release) =>
    release.tracks.some((track) => track.artist === key)
  );
  if (dependents.length === 0) return;
  throw new Error(
    `${dependents.length} release${dependents.length === 1 ? "" : "s"} still credit this artist. Reassign them first.`
  );
}

/** You cannot put a song on air that the catalogue does not have. */
export function assertFeaturable(
  cat: string,
  track: number,
  releases: Release[]
): void {
  const release = releases.find((r) => r.cat === cat);
  if (!release) throw new Error(`${cat} is not in the catalogue.`);
  if (track < 0 || track >= release.tracks.length) {
    throw new Error(`${cat} has no track ${track + 1}.`);
  }
}

/**
 * Where the featured mark lands when the record holding it is deleted — the
 * newest survivor, or nothing at all if that was the last record.
 */
export function reFeature(
  removed: string,
  remaining: Release[]
): { cat: string; track: number } | null {
  const next = remaining.find((release) => release.cat !== removed);
  return next ? { cat: next.cat, track: 0 } : null;
}
