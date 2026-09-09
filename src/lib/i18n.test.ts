import { describe, expect, it } from "vitest";
import { language, t } from "./i18n";

/*
 * The dictionaries having the same *keys* is a type error already, so that is
 * not tested here. What types cannot say is that a key was filled in — an
 * empty string, or an English word left sitting in the Spanish column, both
 * compile perfectly.
 */

describe("t", () => {
  it("answers in whichever language is current", () => {
    language.set("es");
    expect(t("nav.releases")).toBe("Lanzamientos");
    language.set("en");
    expect(t("nav.releases")).toBe("Releases");
  });

  it("opens in Spanish, because the label is Colombian", () => {
    expect(language.getServerSnapshot()).toBe("es");
  });

  it("tells its subscribers", () => {
    language.set("es");
    let told = 0;
    const stop = language.subscribe(() => told++);
    language.toggle();
    expect(told).toBe(1);
    expect(language.getSnapshot()).toBe("en");
    stop();
    language.toggle();
    expect(told).toBe(1);
  });
});

describe("the two columns", () => {
  const KEYS = [
    "nav.system",
    "bar.online",
    "boot.ready",
    "sys.explore",
    "signal.title",
    "phase.NO SIGNAL",
    "deck.play",
    "rel.open",
    "art.title",
    "evt.empty",
  ] as const;

  it("has both languages filled in, and saying different things", () => {
    for (const key of KEYS) {
      language.set("es");
      const spanish = t(key);
      language.set("en");
      const english = t(key);

      expect(spanish.trim()).not.toBe("");
      expect(english.trim()).not.toBe("");
      // Not a rule for every key — "Preview" is "Preview" — but for these ten
      // an identical string means one column was filled in from the other.
      expect(spanish).not.toBe(english);
    }
    language.set("es");
  });
});
