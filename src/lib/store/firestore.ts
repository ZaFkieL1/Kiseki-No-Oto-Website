import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { hash } from "../data";
import { firestore } from "../firebase";
import {
  assertArtistRemovable,
  assertFeaturable,
  byDateDesc,
  byName,
  reFeature,
} from "./rules";
import { buildSeed } from "./seed";
import type {
  Artist,
  Featured,
  LabelEvent,
  Release,
  Snapshot,
  Social,
  Store,
} from "./types";

const RELEASES = "releases";
const ARTISTS = "artists";
const EVENTS = "events";
/** One document holding the on-air mark. A collection would be pretending. */
const META = "meta";
const FEATURED = "featured";
/** The other `meta` document: one array, not a collection of one-field docs. */
const SOCIALS = "socials";

/**
 * The live catalogue, in Firestore.
 *
 * Two things shape this adapter:
 *
 * 1. **The first read cannot be synchronous.** `deck` is built at module scope
 *    and needs a record before the first render, so the store opens on the
 *    seed and swaps to the cloud when the listeners report. `origin` says
 *    which one you are looking at.
 * 2. **It swaps once, not four times.** Four collections report separately;
 *    emitting per response would paint a catalogue with cloud releases and
 *    seeded artists for a frame. Nothing is published until all four have
 *    answered.
 *
 * Writes are unguarded here on purpose. The rules refuse an unauthorised one
 * and the promise rejects, which is exactly what the KERNEL save bar shows —
 * a client-side check would only hide the error, not prevent the write.
 */
function createFirestoreStore(): Store {
  let snapshot: Snapshot = buildSeed();
  const listeners = new Set<() => void>();

  const emit = (): void => {
    for (const listener of listeners) listener();
  };

  const db = firestore();
  const awaited = new Set([RELEASES, ARTISTS, EVENTS, META, SOCIALS]);
  let live = false;

  /** Held back until every collection has answered once. */
  const arrive = (name: string, apply: (draft: Snapshot) => void): void => {
    const draft = { ...snapshot, origin: "local" as const };
    apply(draft);
    snapshot = draft;

    awaited.delete(name);
    if (awaited.size > 0 && !live) return;
    live = true;
    emit();
  };

  if (typeof window !== "undefined") {
    onSnapshot(collection(db, RELEASES), (result) => {
      const rows = result.docs.map((d) => d.data() as Release);
      arrive(RELEASES, (draft) => {
        draft.releases = byDateDesc(rows);
      });
    });

    onSnapshot(collection(db, ARTISTS), (result) => {
      const rows = result.docs.map((d) => d.data() as Artist);
      arrive(ARTISTS, (draft) => {
        draft.artists = byName(rows);
      });
    });

    onSnapshot(collection(db, EVENTS), (result) => {
      const rows = result.docs.map((d) => d.data() as LabelEvent);
      arrive(EVENTS, (draft) => {
        draft.events = byDateDesc(rows);
      });
    });

    onSnapshot(doc(db, META, FEATURED), (result) => {
      const value = result.exists() ? (result.data() as Featured) : null;
      arrive(META, (draft) => {
        draft.featured = value;
      });
    });

    onSnapshot(doc(db, META, SOCIALS), (result) => {
      const value = result.exists()
        ? ((result.data() as { items?: Social[] }).items ?? [])
        : [];
      arrive(SOCIALS, (draft) => {
        draft.socials = value;
      });
    });
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },

    getSnapshot() {
      return snapshot;
    },

    async saveRelease(release: Release) {
      await setDoc(doc(db, RELEASES, release.cat), release);
    },

    /**
     * The record keeps everything except its number.
     *
     * Written under the new id **before** the old one is deleted, so there is
     * never an instant where the catalogue is missing the record. The on-air
     * mark follows it by hand — this is exactly what `saveRelease` +
     * `removeRelease` could not do, since the latter calls `reFeature()` and
     * would send the mark to whichever record happened to be next.
     *
     * `seed` is recomputed because it is `hash(cat + title)`: a renumbered
     * record with no uploaded sleeve gets a different generated one, which is
     * the honest consequence of the number being part of the artwork.
     *
     * Uploaded files are left where they are. Their URLs are stored values, not
     * derived from `cat`, so `/media/audio/KSK-038/…` keeps serving after the
     * record becomes `KNOSNG-0001` — only the folder name reads stale, and
     * nobody sees it.
     */
    async renumberRelease(from: string, to: string) {
      if (from === to) return;
      const release = snapshot.releases.find((r) => r.cat === from);
      if (!release) throw new Error(`${from} is not in the catalogue.`);
      if (snapshot.releases.some((r) => r.cat === to)) {
        throw new Error(`${to} already exists in the catalogue.`);
      }

      const moved: Release = {
        ...release,
        cat: to,
        seed: hash(to + release.title),
      };
      await setDoc(doc(db, RELEASES, to), moved);
      await deleteDoc(doc(db, RELEASES, from));

      if (snapshot.featured?.cat === from) {
        await setDoc(doc(db, META, FEATURED), {
          cat: to,
          track: snapshot.featured.track,
        });
      }
    },

    async removeRelease(cat: string) {
      await deleteDoc(doc(db, RELEASES, cat));
      // A dangling mark would leave the hero with no record at all.
      if (snapshot.featured?.cat !== cat) return;
      const next = reFeature(cat, snapshot.releases);
      if (next) await setDoc(doc(db, META, FEATURED), next);
      else await deleteDoc(doc(db, META, FEATURED));
    },

    async saveArtist(artist: Artist) {
      await setDoc(doc(db, ARTISTS, artist.key), artist);
    },

    async removeArtist(key: string) {
      assertArtistRemovable(key, snapshot.releases);
      await deleteDoc(doc(db, ARTISTS, key));
    },

    async saveEvent(event: LabelEvent) {
      // Sorted here rather than while typing, so a half-entered hour never
      // makes the row jump out from under the cursor in the editor.
      const schedule = [...event.schedule].sort((a, b) =>
        a.start.localeCompare(b.start)
      );
      await setDoc(doc(db, EVENTS, event.id), { ...event, schedule });
    },

    async removeEvent(id: string) {
      await deleteDoc(doc(db, EVENTS, id));
    },

    async setFeatured(cat: string, track: number) {
      assertFeaturable(cat, track, snapshot.releases);
      await setDoc(doc(db, META, FEATURED), { cat, track });
    },

    /* Written whole. The order is the order they are shown in, so it is data,
       and an array keeps it without a sort key nobody would maintain. */
    async saveSocials(socials: Social[]) {
      await setDoc(doc(db, META, SOCIALS), { items: socials });
    },
  };
}

export const createStore = createFirestoreStore;
