import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  type Auth,
} from "firebase/auth";
import {
  initializeFirestore,
  type Firestore,
} from "firebase/firestore";

/**
 * Firebase: Firestore for the catalogue, Auth for the KERNEL door.
 *
 * Storage is gone — files live in Cloudflare R2 now, written through the Worker
 * in `worker/` and read straight off the bucket's public URL. Auth stayed:
 * the Worker verifies the very same Google ID token, so signing in still means
 * one thing everywhere.
 *
 * These values are not secrets, and moving them to `.env` did not make them
 * into any. A Firebase web config identifies the project; it does not
 * authenticate anyone, Google publishes it in their own quick start, and Astro
 * inlines every `PUBLIC_` variable into the bundle the browser downloads — so
 * the deployed site hands this out to anyone who opens devtools, exactly as it
 * did when the values were typed here. What the move buys is a repository that
 * does not trip every secret scanner pointed at it, and nothing more.
 *
 * The security boundary is `firestore.rules`, and for uploads the token check
 * in `src/pages/api/upload/[...key].ts`. What actually protects the key itself
 * is on Google's side: HTTP-referrer restrictions in Cloud Console and App
 * Check. Neither of those lives in this repo.
 *
 * Analytics is deliberately absent: `getAnalytics` touches `window` at import
 * time and would break the static build.
 */

/** Named, not optional: a blank config fails inside Firebase with no clue why. */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env and fill in the Firebase web config.`
    );
  }
  return value;
}

/**
 * Built on demand, not at module scope. The unit tests import the store's pure
 * logic, which reaches this file through `store/firestore.ts` without ever
 * standing up an app — reading the config at import time made a missing `.env`
 * fail the suite from three modules away.
 */
function config() {
  return {
    apiKey: required("PUBLIC_FIREBASE_API_KEY", import.meta.env.PUBLIC_FIREBASE_API_KEY),
    authDomain: required("PUBLIC_FIREBASE_AUTH_DOMAIN", import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN),
    projectId: required("PUBLIC_FIREBASE_PROJECT_ID", import.meta.env.PUBLIC_FIREBASE_PROJECT_ID),
    storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: required("PUBLIC_FIREBASE_APP_ID", import.meta.env.PUBLIC_FIREBASE_APP_ID),
  };
}

/** Lazy and idempotent: mounted once, but HMR remounts often. */
export function app(): FirebaseApp {
  return getApps()[0] ?? initializeApp(config());
}

let db: Firestore | null = null;

export function firestore(): Firestore {
  if (db) return db;
  db = initializeFirestore(app(), {
    // Optional fields arrive as `undefined` all over the catalogue — an unset
    // Bandcamp link, a release with no sleeve. Firestore rejects those by
    // default, so every write would need hand-stripping.
    ignoreUndefinedProperties: true,
  });
  return db;
}

export function auth(): Auth {
  return getAuth(app());
}

export function googleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  // Always ask which account, so signing in as the wrong Google identity is
  // not something you do once and then cannot undo without logging out.
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}
