import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { MEDIA_PREFIX } from "../../media/[...key]";

/**
 * The upload door — one of two on-demand routes in an otherwise prerendered
 * site. `pages/media` is the other, and it is where these files are read back.
 *
 * The site is static everywhere else, which is why this exists at all. R2 needs
 * a credential to accept a write and a static page has nowhere to keep one that
 * a visitor could not also read. This route runs on Cloudflare with the bucket
 * arriving as a **binding**, so the credential is never a value anyone holds:
 * not in this repo, not in the browser, not in a secret. Cloudflare hands the
 * capability to the running worker and nowhere else.
 *
 * It began as a standalone Worker in `worker/`. The Astro Cloudflare adapter
 * made that redundant — the site already runs where the binding is, so a second
 * deployment, a second config and a CORS policy were three moving parts earning
 * nothing. Same origin now: the browser is talking to the page it came from.
 *
 * The bucket is **private**: reads go back through `pages/media`, not through a
 * public `r2.dev` URL. See that file for why that is worth the invocations.
 */

export const prerender = false;

/**
 * Google publishes the token-signing keys as JWK, which WebCrypto imports
 * directly. Two addresses serve the same set; the second is only asked when the
 * first does not answer, because a refused upload over a flaky key fetch is a
 * failure of ours, not the editor's.
 */
const JWKS_URLS = [
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  "https://www.googleapis.com/robot/v1/metadata/jwk/securetoken@system.gserviceaccount.com",
];

const MAX_BYTES = 96 * 1024 * 1024;

const ACCEPTED = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/x-flac",
  "audio/ogg",
  "audio/mp4",
  "audio/aac",
];

/* -------------------------------------------------------------------------
   token verification
   ------------------------------------------------------------------------- */

interface Claims {
  aud: string;
  iss: string;
  sub: string;
  exp: number;
  iat: number;
  email?: string;
  email_verified?: boolean;
}

/** Cached across requests on a warm isolate; refreshed when Google's expire. */
let jwks: { keys: Record<string, CryptoKey>; expires: number } | null = null;

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function signingKeys(): Promise<Record<string, CryptoKey>> {
  if (jwks && jwks.expires > Date.now()) return jwks.keys;

  const failures: string[] = [];
  let response: Response | null = null;
  for (const url of JWKS_URLS) {
    try {
      const attempt = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "kiseki-no-oto-upload" },
      });
      if (attempt.ok) {
        response = attempt;
        break;
      }
      failures.push(`HTTP ${attempt.status}`);
    } catch (problem) {
      failures.push(problem instanceof Error ? problem.message : "network error");
    }
  }

  if (!response) {
    // Keys Google rotated out an hour ago still verify tokens signed with them;
    // a stale set beats refusing every upload while the fetch is failing.
    if (jwks) return jwks.keys;
    console.error("JWKS fetch failed:", failures.join("; "));
    throw new Error(`Could not reach Google's signing keys (${failures.join("; ")}).`);
  }

  const body = (await response.json()) as { keys: (JsonWebKey & { kid?: string })[] };
  const keys: Record<string, CryptoKey> = {};
  for (const key of body.keys) {
    if (!key.kid) continue;
    keys[key.kid] = await crypto.subtle.importKey(
      "jwk",
      key,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
  }

  // Google says how long they are good for; honour it rather than guessing.
  const control = response.headers.get("cache-control") ?? "";
  const maxAge = Number(/max-age=(\d+)/.exec(control)?.[1] ?? 3600);
  jwks = { keys, expires: Date.now() + maxAge * 1000 };
  return keys;
}

/**
 * Returns the caller's claims, or throws. Every check is load-bearing: without
 * the signature check anyone can mint a token naming you, and without the
 * audience check a token from a stranger's Firebase project passes the
 * signature check perfectly well.
 */
async function verify(token: string): Promise<Claims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed token.");
  const [rawHeader, rawPayload, rawSignature] = parts as [string, string, string];

  const header = JSON.parse(
    new TextDecoder().decode(base64UrlToBytes(rawHeader))
  ) as { alg: string; kid?: string };
  if (header.alg !== "RS256") throw new Error("Unexpected token algorithm.");
  if (!header.kid) throw new Error("Token names no signing key.");

  const key = (await signingKeys())[header.kid];
  if (!key) throw new Error("Token signed by an unknown key.");

  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlToBytes(rawSignature) as BufferSource,
    new TextEncoder().encode(`${rawHeader}.${rawPayload}`) as BufferSource
  );
  if (!ok) throw new Error("Token signature does not check out.");

  const claims = JSON.parse(
    new TextDecoder().decode(base64UrlToBytes(rawPayload))
  ) as Claims;

  const now = Math.floor(Date.now() / 1000);
  if (claims.exp <= now) throw new Error("Token has expired. Sign in again.");
  if (claims.iat > now + 60) throw new Error("Token is not valid yet.");
  if (claims.aud !== env.FIREBASE_PROJECT_ID) {
    throw new Error("Token was issued for a different project.");
  }
  if (claims.iss !== `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`) {
    throw new Error("Token has the wrong issuer.");
  }
  if (!claims.sub) throw new Error("Token names no subject.");

  return claims;
}

