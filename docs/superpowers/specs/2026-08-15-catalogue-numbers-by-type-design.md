# Catalogue numbers by release type

**Date:** 2026-08-15
**Status:** approved, ready for planning

## The problem

Every record is filed under `KSK-###` regardless of what it is. The number says
nothing about the release, and the format is written out by hand in two places
that do not know about each other:

- `src/lib/store/validate.ts:6` — `const CAT = /^KSK-\d{3}$/`
- `src/components/admin/ReleasesPanel.tsx:25` — `` cat: `KSK-${String(nextId).padStart(3, "0")}` ``

Two copies of one format is the drift this change has to stop, not just a detail
to carry over.

## The format

`KNO<PREFIX>-####` — four digits, a counter per type, starting at `0001`.

| `ReleaseType` | Prefix | Example |
| :-- | :-- | :-- |
| `ALBUM` | `KNOLP` | `KNOLP-0001` |
| `EP` | `KNOEP` | `KNOEP-0001` |
| `SINGLE` | `KNOSNG` | `KNOSNG-0001` |
| `COMP` | `KNOCOMP` | `KNOCOMP-0001` |
| `REMIX` | `KNORMX` | `KNORMX-0001` |

Each prefix runs its own series: `KNOEP-0001` and `KNOSNG-0001` both exist. That
is what makes the prefix worth having — the number tells you how many EPs the
label has put out, not where the record sits in one undifferentiated pile.

The old `KSK-###` form is **not** valid. Everything that carries it gets
renumbered (see *Migration*).

## Where the rules live

`src/lib/store/rules.ts` — the catalogue's own rules, away from any backend,
which is where this project already keeps `uniqueKey`, `publicRoster` and the
delete guards. Three additions:

```ts
export const CAT_PREFIX: Record<ReleaseType, string>
export function nextCat(type: ReleaseType, releases: Release[]): string
export function catMatchesType(cat: string, type: ReleaseType): boolean
```

- **`nextCat`** reads the highest number already used under that prefix and adds
  one. Deliberately not `count + 1`: deleting `KNOEP-0002` out of the middle
  must not make the next record reuse a number that has been published.
  Non-matching cats (another type's, or a legacy `KSK-`) are ignored. An empty
  series answers `0001`.
- **`catMatchesType`** is what decides whether a saved record is filed
  correctly. It is the condition that shows the renumber control.

**`validate.ts` builds its regex from `CAT_PREFIX`**, so the accepted shape and
the minted shape cannot disagree. A legacy value fails with a message that names
the fix: *"This record still uses the old KSK-### number. Renumber it below."*
Refusing the save is the point — it drives the migration to completion instead
of allowing a catalogue half in each format.

## `Release.id` is deleted

`types.ts:75` declares it; `ReleasesPanel.tsx:64` is the only reader, and only to
mint the next number. With the counter derived from `cat`, nothing reads it.
A stray numeric field living beside the string that is actually the key is the
next confusion, so it goes — from `types.ts`, from the seed record in `data.ts`,
and from the test fixtures. Documents already in Firestore keep the orphan field;
it is inert and costs nothing to leave.

## KERNEL

### A new record

The Catalogue field stops being a text input. It renders as a derived value —
same visual weight as its neighbours, nothing to type into — and its hint says
where the number comes from.

On opening a new record it holds `nextCat(type, releases)` for the starting type.
**Changing the Type dropdown while the record is unsaved re-mints it**:
`KNOSNG-0004` becomes `KNOEP-0002` in the same gesture that fixes the type.

### A saved record

`cat` is frozen: it is the Firestore document id and the R2 folder for the
record's files. Changing the dropdown on a saved record does not touch the
number. Instead the renumber control appears beside the field whenever
`catMatchesType` is false:

> Numbered `KSK-038`, but this is a SINGLE → **Renumber to `KNOSNG-0001`**

Explicit, never automatic. Moving a document's id is not something that should
happen underneath someone who was editing a title.

### `store.renumberRelease(from, to)`

A new method on the `Store` interface and on the Firestore adapter. It:

1. Refuses if `to` already exists in the catalogue.
2. Writes the document under `to` first — there is never a moment where the
   record is absent.
3. Deletes the document under `from`.
4. Moves `meta/featured` to `to`, keeping the same track index, if it pointed
   at `from`.
5. Recomputes `seed` as `hash(to + title)`.

Steps 3 and 4 are why this cannot be `saveRelease(new)` then
`removeRelease(old)`: `removeRelease` (`firestore.ts:131`) calls `reFeature()`
and would hand the on-air mark to some unrelated record.

## Migration

There are between one and five records in Firestore. They are renumbered one at
a time through the control above — one click each, oldest first so the series
comes out chronological. The control shows the exact target before it is pressed.

No bulk one-shot button: the same code that migrates today is the code that
fixes a wrong type next month, so nothing has to be written to be thrown away.

Doing it by hand was not an option worth keeping — the cover and audio fields
have no text input (deliberately, per CLAUDE.md), so re-creating a record from
scratch would lose the R2 URLs of everything already uploaded.

### The seed

`KSK-038` is a `SINGLE`, so in `src/lib/data.ts` it becomes `KNOSNG-0001`, and
`DEFAULT_FEATURED` in `src/lib/store/seed.ts:5` follows it. Its file URLs
(`/cover.png`, the mp3 under `public/`) are values of the record, not derived
from `cat`, and do not change.

### R2 is left alone

Objects already uploaded stay where they are. `/media/audio/KSK-038/…` keeps
serving the file after the record becomes `KNOSNG-0001`; only the folder name
reads stale, and nobody sees it. Rewriting stored URLs to chase a folder name
would be work with no reader.

### Generated sleeves

`seed` is `hash(cat + title)`, so renumbering redraws a *generated* sleeve.
`KSK-038` has a real `cover.png`, so nothing is visible there. A record with no
uploaded cover will get a different generated sleeve after renumbering. Accepted.

## Testing

`rules.ts` is pure, which is what this project tests. New cases:

- `nextCat`: empty catalogue → `0001`; ignores other types' series; ignores
  legacy `KSK-`; a gap in the middle does not reuse a number; four-digit padding.
- `catMatchesType`: true for a matching prefix, false for another type's, false
  for legacy.
- `validateRelease`: accepts each of the five prefixes, rejects a legacy
  `KSK-###` with the renumber message, rejects a wrong digit count, still
  catches a duplicate.

Existing fixtures using `KSK-` need updating: `src/lib/store/rules.test.ts`,
`src/lib/store/validate.test.ts`, `src/lib/catalogue.test.ts`,
`src/lib/data.test.ts`.

No component tests — canvas, `useSyncExternalStore` and `AudioContext` make them
expensive and fragile, per CLAUDE.md. `pnpm check` is the only thing that
type-checks and has to pass.

## Out of scope

- Moving R2 objects.
- A bulk renumber pass over the whole catalogue.
- Changing what `TYPE_LABEL` displays — the prefix table and the display labels
  are separate concerns (`REMIX` shows as `REMIXES`, files as `KNORMX`).
