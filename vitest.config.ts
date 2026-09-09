import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // node, not jsdom: everything under test is pure logic. The one browser
    // API we touch (localStorage) is faked per-test in three lines.
    environment: "node",
    include: ["src/**/*.test.ts"],
    /*
     * Stand-in Firebase config.
     *
     * Nothing here talks to Firebase — but `store/index.ts` builds the
     * Firestore store at module scope, so importing the catalogue's pure logic
     * constructs an app, and `lib/firebase.ts` refuses to build one from a
     * blank config. These are deliberately fake and deliberately *not* read
     * from `.env`: that file is gitignored, and a suite that only passes on
     * the machine holding the real project is a suite that fails on a clone.
     */
    env: {
      PUBLIC_FIREBASE_API_KEY: "test-api-key",
      PUBLIC_FIREBASE_AUTH_DOMAIN: "test.firebaseapp.com",
      PUBLIC_FIREBASE_PROJECT_ID: "test-project",
      PUBLIC_FIREBASE_STORAGE_BUCKET: "test.firebasestorage.app",
      PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
      PUBLIC_FIREBASE_APP_ID: "1:000000000000:web:0000000000000000000000",
      PUBLIC_EDITORS: "",
    },
  },
});
