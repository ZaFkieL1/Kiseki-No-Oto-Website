import { createStore } from "./firestore";
import type { Store } from "./types";

/**
 * The live catalogue.
 *
 * Firestore backs it. Reads open on the seed because `deck` is built at module
 * scope and needs a record before the first render, then swap to the cloud
 * when the listeners report — `Snapshot.origin` says which one you are looking
 * at. Writes are async, which is what they always were: the localStorage
 * adapter this replaced resolved immediately on purpose, so that the UI would
 * already be written for this day.
 */
export const store: Store = createStore();
