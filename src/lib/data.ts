/**
 * KISEKI NO OTO — 奇跡の音
 *
 * **This file is the seed, not the source.** The catalogue lives in Firestore;
 * this is what the interface draws in the moment before the cloud answers, and
 * what `astro build` puts in the `<noscript>` listing.
 *
 * It held an invented catalogue once — twenty records, twelve acts, six
 * streams — so an empty site had something to show. That is gone. Everything
 * here is real, because a seed of fiction is fiction that gets displayed, and
 * on a label site that means announcing records and dates that do not exist.
 * Keep it that way: add to the catalogue through KERNEL, not here.
 */

import type {
  Artist,
  Featured,
  LabelEvent,
  Release,
  ReleaseType,
  Slot,
  Track,
} from "./store/types";

/** Re-exported so the files that import types from here keep working. */
export type { Artist, Featured, LabelEvent, Release, ReleaseType, Slot, Track };

/* -------------------------------------------------------------------------
   the label itself
   ------------------------------------------------------------------------- */

/**
 * Identity copy, kept as data so SYSTEM reads as a record the interface is
 * displaying rather than as prose hardcoded into a page. Edit here.
 */
export const label = {
  name: "KISEKI NO OTO",
  kana: "奇跡ノ音",

  /**
   * Prose carries both languages; names and glyphs do not have two versions.
   * Read through `pick()` in `i18n.ts`, which takes whichever is current.
   *
   * The words here come from the label's own description of itself — a
   * Colombian net-label for J-Core and Jaycore, geek sounds, limitless energy,
   * a vision of its own — rather than from anything invented for a demo.
   */
  descriptor: { es: "NET-LABEL COLOMBIANA", en: "COLOMBIAN NET-LABEL" },
  origin: "COLOMBIA",

  /**
   * The brush lockup already contains the name, so it stands in for the
   * wordmark in SYSTEM rather than sitting beside it.
   *
   * Served as a 900px webp (160KB) generated from `public/KNO blanco.png`
   * (1024px, 1.4MB) — the original is far too heavy for a hero image. The
   * artwork has an opaque black ground rather than transparency, which is why
   * it is composited with `mix-blend-mode: screen`.
   */
  logo: {
    src: "/logo-kno.webp",
    alt: "Kiseki no Oto",
  },
  /**
   * One row under the lockup — the band the label is tuned across. Every entry
   * has to be something it actually puts out: this line once carried invented
   * genres to look wider than the label was, which is the only reason it was
   * cut back. Hardtek and Hardcore are named here because they are real, not to
   * make up a count.
   *
   * Read by `index.astro` twice over — the meta description and the
   * `MusicGroup` JSON-LD `genre` — so a name added here is also what a crawler
   * is told the label releases.
   */
  genres: ["J-CORE", "JAYCORE", "HARDTEK", "HARDCORE"],
  tagline: {
    es: "SONIDOS GEEK, ENERGÍA SIN LÍMITE Y VISIÓN PROPIA.",
    en: "GEEK SOUNDS, LIMITLESS ENERGY, A VISION OF ITS OWN.",
  },

  /** The name, broken into its parts. The glyphs are the same in any language. */
  etymology: [
    {
      romaji: "KISEKI",
      glyph: "奇跡",
      meaning: { es: "MILAGRO", en: "MIRACLE" },
    },
    { romaji: "OTO", glyph: "音", meaning: { es: "SONIDO", en: "SOUND" } },
  ],
  translation: { es: "EL SONIDO DE LOS MILAGROS", en: "THE SOUND OF MIRACLES" },

  /**
   * The label's own words, in its three beats: what it is, what it is made of,
   * and where it stands. Nothing here is written for it.
   */
  manifest: {
    headline: {
      es: "Net-label colombiana de J-Core y Jaycore.",
      en: "A Colombian net-label for J-Core and Jaycore.",
    },
    body: {
      es: "Nacida de la cultura geek, movida por la energía, y construida alrededor de artistas con algo propio que decir.",
      en: "Born from geek culture, driven by energy, and built around artists with something of their own to say.",
    },
    creed: {
      es: "No seguimos el género. Lo empujamos hacia adelante.",
      en: "We don't follow the genre. We push it forward.",
    },
  },

  active: true,

  /**
   * Where a reader can put money behind the label. Kept here rather than as a
   * row in `meta/socials` because it is not a place the label posts from — it
   * is an ask, and it reads as one: its own control, under the links.
   */
  support: "https://ko-fi.com/wearehardcore7771gmailcom",

  /*
   * There is no `contact` block here any more. It was three hardcoded fields —
   * email, Bandcamp, Instagram — which meant changing where the label could be
   * found was a code edit and a deploy. Social links are rows in `meta/socials`
   * now, typed into KERNEL, and `01 SYSTEM` reads them off the store.
   */
} as const;

