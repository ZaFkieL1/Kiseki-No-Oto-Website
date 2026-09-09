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
  active: boolean;
  /**
   * Where the act lives — their Bandcamp, SoundCloud, Instagram, anywhere.
   *
   * The card in `03 ARTISTS` is this link. Unset leaves the card as a card:
   * information, with nothing to press. A profile the label does not have is a
   * gap, never a control that goes nowhere.
   */
  link?: string;
  /**
   * An act that appears on a record without being on the label.
   *
   * Guests are credited on their songs like anyone else — the key still has to
   * exist for a track to point at it — but they are kept out of the public
   * roster and out of the counts that describe it. Absent means not a guest.
   */
  guest?: boolean;
}

/**
 * One song. A single has one of these; an album has as many as it has.
 *
 * **The artist lives here, not on the release.** The label publishes the
 * record; the songs are what carry a credit. That is what makes a compilation
 * work without a record-level artist, and it is why a release has no artist
 * field at all.
 *
 * The sleeve is not here on purpose — artwork belongs to the release, so a
 * twelve-track album is not twelve upload prompts.
 */
export interface Track {
  title: string;
  /** An `Artist.key`. */
  artist: string;
  /**
   * Where the song lives out on the web — Bandcamp, SoundCloud, wherever.
   *
   * **This is a destination, not a source.** It is what a row in the release
   * scene opens in a new tab, it is typed by hand, and **nothing may overwrite
   * it** — uploading a file writes `file`, which is a different question with a
   * different answer.
   */
  audio?: string;
  /**
   * The uploaded file, in R2. What the deck actually plays.
   *
   * Kept apart from `audio` because a record can have either, both or neither:
   * a song can be up on Bandcamp with nothing uploaded here, or uploaded here
   * with nowhere to send anyone yet.
   */
  file?: string;
  /** Seconds. 0 or absent means the deck reads it off the file. */
  duration?: number;
  /** Tempo of this song. A record does not have one tempo; a song does. */
  bpm?: number;
}

export interface Release {
  /**
   * Catalogue number, e.g. `KNOSNG-0001`. The key, and the document id.
   *
   * The prefix says what kind of record it is and each type runs its own
   * series — `CAT_PREFIX` and `nextCat` in `rules.ts` own the whole format.
   *
   * There was an `id: number` beside this once, whose only reader was the line
   * that minted the next number. The number lives in here now and the counter
   * is derived from the catalogue, so a second identifier next to the real one
   * was just the next thing to get out of step.
   */
  cat: string;
  title: string;
  type: ReleaseType;
  /** YYYY.MM.DD */
  date: string;
  /** The songs, in running order. Each carries its own credit. */
  tracks: Track[];
  /** Derived from hash(cat + title). Never captured by hand. */
  seed: number;
  /** Accent colour. Sampled from a real sleeve at runtime when there is one. */
  hue: number;
  /** Square sleeve, uploaded through KERNEL. Replaces the generated one. */
  cover?: string;
  /** Where the full release lives. The scene's primary action. */
  link?: string;
  /**
   * A taste of the whole record — one uploaded file, not a track.
   *
   * Separate from `tracks[].audio` because it answers a different question:
   * a track's file is that song, this is the record. It is what PLAY PREVIEW
   * in the release scene runs, and the only audio a visitor can start from
   * there. Unset means the scene shows no preview control at all.
   */
  preview?: string;
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

/**
 * Where the label can be found. One row, one network.
 *
 * `name` is written out rather than chosen from a list on purpose: a fixed set
 * of networks is a set that is wrong the moment the label joins a new one, and
 * the name is what the reader sees — so it says exactly what the label calls it.
 *
 * These replaced a `contact` block of three hardcoded fields (email, Bandcamp,
 * Instagram) that lived in `data.ts` and could only be changed by editing the
 * repo. Editable things belong in Firestore.
 */
export interface Social {
  name: string;
  url: string;
}

/** Derived from the date. Deliberately not a stored field. */
export type EventState = "SCHEDULED" | "ENDED";

/** Which song the hero boots with — a record, and one track inside it. */
export interface Featured {
  cat: string;
  /** Index into `Release.tracks`. */
  track: number;
}

export interface Snapshot {
  releases: Release[];
  artists: Artist[];
  events: LabelEvent[];
  socials: Social[];
  featured: Featured | null;
  /** Where this came from. Shown in the KERNEL header. */
  origin: "seed" | "local";
}

export interface Store {
  subscribe(listener: () => void): () => void;
  getSnapshot(): Snapshot;

  saveRelease(release: Release): Promise<void>;
  removeRelease(cat: string): Promise<void>;
  /**
   * Move a record to a different catalogue number.
   *
   * Its own operation rather than a save followed by a remove, because
   * `removeRelease` reassigns the on-air mark when it deletes the record
   * holding it — through a rename that would hand `meta/featured` to some
   * unrelated release instead of following the record to its new number.
   */
  renumberRelease(from: string, to: string): Promise<void>;
  saveArtist(artist: Artist): Promise<void>;
  removeArtist(key: string): Promise<void>;
  saveEvent(event: LabelEvent): Promise<void>;
  removeEvent(id: string): Promise<void>;
  setFeatured(cat: string, track: number): Promise<void>;
  /** The whole list at once: it is one document, not a collection. */
  saveSocials(socials: Social[]): Promise<void>;
}
