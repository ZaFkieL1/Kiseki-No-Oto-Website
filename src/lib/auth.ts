import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./firebase";

/**
 * Who may edit the catalogue.
 *
 * This list is for the interface only — it decides what KERNEL shows you. The
 * rules that actually stop a write live in `firestore.rules` for the catalogue
 * and in the `EDITORS` Wrangler secret for uploads, because anything in this
 * file ships to the browser and can be edited by whoever is holding it. Add an
 * address in all three places or it does not count.
 *
 * It is read from `PUBLIC_EDITORS` rather than typed here, and the `PUBLIC_`
 * prefix is not a mistake: Astro inlines it into the bundle, so it reaches the
 * browser exactly as a typed list would. What it buys is that the repository
 * is not a published list of people's addresses — the reason is privacy, not
 * secrecy, and nothing here was ever a secret.
 *
 * Empty when unset, which fails closed: a clone with no `.env` gets a console
 * that authorises nobody, rather than one that authorises everybody.
 */
export const ADMINS = (import.meta.env.PUBLIC_EDITORS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export interface Session {
  email: string | null;
  /** Signed in *and* on the list. The only state that can write. */
  authorised: boolean;
  /** True until Firebase reports for the first time — not "signed out". */
  pending: boolean;
}

export const SIGNED_OUT: Session = {
  email: null,
  authorised: false,
  pending: false,
};

/**
 * A subscribe/getSnapshot pair, like `deck` and `store` — the third external
 * source of truth in this app, consumed the same way.
 */
function createSession() {
  let snapshot: Session = { email: null, authorised: false, pending: true };
  const listeners = new Set<() => void>();

  const emit = (next: Session): void => {
    snapshot = next;
    for (const listener of listeners) listener();
  };

  // Guarded: the Astro build runs this module under Node, where there is no
  // browser to hold a session.
  if (typeof window !== "undefined") {
    onAuthStateChanged(auth(), (user) => {
      const email = user?.email ?? null;
      emit({
        email,
        // `ADMINS` is lowercased on the way in, so the address is too:
        // Google hands back whatever case the account was typed in.
        authorised: email !== null && ADMINS.includes(email.toLowerCase()),
        pending: false,
      });
    });
  }

  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    getSnapshot(): Session {
      return snapshot;
    },
    /** Stable identity for `useSyncExternalStore`'s server snapshot. */
    getServerSnapshot(): Session {
      return SIGNED_OUT;
    },
  };
}

export const session = createSession();

export async function signIn(): Promise<void> {
  await signInWithPopup(auth(), googleProvider());
}

export async function signOutOfKernel(): Promise<void> {
  await signOut(auth());
}
