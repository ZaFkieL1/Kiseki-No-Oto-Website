import { describe, expect, it } from "vitest";
import {
  assertArtistRemovable,
  assertFeaturable,
  byDateDesc,
  byName,
  catMatchesType,
  nextCat,
  publicRoster,
  reFeature,
  slugify,
  uniqueKey,
} from "./rules";
import { releases as seeded } from "../data";
import type { Artist, Release } from "./types";

function artist(key: string, name: string): Artist {
  return {
    key,
    name,
    kana: "",
    genres: [],
    since: "2026",
    active: true,
  };
}

function release(cat: string, overrides: Partial<Release> = {}): Release {
  return {
    cat,
    title: `TEST ${cat}`,
    type: "EP",
    date: "2026.01.01",
    tracks: [
      { title: "ONE", artist: "senko" },
      { title: "TWO", artist: "senko" },
    ],
    seed: 1,
    hue: 200,
    ...overrides,
  };
}

describe("slugify", () => {
  it("lowercases and joins with hyphens", () => {
    expect(slugify("KERN BRECHER")).toBe("kern-brecher");
  });

  it("drops punctuation and accents rather than encoding them", () => {
    expect(slugify("Sakura!! Breaker")).toBe("sakura-breaker");
    expect(slugify("Émile")).toBe("emile");
  });

  it("returns nothing for a name with no letters or numbers", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("uniqueKey", () => {
  it("uses the plain slug when it is free", () => {
    expect(uniqueKey("Lumen", [])).toBe("lumen");
  });

  it("numbers a name that is already taken", () => {
    const taken = [artist("lumen", "LUMEN")];
    expect(uniqueKey("Lumen", taken)).toBe("lumen-2");
  });

  it("keeps counting past the first collision", () => {
    const taken = [artist("lumen", "LUMEN"), artist("lumen-2", "LUMEN")];
    expect(uniqueKey("Lumen", taken)).toBe("lumen-3");
  });
});

describe("nextCat", () => {
  it("opens each type's series at 0001", () => {
    expect(nextCat("EP", [])).toBe("KNOEP-0001");
    expect(nextCat("SINGLE", [])).toBe("KNOSNG-0001");
    expect(nextCat("ALBUM", [])).toBe("KNOLP-0001");
    expect(nextCat("COMP", [])).toBe("KNOCOMP-0001");
    expect(nextCat("REMIX", [])).toBe("KNORMX-0001");
  });

  it("counts each type separately", () => {
    const rows = [
      release("KNOEP-0001"),
      release("KNOEP-0002"),
      release("KNOSNG-0001", { type: "SINGLE" }),
    ];
    expect(nextCat("EP", rows)).toBe("KNOEP-0003");
    expect(nextCat("SINGLE", rows)).toBe("KNOSNG-0002");
    expect(nextCat("REMIX", rows)).toBe("KNORMX-0001");
  });

  it("does not hand a deleted record's number to the next one", () => {
    const rows = [release("KNOEP-0001"), release("KNOEP-0003")];
    expect(nextCat("EP", rows)).toBe("KNOEP-0004");
  });

  it("ignores a record still on the old KSK number", () => {
    expect(nextCat("EP", [release("KSK-038")])).toBe("KNOEP-0001");
  });

  it("reads the number off the prefix, not off the end of the string", () => {
    expect(nextCat("COMP", [release("KNOCOMP-0012", { type: "COMP" })])).toBe(
      "KNOCOMP-0013"
    );
  });
});

describe("catMatchesType", () => {
  it("accepts a record filed under its own prefix", () => {
    expect(catMatchesType("KNOEP-0001", "EP")).toBe(true);
    expect(catMatchesType("KNOCOMP-0001", "COMP")).toBe(true);
  });

  it("refuses another type's prefix", () => {
    expect(catMatchesType("KNOSNG-0001", "EP")).toBe(false);
  });

  it("refuses the old format, which is what puts up the renumber control", () => {
    expect(catMatchesType("KSK-038", "SINGLE")).toBe(false);
  });

  it("refuses the wrong number of digits", () => {
    expect(catMatchesType("KNOEP-001", "EP")).toBe(false);
    expect(catMatchesType("KNOEP-00001", "EP")).toBe(false);
  });
});

describe("byDateDesc", () => {
  it("puts the newest first and leaves the input alone", () => {
    const rows = [
      release("KNOEP-0001", { date: "2020.01.01" }),
      release("KNOEP-0002", { date: "2030.01.01" }),
    ];
    expect(byDateDesc(rows).map((r) => r.cat)).toEqual(["KNOEP-0002", "KNOEP-0001"]);
    expect(rows[0]!.cat).toBe("KNOEP-0001");
  });
});

describe("byName", () => {
  it("sorts alphabetically without mutating", () => {
    const rows = [{ name: "ZED" }, { name: "ABE" }];
    expect(byName(rows).map((r) => r.name)).toEqual(["ABE", "ZED"]);
    expect(rows[0]!.name).toBe("ZED");
  });
});

describe("publicRoster", () => {
  const label = artist("senko", "SENKO");
  const invited = { ...artist("guestact", "GUEST_ACT"), guest: true };

  it("keeps the label's own acts", () => {
    expect(publicRoster([label, invited]).map((a) => a.key)).toEqual(["senko"]);
  });

  it("treats an artist with no guest flag as one of the label's", () => {
    expect(publicRoster([label])).toHaveLength(1);
  });

  it("drops a guest even when they are active", () => {
    expect(publicRoster([{ ...invited, active: true }])).toEqual([]);
  });

  it("does not mutate the list it is given", () => {
    const rows = [label, invited];
    publicRoster(rows);
    expect(rows).toHaveLength(2);
  });
});

describe("assertArtistRemovable", () => {
  it("allows an artist nothing credits", () => {
    expect(() => assertArtistRemovable("nobody", [release("KNOEP-0001")])).not.toThrow();
  });

  it("refuses one that releases still credit, and counts them", () => {
    const rows = [release("KNOEP-0001"), release("KNOEP-0002")];
    expect(() => assertArtistRemovable("senko", rows)).toThrow(/2 releases/);
  });

  it("keeps the noun singular for one dependent", () => {
    expect(() => assertArtistRemovable("senko", [release("KNOEP-0001")])).toThrow(
      /1 release still/
    );
  });
});

describe("assertFeaturable", () => {
  const rows = [release("KNOEP-0001")];

  it("allows a track the record has", () => {
    expect(() => assertFeaturable("KNOEP-0001", 1, rows)).not.toThrow();
  });

  it("refuses a catalogue number that is not there", () => {
    expect(() => assertFeaturable("KNOEP-0999", 0, rows)).toThrow(/KNOEP-0999/);
  });

  it("refuses a track past the end of the running order", () => {
    expect(() => assertFeaturable("KNOEP-0001", 2, rows)).toThrow(/track 3/);
  });

  it("refuses a negative track", () => {
    expect(() => assertFeaturable("KNOEP-0001", -1, rows)).toThrow(/track 0/);
  });
});

describe("reFeature", () => {
  it("lands on the newest survivor", () => {
    const rows = byDateDesc([
      release("KNOEP-0001", { date: "2020.01.01" }),
      release("KNOEP-0002", { date: "2030.01.01" }),
    ]);
    expect(reFeature("KNOEP-0002", rows)).toEqual({ cat: "KNOEP-0001", track: 0 });
  });

  it("returns nothing when that was the last record", () => {
    expect(reFeature("KNOEP-0001", [release("KNOEP-0001")])).toBeNull();
  });
});

describe("the seeded catalogue", () => {
  it("can feature the record the seed marks", () => {
    expect(() => assertFeaturable("KNOSNG-0001", 0, seeded)).not.toThrow();
  });
});
