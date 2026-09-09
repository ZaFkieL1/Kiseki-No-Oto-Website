import { artists, events, releases } from "../data";
import type { Featured, Snapshot } from "./types";

/** The song the hero boots with until someone marks another one. */
export const DEFAULT_FEATURED: Featured = { cat: "KNOSNG-0001", track: 0 };

/**
 * A fresh copy of the shipped catalogue.
 *
 * Deep-copied on purpose: the store mutates nothing, but a shallow copy would
 * let a stray edit reach back into the module constants and poison every later
 * reset.
 */
export function buildSeed(): Snapshot {
  return {
    releases: releases.map((release) => ({
      ...release,
      tracks: release.tracks.map((track) => ({ ...track })),
    })),
    artists: artists.map((artist) => ({
      ...artist,
      genres: [...artist.genres],
    })),
    events: events.map((event) => ({
      ...event,
      schedule: event.schedule.map((slot) => ({ ...slot })),
    })),
    // Nothing shipped: where the label can be found is typed into KERNEL, and
    // an invented handle is a link that goes to somebody else.
    socials: [],
    featured: { ...DEFAULT_FEATURED },
    origin: "seed",
  };
}
