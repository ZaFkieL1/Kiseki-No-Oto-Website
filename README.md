# KISEKI NO OTO — 奇跡ノ音

The site for a Colombian net-label putting out J-Core and Jaycore, built as
**LABEL_OS**: the page boots like a system, and the boot screen becomes the
interface.

```
LABEL_OS

[ OK ] AUDIO ENGINE        48000 HZ / 2CH
[ OK ] VISUAL ENGINE
[ OK ] RELEASE DATABASE

████████████████████░  94%

SYSTEM READY.
```

The narrative order is the design: **boot → identity → transmission →
catalogue.** `01 SYSTEM` is the label's identity page, not the player — the
dock plays underneath every view, which is what frees SYSTEM to be about the
label rather than about a track.

## What's in it

- **A boot sequence that hands off unattended.** No gate, nothing to press.
  Playback still waits for a real gesture: PLAY builds the `AudioContext`.
- **An identity page, not an about page.** The lockup and the statement on the
  left, the loaded record hung off a full-height rule on the right — identity
  and transmission side by side rather than one scroll apart.
- **A catalogue of scenes**, not a card grid: each release owns a viewport, its
  artwork becomes the environment, and scrolling moves through the archive like
  chapters. The record's own link is the destination; this site is the curation.
- **A persistent transport** — browsing never interrupts playback. The deck is
  a module singleton outside React, read through `useSyncExternalStore`.
- **A real waveform.** The scrubber decodes the file once through an
  `OfflineAudioContext` and draws the track's measured peak envelope. It does
  not animate; only the progress fill moves.
- **An interface that wears the music.** The accent is not a brand constant —
  every release carries its own hue, sampled from the actual sleeve when there
  is one, and the whole chassis retints when you load it.
- **Two languages.** Spanish is the default and what the `<noscript>` listing
  ships; English is a switch in the bar.
- **KERNEL**, a separate console at a private address where the catalogue is
  actually typed, behind Google sign-in and an editor allowlist. Its code is a
  separate chunk the public page never references.

## Stack

Astro 7 + React 19, one island, no router. Firestore for the catalogue,
Cloudflare R2 for audio and sleeves — written and read back through the site's
own routes, so the bucket stays private and there is no access key anywhere in
this repository. Deployed on Cloudflare Workers.

## Running it

```sh
pnpm install
cp .env.example .env          # Firebase web config — see below
pnpm astro dev --background   # http://localhost:4321
```

| Command | Action |
| :-- | :-- |
| `pnpm build` | Production build to `./dist/` |
| `pnpm check` | Type-check everything — the build only strips types |
| `pnpm test` | Unit tests (pure logic: the store, validation, derived values) |
| `pnpm icons` | Regenerate every icon and the share card from the lockup |
| `npx wrangler deploy` | Ship it, after `pnpm build` |

Node >= 22.12.0, pnpm.

## Configuration

Four things live outside the repository, and only one of them is a secret.

**`.env`** — copy `.env.example`. It holds the Firebase web config and
`PUBLIC_EDITORS`. None of it is secret: Astro inlines every `PUBLIC_` variable
into the bundle the browser downloads, so the deployed site hands the config to
anyone who opens devtools. It lives in `.env` so this repository is not a
published list of people's email addresses, and so it does not trip every
secret scanner pointed at it. What actually protects the Firebase key is on
Google's side — HTTP-referrer restrictions and App Check.

**`firestore.rules`** — copy `firestore.rules.example`, fill in `editors()`,
and paste it into the Firebase Console. This is the boundary that actually
stops a write to the catalogue.

**The `EDITORS` secret** — `npx wrangler secret put EDITORS`, comma separated.
The upload route checks the signed-in address against it. `.dev.vars` (copy
`.dev.vars.example`) supplies it to `wrangler dev`.

**The KERNEL page** — `src/pages/kernel-*.astro` is gitignored, because in
Astro the filename *is* the URL and a public repository carrying that page
carries the address with it. Copy `docs/kernel-page.astro.example` into
`src/pages/` under a name nobody guesses. Be exact about what that buys: it
keeps the door out of sight, it does not lock it. The lock is the two lists
above, which refuse a stranger who finds the page and signs in.

## The catalogue is real

`src/lib/data.ts` is a seed, not the source — a first-paint fallback the store
swaps out once Firestore answers, and what the `<noscript>` listing ships. It
held twenty invented records once; they are gone. Nothing in it is fiction now,
because an invented record is a release announced that does not exist, and the
deck would eventually play it. Records are added through KERNEL.

Audio and artwork are not in this repository either. A song plays only if a
file has been uploaded for it; one without says so, rather than the deck
jamming on a link it cannot decode.

## Keys

| | |
| :-- | :-- |
| `1`–`4` | Switch view |
| `Space` | Play / pause |
| `←` `→` | Seek ±5s |
| any key | Skip the boot |

---

See `CLAUDE.md` for the architecture notes worth reading before changing
anything — the load-bearing decisions and why they are the way they are.
