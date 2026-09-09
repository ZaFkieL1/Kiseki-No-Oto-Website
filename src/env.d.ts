/// <reference types="astro/client" />

/**
 * The `PUBLIC_` half of `.env`, typed.
 *
 * Every one of these is inlined into the browser bundle at build time — that
 * is what `PUBLIC_` means. None of them is a secret; see `lib/firebase.ts` for
 * why they live in `.env` anyway. The one real secret, `EDITORS` for the
 * upload route, is a Wrangler secret and is typed in
 * `worker-configuration.d.ts` instead.
 */
interface ImportMetaEnv {
  readonly PUBLIC_FIREBASE_API_KEY: string;
  readonly PUBLIC_FIREBASE_AUTH_DOMAIN: string;
  readonly PUBLIC_FIREBASE_PROJECT_ID: string;
  readonly PUBLIC_FIREBASE_STORAGE_BUCKET: string;
  readonly PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly PUBLIC_FIREBASE_APP_ID: string;
  /** What KERNEL shows, not what it allows. Comma separated. */
  readonly PUBLIC_EDITORS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
