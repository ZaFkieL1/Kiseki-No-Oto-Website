import { firstPlayable, label, releaseArtistKeys } from "./data";
import { store } from "./store";
import { publicRoster } from "./store/rules";
import type { Artist, EventState, Release } from "./store/types";

/**
 * Reads of the live catalogue.
 *
 * These take no snapshot argument on purpose: their callers are always
 * rendered under a component that subscribes, so they repaint when the data
 * changes without every leaf having to thread state down.
 */

/**
 * The label's acts — everyone credited on a record who is not a guest.
 *
 * `guest` is set in KERNEL, per artist. A guest still has a full entry, because
 * a track has to be able to credit them, but the public roster is the label's
 * own list and a one-off feature is not on it.
 *
 * **This is the only place that decides who is on the roster.** Anything that
 * shows the list or counts it reads from here, so the number under the hero and
 * the artist database can never disagree.
 */
export function roster(): Artist[] {
  return publicRoster(store.getSnapshot().artists);
}

const UNKNOWN: Artist = {
  key: "unknown",
  name: "UNKNOWN",
  kana: "",
  genres: [],
  since: "",
  active: false,
};

/** Never throws: a missing credit must not take a release scene down. */
export function artistByKey(key: string): Artist {
  return store.getSnapshot().artists.find((a) => a.key === key) ?? UNKNOWN;
}

export function releaseByCat(cat: string): Release | undefined {
  return store.getSnapshot().releases.find((release) => release.cat === cat);
}

export function releasesByArtist(key: string): Release[] {
  return store
    .getSnapshot()
    .releases.filter((release) =>
      release.tracks.some((track) => track.artist === key)
    );
}

/**
 * What to print where a record's artist used to go.
 *
 * One name when the whole record is one act, `V.A.` when it is several — the
 * credit a compilation has always carried — and the label itself when the
 * running order is still empty.
 */
export function releaseCredit(release: Release): string {
  const keys = releaseArtistKeys(release);
  if (keys.length === 0) return label.name;
  if (keys.length === 1) return artistByKey(keys[0]!).name;
  return "V.A.";
}

/**
 * What the hero boots with, as a record and a song inside it.
 *
 * Falls back the whole way down: an unset or dangling mark lands on the newest
 * record's first playable track rather than leaving the deck with nothing.
 */
export function featuredTrack(): { release: Release; track: number } {
  const { releases, featured } = store.getSnapshot();
  const marked = featured
    ? releases.find((release) => release.cat === featured.cat)
    : undefined;
  const release = marked ?? releases[0]!;

  const track =
    marked && featured && featured.track < release.tracks.length
      ? featured.track
      : firstPlayable(release);

  return { release, track };
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
