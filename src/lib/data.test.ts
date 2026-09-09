import { describe, expect, it } from "vitest";
import { artists, events, firstPlayable, releases, trackSource } from "./data";

describe("trackSource", () => {
  const song = { title: "ONE", artist: "senko" };

  it("plays the uploaded file when there is one", () => {
    expect(
      trackSource({ ...song, file: "/media/audio/K/1-a.mp3" })
    ).toBe("/media/audio/K/1-a.mp3");
  });

  /* The link is a destination, not a source — but the one real seeded record
     keeps a playable path there, so it stays the fallback. */
  it("falls back to the link when nothing is uploaded", () => {
    expect(trackSource({ ...song, audio: "/local.mp3" })).toBe("/local.mp3");
  });

  it("never lets the link win over the file", () => {
    const both = { ...song, audio: "https://x.bandcamp.com/track/a", file: "/media/audio/K/1-a.mp3" };
    expect(trackSource(both)).toBe("/media/audio/K/1-a.mp3");
  });

  it("is undefined for a song with neither, and for no song at all", () => {
    expect(trackSource(song)).toBeUndefined();
    expect(trackSource(undefined)).toBeUndefined();
  });

  /* Handing a page to an `<audio>` element is not a slow load, it is an error
     the deck repeats on every press. Nothing is the right answer: the synth
     takes it from there. */
  it("refuses a link that is a page rather than a file", () => {
    expect(
      trackSource({ ...song, audio: "https://x.bandcamp.com/track/a" })
    ).toBeUndefined();
    expect(
      trackSource({ ...song, audio: "https://soundcloud.com/x/y" })
    ).toBeUndefined();
  });

  it("accepts a file link wherever it is hosted, query string and all", () => {
    expect(trackSource({ ...song, audio: "https://cdn.x/a.mp3?v=2" })).toBe(
      "https://cdn.x/a.mp3?v=2"
    );
    expect(trackSource({ ...song, audio: "/a.FLAC" })).toBe("/a.FLAC");
  });

  it("is what firstPlayable searches by", () => {
    const release = {
      ...releases[0]!,
      tracks: [song, { ...song, file: "/media/audio/K/2-b.mp3" }],
    };
    expect(firstPlayable(release)).toBe(1);
  });
});

/*
 * These used to check the shape of six invented events and twenty invented
 * records. The fiction is gone, so the thing worth guarding is that it stays
 * gone: a seed is what the site shows before the cloud answers, and inventing
 * a record announces a release that does not exist.
 */
describe("the seed ships nothing invented", () => {
  it("carries no events at all", () => {
    expect(events).toHaveLength(0);
  });

  it("carries only the acts that are real", () => {
    expect(artists.map((artist) => artist.key)).toEqual(["kernbrecher"]);
  });

  it("carries only records with a file actually behind them", () => {
    expect(releases.length).toBeGreaterThan(0);
    for (const release of releases) {
      expect(release.tracks.some((track) => trackSource(track))).toBe(true);
    }
  });

  it("credits nobody who is not on the roster", () => {
    const keys = new Set(artists.map((artist) => artist.key));
    for (const release of releases) {
      for (const track of release.tracks) expect(keys).toContain(track.artist);
    }
  });
});

describe("catalogue seed", () => {
  it("still has the real record and the artists", () => {
    expect(releases.some((r) => r.cat === "KNOSNG-0001")).toBe(true);
    expect(artists.length).toBeGreaterThan(0);
  });
});
