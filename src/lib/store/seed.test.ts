import { describe, expect, it } from "vitest";
import { DEFAULT_FEATURED, buildSeed } from "./seed";

describe("buildSeed", () => {
  it("marks a song that exists and has a file behind it", () => {
    const seed = buildSeed();
    const release = seed.releases.find((r) => r.cat === DEFAULT_FEATURED.cat);
    expect(release).toBeDefined();
    expect(release!.tracks[DEFAULT_FEATURED.track]?.audio).toBeTruthy();
  });

  it("hands out a copy nobody else holds a reference to", () => {
    const first = buildSeed();
    first.releases[0]!.title = "MUTATED";
    first.releases[0]!.tracks[0]!.title = "MUTATED TRACK";
    first.artists[0]!.genres.push("MUTATED GENRE");

    const second = buildSeed();
    expect(second.releases[0]!.title).not.toBe("MUTATED");
    expect(second.releases[0]!.tracks[0]!.title).not.toBe("MUTATED TRACK");
    expect(second.artists[0]!.genres).not.toContain("MUTATED GENRE");
  });

  /*
   * Releases and artists, not events. `featuredTrack()` reads `releases[0]`
   * before Firestore has answered, so an empty catalogue here is a crash at
   * module scope — but an empty events list is just a label with nothing
   * announced, which is the honest state until one is typed into KERNEL.
   */
  it("opens on a catalogue the deck can boot from", () => {
    const seed = buildSeed();
    expect(seed.origin).toBe("seed");
    expect(seed.releases.length).toBeGreaterThan(0);
    expect(seed.artists.length).toBeGreaterThan(0);
  });
});
