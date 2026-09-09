import { useSyncExternalStore } from "react";
import { session, type Session } from "../../lib/auth";

/**
 * Who is signed in, and whether they may write.
 *
 * Deliberately not in `lib/hooks.ts`: that file is imported by the public
 * island, and putting this there would drag `firebase/auth` into the bundle
 * every visitor downloads for nothing.
 */
export function useSession(): Session {
  return useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot
  );
}
