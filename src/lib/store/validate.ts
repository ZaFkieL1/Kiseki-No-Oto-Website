import { CAT_PREFIX, catPattern } from "./rules";
import type { Artist, LabelEvent, Release, Social } from "./types";

/** Field name → what is wrong and how to fix it. Empty means valid. */
export type Errors = Record<string, string>;

/** Built from the prefix table, so what is accepted and what KERNEL mints
    cannot drift apart the way two hand-written patterns did. */
const CAT = catPattern();
/** What every record was filed under before the numbers meant anything. */
const LEGACY_CAT = /^KSK-\d{3}$/;
const DATE = /^\d{4}\.\d{2}\.\d{2}$/;
const TIME = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
/** Absolute path under public/, or a full URL. Nothing relative. */
const LOCATION = /^(https?:\/\/|\/)/;

export function isRealDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const [year, month, day] = value.split(".").map(Number);
  const date = new Date(year!, month! - 1, day!);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month! - 1 &&
    date.getDate() === day
  );
}

function blank(value: string | undefined): boolean {
  return (value ?? "").trim() === "";
}

function checkLocation(errors: Errors, field: string, value?: string): void {
  if (!blank(value) && !LOCATION.test(value!)) {
    errors[field] = "Use a path starting with / or a full https:// URL.";
  }
}

function checkCount(errors: Errors, field: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    errors[field] = "Whole number, 0 or more. 0 means unknown.";
  }
}

export function validateRelease(draft: Release, others: Release[]): Errors {
  const errors: Errors = {};

  if (blank(draft.cat)) errors.cat = "A catalogue number is required.";
  else if (LEGACY_CAT.test(draft.cat)) {
    // Refused rather than tolerated: this is what drives the renumbering to
    // completion instead of leaving a catalogue half in each format.
    errors.cat =
      "This record still uses the old KSK-### number. Renumber it below.";
  } else if (!CAT.test(draft.cat)) {
    errors.cat = `Format is ${Object.values(CAT_PREFIX).join(" / ")} followed by -#### — four digits.`;
  } else if (others.some((r) => r.cat === draft.cat)) {
    errors.cat = `${draft.cat} already exists in the catalogue.`;
  }

  if (blank(draft.title)) errors.title = "A title is required.";
  if (!isRealDate(draft.date)) {
    errors.date = "Format is YYYY.MM.DD, and it has to be a real date.";
  }

  if (draft.tracks.length === 0) {
    errors.tracks = "Add at least one song.";
  }
  draft.tracks.forEach((track, index) => {
    if (blank(track.title)) {
      errors[`tracks.${index}.title`] = "Every song needs a title.";
    }
    if (blank(track.artist)) {
      errors[`tracks.${index}.artist`] = "Credit the act that made this song.";
    }
    checkLocation(errors, `tracks.${index}.audio`, track.audio);
    checkLocation(errors, `tracks.${index}.file`, track.file);
    if (track.duration !== undefined) {
      checkCount(errors, `tracks.${index}.duration`, track.duration);
    }
    if (track.bpm !== undefined) {
      checkCount(errors, `tracks.${index}.bpm`, track.bpm);
    }
  });

  checkLocation(errors, "cover", draft.cover);
  checkLocation(errors, "link", draft.link);
  checkLocation(errors, "preview", draft.preview);

  return errors;
}

export function validateArtist(draft: Artist, others: Artist[]): Errors {
  const errors: Errors = {};

  if (blank(draft.name)) errors.name = "A name is required.";
  if (blank(draft.since)) errors.since = "A start year is required.";
  checkLocation(errors, "link", draft.link);

  // The key is derived from the name and never shown, so a problem with it is
  // reported against the field the reader can actually act on.
  if (blank(draft.key) || !SLUG.test(draft.key)) {
    errors.name = "Use at least one letter or number in the name.";
  } else if (others.some((a) => a.key === draft.key)) {
    errors.name = `Another artist is already filed under ${draft.key}.`;
  }

  return errors;
}

/**
 * The rows of the socials list, keyed by index like the schedule editor's are,
 * so a row can show its own message.
 *
 * A row with neither a name nor a link is skipped rather than refused: it is an
 * empty row somebody added and did not fill, and refusing to save the whole
 * list over it would be the wrong answer.
 */
export function validateSocials(rows: Social[]): Errors {
  const errors: Errors = {};

  rows.forEach((row, index) => {
    if (blank(row.name) && blank(row.url)) return;
    if (blank(row.name)) {
      errors[`socials.${index}.name`] = "Name the network — this is the word a reader sees.";
    }
    if (blank(row.url)) {
      errors[`socials.${index}.url`] = "A link is required, or the name goes nowhere.";
    } else {
      checkLocation(errors, `socials.${index}.url`, row.url);
    }
  });

  return errors;
}

export function validateEvent(draft: LabelEvent): Errors {
  const errors: Errors = {};

  if (blank(draft.name)) errors.name = "A name is required.";
  if (!isRealDate(draft.date)) {
    errors.date = "Format is YYYY.MM.DD, and it has to be a real date.";
  }
  if (blank(draft.timezone)) {
    errors.timezone =
      "A timezone label is required — it travels with every time on the schedule.";
  }

  checkLocation(errors, "stream", draft.stream);
  checkLocation(errors, "flyer", draft.flyer);

  draft.schedule.forEach((slot, index) => {
    if (!TIME.test(slot.start)) {
      errors[`schedule.${index}.start`] = "Format is HH:MM.";
    }
    if (blank(slot.artist)) {
      errors[`schedule.${index}.artist`] =
        "Name the act, as it reads on the flyer.";
    }
    if (!blank(slot.end)) {
      if (!TIME.test(slot.end!)) {
        errors[`schedule.${index}.end`] = "Format is HH:MM.";
      } else if (TIME.test(slot.start) && slot.end! <= slot.start) {
        errors[`schedule.${index}.end`] = "The end has to come after the start.";
      }
    }
  });

  return errors;
}
