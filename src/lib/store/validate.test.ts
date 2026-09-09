import { describe, expect, it } from "vitest";
import {
  isRealDate,
  validateArtist,
  validateEvent,
  validateRelease,
  validateSocials,
} from "./validate";
import type { Artist, LabelEvent, Release } from "./types";

function release(overrides: Partial<Release> = {}): Release {
  return {
    cat: "KNOEP-0040",
    title: "TEST RECORD",
    type: "EP",
    date: "2026.09.01",
    tracks: [
      { title: "ONE", artist: "senko" },
      { title: "TWO", artist: "senko" },
    ],
    seed: 1,
    hue: 200,
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
    active: true,
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

  it("accepts every type's prefix", () => {
    for (const cat of [
      "KNOLP-0001",
      "KNOEP-0001",
      "KNOSNG-0001",
      "KNOCOMP-0001",
      "KNORMX-0001",
    ]) {
      expect(validateRelease(release({ cat }), []).cat).toBeUndefined();
    }
  });

  it("requires four digits", () => {
    expect(validateRelease(release({ cat: "KNOEP-040" }), []).cat).toBeTruthy();
  });

  it("rejects a prefix that is not one of the five", () => {
    expect(validateRelease(release({ cat: "KNOXX-0001" }), []).cat).toBeTruthy();
  });

  /* Refused rather than tolerated, so the renumbering gets finished — and the
     message has to say what to do, not just that it is wrong. */
  it("sends a record still on the old number to the renumber control", () => {
    expect(validateRelease(release({ cat: "KSK-038" }), []).cat).toMatch(
      /renumber/i
    );
  });

  it("rejects a duplicate catalogue number", () => {
    const existing = [release({ cat: "KNOEP-0040" })];
    expect(validateRelease(release({ cat: "KNOEP-0040" }), existing).cat).toMatch(
      /already/i
    );
  });

  it("requires a title", () => {
    expect(validateRelease(release({ title: "  " }), []).title).toBeTruthy();
  });

  it("rejects a bad date", () => {
    expect(validateRelease(release({ date: "2026/09/01" }), []).date).toBeTruthy();
  });

  it("rejects a negative BPM on the song that has it", () => {
    const errors = validateRelease(
      release({
        tracks: [
          { title: "ONE", artist: "senko", bpm: 180 },
          { title: "TWO", artist: "senko", bpm: -1 },
        ],
      }),
      []
    );
    expect(errors["tracks.1.bpm"]).toBeTruthy();
    expect(errors["tracks.0.bpm"]).toBeUndefined();
  });

  it("insists on at least one song", () => {
    expect(validateRelease(release({ tracks: [] }), []).tracks).toBeTruthy();
  });

  it("keys track errors by index", () => {
    const errors = validateRelease(
      release({
        tracks: [
          { title: "OK", artist: "senko" },
          { title: "", artist: "", audio: "song.mp3" },
        ],
      }),
      []
    );
    expect(errors["tracks.1.title"]).toBeTruthy();
    expect(errors["tracks.1.artist"]).toBeTruthy();
    expect(errors["tracks.1.audio"]).toBeTruthy();
    expect(errors["tracks.0.title"]).toBeUndefined();
  });

  it("lets the songs of one record disagree about who made them", () => {
    const errors = validateRelease(
      release({
        tracks: [
          { title: "ONE", artist: "senko" },
          { title: "TWO", artist: "lumen" },
        ],
      }),
      []
    );
    expect(errors).toEqual({});
  });

  it("accepts every seeded release unchanged", async () => {
    const { releases } = await import("../data");
    for (const seeded of releases) {
      const others = releases.filter((r) => r.cat !== seeded.cat);
      expect(validateRelease(seeded, others)).toEqual({});
    }
  });

  it("requires paths to be absolute or a URL", () => {
    expect(validateRelease(release({ cover: "cover.png" }), []).cover).toBeTruthy();
    expect(
      validateRelease(release({ cover: "/cover.png" }), []).cover
    ).toBeUndefined();
    expect(
      validateRelease(release({ link: "https://x.bandcamp.com" }), []).link
    ).toBeUndefined();
  });

  it("holds the preview to the same standard as any other location", () => {
    expect(
      validateRelease(release({ preview: "taste.mp3" }), []).preview
    ).toBeTruthy();
    expect(
      validateRelease(release({ preview: "https://cdn.example.com/a.mp3" }), [])
        .preview
    ).toBeUndefined();
    // Unset is the normal state: most records have no preview.
    expect(validateRelease(release({}), []).preview).toBeUndefined();
  });
});

describe("validateArtist", () => {
  it("accepts a good artist", () => {
    expect(validateArtist(artist(), [])).toEqual({});
  });

  it("requires a name", () => {
    expect(validateArtist(artist({ name: "" }), []).name).toBeTruthy();
  });

  /* The key is derived and never shown, so its problems are reported against
     the name — the only field the reader can do anything about. */
  it("reports a name that slugified to nothing against the name", () => {
    expect(validateArtist(artist({ key: "" }), []).name).toMatch(/letter/i);
  });

  it("reports a collision against the name", () => {
    expect(validateArtist(artist(), [artist()]).name).toMatch(/already/i);
  });

  it("holds an artist's profile link to the same standard", () => {
    expect(validateArtist(artist({ link: "bandcamp.com/x" }), []).link).toBeTruthy();
    expect(
      validateArtist(artist({ link: "https://x.bandcamp.com" }), []).link
    ).toBeUndefined();
    // Most acts have no profile on file; that is not an error.
    expect(validateArtist(artist(), []).link).toBeUndefined();
  });
});

describe("validateEvent", () => {
  it("accepts a good event", () => {
    expect(validateEvent(event())).toEqual({});
  });

  it("requires a name, a date and a timezone", () => {
    const errors = validateEvent(
      event({ name: "", date: "nope", timezone: "" })
    );
    expect(errors.name).toBeTruthy();
    expect(errors.date).toBeTruthy();
    expect(errors.timezone).toBeTruthy();
  });

  it("checks the stream and flyer look like links", () => {
    const errors = validateEvent(
      event({ stream: "twitch.tv/x", flyer: "flyer.png" })
    );
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

  it("accepts the seeded events unchanged", async () => {
    const { events } = await import("../data");
    for (const seeded of events) {
      expect(validateEvent(seeded)).toEqual({});
    }
  });
});

describe("validateSocials", () => {
  it("accepts a filled row", () => {
    expect(
      validateSocials([{ name: "Instagram", url: "https://instagram.com/x" }])
    ).toEqual({});
  });

  it("wants both halves, keyed by row", () => {
    const errors = validateSocials([
      { name: "Instagram", url: "" },
      { name: "", url: "https://bandcamp.com" },
    ]);
    expect(errors["socials.0.url"]).toBeTruthy();
    expect(errors["socials.1.name"]).toBeTruthy();
    expect(errors["socials.0.name"]).toBeUndefined();
  });

  it("holds the link to the same standard as every other location", () => {
    expect(
      validateSocials([{ name: "Instagram", url: "instagram.com/x" }])[
        "socials.0.url"
      ]
    ).toBeTruthy();
  });

  /* A row somebody added and did not fill is not a reason to refuse the whole
     list — the panel drops it on save. */
  it("ignores a row with nothing in it", () => {
    expect(validateSocials([{ name: "", url: "" }])).toEqual({});
  });
});
