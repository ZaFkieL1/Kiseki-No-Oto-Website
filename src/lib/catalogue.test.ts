import { describe, expect, it } from "vitest";
import {
  artistByKey,
  eventState,
  featuredTrack,
  releaseByCat,
  releaseCredit,
  releasesByArtist,
  roster,
} from "./catalogue";

/*
 * Under Node the store never attaches its Firestore listeners — there is no
 * window — so every read here resolves against the seed. That is exactly the
 * state a first paint sees, which makes it the right thing to assert on.
 */

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
  it("lists the label's acts", () => {
    expect(roster().length).toBeGreaterThan(0);
  });

  // The guest rule itself is `publicRoster`, tested against fixtures in
  // store/rules.test.ts — nothing in the seed is a guest.
  it("never includes a guest", () => {
    expect(roster().some((artist) => artist.guest)).toBe(false);
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

describe("releaseByCat", () => {
  it("finds the real record", () => {
    expect(releaseByCat("KNOSNG-0001")?.title).toBe("草SpeedRebirth");
  });

  it("returns undefined for a catalogue number that is not there", () => {
    expect(releaseByCat("KNOSNG-0999")).toBeUndefined();
  });
});

describe("releasesByArtist", () => {
  it("finds a record through its songs, not a record-level credit", () => {
    const rows = releasesByArtist("kernbrecher");
    expect(rows.length).toBeGreaterThan(0);
    expect(
      rows.every((release) =>
        release.tracks.some((track) => track.artist === "kernbrecher")
      )
    ).toBe(true);
  });
});

describe("releaseCredit", () => {
  it("names the act when the whole record is one", () => {
    expect(releaseCredit(releaseByCat("KNOSNG-0001")!)).toBe("KERN_BRECHER");
  });

  it("says V.A. when the songs disagree", () => {
    const single = releaseByCat("KNOSNG-0001")!;
    const mixed = {
      ...single,
      tracks: [
        { title: "ONE", artist: "senko" },
        { title: "TWO", artist: "lumen" },
      ],
    };
    expect(releaseCredit(mixed)).toBe("V.A.");
  });

  it("falls back to the label while the running order is empty", () => {
    const empty = { ...releaseByCat("KNOSNG-0001")!, tracks: [] };
    expect(releaseCredit(empty)).toBe("KISEKI NO OTO");
  });
});

describe("featuredTrack", () => {
  it("returns the marked record and song", () => {
    const { release, track } = featuredTrack();
    expect(release.cat).toBe("KNOSNG-0001");
    expect(release.tracks[track]!.audio).toBeTruthy();
  });
});
