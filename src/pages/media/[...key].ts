import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";

/**
 * Reads out of R2 — the other half of `api/upload`.
 *
 * **The bucket is private.** It could have been public, with browsers fetching
 * from an `r2.dev` URL directly, and that would cost nothing to run. Serving
 * through the site instead buys three things worth more than the invocations:
 *
 * 1. **No CORS policy to maintain.** `peaks.ts` fetches a track and decodes it
 *    to draw the real waveform, and `artwork.ts` reads a sleeve with
 *    `crossOrigin="anonymous"` to sample the accent. Both are cross-origin
 *    reads against a public bucket, and both fail *silently* — a generic
 *    waveform, an accent that stopped coming from the artwork. Same origin,
 *    and the question does not arise.
 * 2. **Stored URLs stay relative.** What goes into Firestore is
 *    `/media/audio/KSK-038/…`, so moving the site to another domain does not
 *    strand every record that was saved under the old one.
 * 3. Nothing is reachable except through a path the catalogue names.
 *
 * Range requests are handled properly, which is not optional: without them the
 * deck cannot seek inside a track — the browser asks for a byte range and a
 * server that answers 200 with the whole file every time makes scrubbing a
 * download.
 */

export const prerender = false;

/** The prefix stored URLs carry. `api/upload` writes it; this route answers it. */
export const MEDIA_PREFIX = "/media";

/** Mirrors the upload side: a key is a path, and a path can be walked out of. */
function safeKey(raw: string): string | null {
  const segments = raw.replace(/^\/+/, "").split("/");
  if (segments.length < 2) return null;
  if (segments.some((part) => part === "" || part === "." || part === "..")) {
    return null;
  }
  if (segments[0] !== "covers" && segments[0] !== "audio") return null;
  return segments.join("/");
}

export const GET: APIRoute = async ({ request, params }) => {
  const key = safeKey(params.key ?? "");
  if (!key) return new Response("Not found.", { status: 404 });

  /* Named for the same reason the upload route names it: a deployment built
     without the binding otherwise answers 500 for every cover on the site, and
     nothing says why. */
  if (!env.BUCKET) {
    return new Response(
      "No R2 bucket is bound to this deployment. Check r2_buckets in wrangler.jsonc.",
      { status: 500 }
    );
  }

  // The binding reads `Range` and `If-None-Match` off the headers itself, which
  // is both less code and less of it to get subtly wrong.
  let object;
  try {
    object = await env.BUCKET.get(key, {
      range: request.headers,
      onlyIf: request.headers,
    });
  } catch (problem) {
    return new Response(
      problem instanceof Error ? problem.message : "The bucket read failed.",
      { status: 502 }
    );
  }

  if (!object) return new Response("Not found.", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  // Keys are timestamped on upload, so a key's bytes never change.
  headers.set("cache-control", "public, max-age=31536000, immutable");

  // `onlyIf` makes the binding hand back a bodiless `R2Object` when the
  // client's copy is still good — the whole point of asking conditionally.
  if (!("body" in object)) return new Response(null, { status: 304, headers });

  const range = object.range;
  if (range && ("offset" in range || "length" in range)) {
    const offset = "offset" in range ? range.offset ?? 0 : 0;
    const length =
      "length" in range && range.length !== undefined
        ? range.length
        : object.size - offset;
    const end = offset + length - 1;
    headers.set("content-range", `bytes ${offset}-${end}/${object.size}`);
    headers.set("content-length", String(length));
    return new Response(object.body, { status: 206, headers });
  }

  headers.set("content-length", String(object.size));
  return new Response(object.body, { status: 200, headers });
};

/** A player asks this before it asks for bytes. */
export const HEAD: APIRoute = async (context) => {
  const response = await GET(context);
  return new Response(null, {
    status: response.status,
    headers: response.headers,
  });
};