/**
 * The Focus readout, in the hero and in the manifest.
 *
 * Derived, because it was a second copy of `genres` typed out by hand — add a
 * genre to the list and Focus went on saying what it said last month. A fact
 * the site states twice is a fact the site will eventually contradict itself
 * about. Not translated: genre names do not have two versions.
 */
export function focus(): string {
  return label.genres.join(" · ");
}

/** Catalogue shorthand expanded for display. */
export const TYPE_LABEL: Record<ReleaseType, string> = {
  ALBUM: "ALBUM",
  EP: "EP",
  SINGLE: "SINGLE",
  COMP: "COMPILATION",
  REMIX: "REMIXES",
};

/** "EP · 04 TRACKS · 2026" — the count is omitted while there are none. */
export function releaseMeta(release: Release): string {
  const parts = [TYPE_LABEL[release.type]];
  if (release.tracks.length > 0) {
    parts.push(`${String(release.tracks.length).padStart(2, "0")} TRACKS`);
  }
  parts.push(release.date.slice(0, 4));
  return parts.join(" · ");
}

/** What a browser will actually decode, as opposed to navigate to. */
const PLAYABLE = /\.(mp3|wav|flac|ogg|oga|m4a|mp4|aac|opus|webm)(\?|#|$)/i;

/**
 * What to play for a song, if anything.
 *
 * The uploaded file first: that is a file we put in the bucket and know is
 * audio. `audio` is a fallback **only when it names a file** — it is a
 * destination typed by hand, and a Bandcamp page handed to an `<audio>` element
 * is not a slow load, it is an error the deck then repeats on every press. The
 * one real seeded record keeps its track as a path under `public/`, which is
 * why the fallback exists at all.
 *
 * Returning nothing is a good outcome, not a failure: the deck answers it by
 * synthesising a signal, so a record whose songs live on Bandcamp still plays
 * something rather than breaking the transport.
 *
 * **Everything that reaches for audio goes through here**, so the destination
 * and the source can never be confused for each other again.
 */
export function trackSource(track: Track | undefined): string | undefined {
  if (track?.file) return track.file;
  if (track?.audio && PLAYABLE.test(track.audio)) return track.audio;
  return undefined;
}

/** The first song with a file behind it, if any. What the deck reaches for. */
export function firstPlayable(release: Release): number {
  const index = release.tracks.findIndex((track) => trackSource(track));
  return index === -1 ? 0 : index;
}

/**
 * Who is on a record, in running order, without repeats.
 *
 * A release has no artist of its own — the label publishes it and the songs
 * carry the credits — so this is the only honest way to ask the question.
 */
export function releaseArtistKeys(release: Release): string[] {
  return [...new Set(release.tracks.map((track) => track.artist))].filter(
    Boolean
  );
}

/* -------------------------------------------------------------------------
   deterministic pseudo-random — same seed, same artwork, forever
   ------------------------------------------------------------------------- */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The seed function. Exported because KERNEL derives `Release.seed` the same
 * way — a record created there has to draw the same sleeve as one seeded here.
 */
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* -------------------------------------------------------------------------
   roster
   ------------------------------------------------------------------------- */

/*
 * KERN_BRECHER is a real act with a real record in public/.
 *
 * There were twelve invented acts under this line, and twenty invented records
 * below them, to give an empty site something to draw. The catalogue is real
 * now and lives in Firestore, so the fiction went — it was appearing in the
 * roster, in the counts, and in the deck when a song ended and the transport
 * rolled into the next record. The empty genre and since fields here are
 * honestly unknown rather than guessed; fill them in.
 */
const ARTIST_TABLE = `
kernbrecher|KERN_BRECHER||||1
`;

export const artists: Artist[] = ARTIST_TABLE.trim()
  .split("\n")
  .map((line) => {
    const [key, name, kana, genres, since, active] = line.split("|");
    return {
      key: key!,
      name: name!,
      kana: kana!,
      // Unknown fields stay empty so the UI can omit them instead of
      // rendering a blank tag.
      genres: genres!.split(",").filter(Boolean),
      since: since!,
      active: active === "1",
    };
  });

/* -------------------------------------------------------------------------
   catalogue — newest first
   ------------------------------------------------------------------------- */

/**
 * The real catalogue, and the whole of the seed.
 *
 * Twenty invented records used to follow this one so an empty site had a
 * catalogue to draw. They are gone: the real catalogue is in Firestore, and
 * fiction sitting beside it was fiction the deck would eventually play.
 *
 * What is left is the one record with an actual file behind it, which is what
 * the first paint needs — `featuredTrack()` reads `releases[0]` before the
 * cloud has answered, so **this array must never be empty.**
 */
const REAL_RELEASES: Release[] = [
  {
    cat: "KNOSNG-0001",
    title: "草SpeedRebirth",
    type: "SINGLE",
    date: "2026.08.11",
    tracks: [
      {
        title: "草SpeedRebirth",
        artist: "kernbrecher",
        audio: "/KERN_BRECHER - 草SpeedRebirth - 01 草SpeedRebirth.mp3",
        // 0 = unknown; the deck reads the true duration off the element.
        duration: 0,
      },
    ],
    seed: hash("KNOSNG-0001草SpeedRebirth"),
    // Replaced at runtime by the dominant hue sampled from the sleeve.
    hue: 340,
    cover: "/cover.png",
    // Add the release URL here and the scene's primary action goes live.
    // Left unset deliberately rather than guessed — a wrong link is worse
    // than a visibly missing one.
    link: undefined,
  },
];

export const releases: Release[] = REAL_RELEASES;

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/* -------------------------------------------------------------------------
   events — the label streams, it does not book rooms
   ------------------------------------------------------------------------- */

/**
 * Empty, and correctly so.
 *
 * Six invented streams used to sit here. Unlike the catalogue there is nothing
 * real to keep — and an invented event is worse than an invented record: it
 * announces a date. Events go in through KERNEL and arrive from Firestore.
 *
 * There is no `state` field: it is derived from the date in `catalogue.ts`,
 * because a hand-set status is a status that goes stale.
 */
export const events: LabelEvent[] = [];

/* -------------------------------------------------------------------------
   shop
   ------------------------------------------------------------------------- */

export interface ShopItem {
  sku: string;
  name: string;
  variant: string;
  price: string;
  stock: number;
}

export const shop: ShopItem[] = [
  {
    sku: "GD-014",
    name: "ANTIGRAVITY SUGAR",
    variant: "CD + OBI STRIP",
    price: "¥2,400",
    stock: 62,
  },
  {
    sku: "GD-013",
    name: "KISEKI_OS TERMINAL TEE",
    variant: "BLACK / S–XXL",
    price: "¥4,200",
    stock: 118,
  },
  {
    sku: "GD-012",
    name: "CRUSH DEPTH",
    variant: "12\" CLEAR VINYL",
    price: "¥5,800",
    stock: 0,
  },
  {
    sku: "GD-011",
    name: "LABEL STICKER PACK",
    variant: "8 PIECES",
    price: "¥900",
    stock: 340,
  },
  {
    sku: "GD-010",
    name: "SAKURA BREAKER IS DEAD",
    variant: "CD + ART BOOK",
    price: "¥3,600",
    stock: 0,
  },
  {
    sku: "GD-009",
    name: "KISEKI ARCHIVE VOL.04",
    variant: "2CD",
    price: "¥3,000",
    stock: 27,
  },
];