/* -------------------------------------------------------------------------
   the route
   ------------------------------------------------------------------------- */

function fail(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

/**
 * `covers/KSK-038/1723-sleeve.png` — the shape KERNEL asks for, rebuilt here
 * from its pieces rather than trusted. A key is a path, and a path the caller
 * writes is a path the caller can walk out of.
 */
function safeKey(raw: string): string | null {
  const segments = raw.replace(/^\/+/, "").split("/");
  if (segments.length < 2) return null;
  if (segments.some((part) => part === "" || part === "." || part === "..")) {
    return null;
  }
  const cleaned = segments.map((part) =>
    part.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120)
  );
  if (cleaned[0] !== "covers" && cleaned[0] !== "audio") return null;
  return cleaned.join("/");
}

/**
 * The gate both methods pass through. Returns the caller's address, or the
 * response to send instead — writing and deleting are the same privilege, and
 * two copies of this check would be two places to get it wrong.
 */
async function editorOrFailure(
  request: Request
): Promise<{ email: string; failure?: undefined } | { failure: Response; email?: undefined }> {
  const authorization = request.headers.get("Authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (!token) return { failure: fail("Sign in to upload.", 401) };

  let claims: Claims;
  try {
    claims = await verify(token);
  } catch (problem) {
    return {
      failure: fail(
        problem instanceof Error ? problem.message : "Token rejected.",
        401
      ),
    };
  }

  const editors = (env.EDITORS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  const email = claims.email?.toLowerCase() ?? "";
  if (!claims.email_verified || !editors.includes(email)) {
    return { failure: fail("That account cannot upload to this bucket.", 403) };
  }

  return { email };
}

export const PUT: APIRoute = async ({ request, params }) => {
  const gate = await editorOrFailure(request);
  if (gate.failure) return gate.failure;
  const email = gate.email;

  const key = safeKey(params.key ?? "");
  if (!key) return fail("Bad upload path.", 400);

  const type = request.headers.get("Content-Type") ?? "";
  if (!ACCEPTED.includes(type)) {
    return fail(`${type || "That file type"} is not accepted.`, 415);
  }

  const declared = Number(request.headers.get("Content-Length") ?? "0");
  if (declared > MAX_BYTES) {
    return fail(
      `That is ${(declared / 1024 / 1024).toFixed(1)}MB. The limit is ${MAX_BYTES / 1024 / 1024}MB.`,
      413
    );
  }

  if (!request.body) return fail("No file in the request.", 400);

  /*
   * Named rather than left to throw. A missing binding is the one failure that
   * looks like a bug in the browser and is not: the deployed Worker was built
   * without `r2_buckets`, and every upload answers 500 with nothing in it.
   * This was the shape of the first production failure.
   */
  if (!env.BUCKET) {
    return fail(
      "No R2 bucket is bound to this deployment. Check r2_buckets in wrangler.jsonc, then redeploy.",
      500
    );
  }

  try {
    await env.BUCKET.put(key, request.body, {
      httpMetadata: {
        contentType: type,
        // Keys are timestamped by the client, so a given key never changes
        // contents — it can be cached hard and forever.
        cacheControl: "public, max-age=31536000, immutable",
      },
      customMetadata: { uploadedBy: email },
    });
  } catch (problem) {
    // R2 refusing a write says why; a bare 500 does not.
    return fail(
      problem instanceof Error
        ? `The bucket refused the file: ${problem.message}`
        : "The bucket refused the file.",
      502
    );
  }

  // Relative, and read back through `pages/media`. The bucket is private, so
  // there is no public base to bake in — which is also why moving the site to
  // another domain does not strand records saved under the old one.
  return Response.json({ url: `${MEDIA_PREFIX}/${key}`, key });
};

/**
 * Removes an object.
 *
 * Clearing the field in KERNEL without this would leave the bytes in the bucket
 * forever, paid for and unreferenced — and nobody goes back through a bucket
 * later working out which of four hundred objects a record stopped pointing at.
 */
export const DELETE: APIRoute = async ({ request, params }) => {
  const gate = await editorOrFailure(request);
  if (gate.failure) return gate.failure;

  const key = safeKey(params.key ?? "");
  if (!key) return fail("Bad path.", 400);
  if (!env.BUCKET) return fail("No R2 bucket is bound to this deployment.", 500);

  try {
    await env.BUCKET.delete(key);
  } catch (problem) {
    return fail(
      problem instanceof Error
        ? `The bucket refused the delete: ${problem.message}`
        : "The bucket refused the delete.",
      502
    );
  }
  return Response.json({ key });
};

/** Anything else here is a mistake worth naming rather than a 404. */
export const ALL: APIRoute = () =>
  fail("Only PUT and DELETE are accepted here.", 405);
