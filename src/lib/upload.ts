import { auth } from "./firebase";

/**
 * Uploads, to Cloudflare R2 by way of `pages/api/upload/[...key].ts`.
 *
 * This used to put files in Firebase Storage, where the browser wrote to the
 * bucket directly and `storage.rules` decided whether to allow it. R2 has no
 * equivalent — writing to it needs a credential, and a static site has nowhere
 * to keep one — so the write goes through the site's own on-demand route,
 * which holds the bucket binding and checks the caller's Firebase ID token
 * before touching it.
 *
 * **What is stored is still just a URL**, exactly as before. Records whose
 * cover was typed in as `/cover.png`, or uploaded to Firebase Storage last
 * month, keep working untouched; there is nothing to migrate unless you want
 * the old files moved.
 *
 * `XMLHttpRequest` rather than `fetch` for one reason: it reports upload
 * progress. `fetch` cannot, and a 40MB track uploading behind a control that
 * says nothing is a control that looks broken.
 */

/**
 * Same origin, so there is nothing to configure and no CORS to get wrong. The
 * endpoint is only reachable from a page the browser already trusted, and it
 * refuses anyone who cannot prove they are an editor.
 */
const ENDPOINT = "/api/upload";

/** Where an uploaded file is read back from. Mirrors `pages/media`. */
const MEDIA_PREFIX = "/media";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/avif"];
const AUDIO_TYPES = [
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

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** Under the Worker's own ceiling, so the browser refuses before the round trip. */
const MAX_AUDIO_BYTES = 96 * 1024 * 1024;

export interface UploadHandle {
  /** 0–100. */
  onProgress?: (percent: number) => void;
}

function tooBig(size: number, limit: number): string {
  return `That is ${(size / 1024 / 1024).toFixed(1)}MB. The limit is ${limit / 1024 / 1024}MB.`;
}

/**
 * Rejects before touching the network when the file is obviously wrong — a
 * failed upload after a 6MB round trip is a worse way to learn the format is
 * unsupported.
 */
export function rejectionReason(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) {
    return "Use a PNG, JPEG, WebP or AVIF image.";
  }
  if (file.size > MAX_IMAGE_BYTES) return tooBig(file.size, MAX_IMAGE_BYTES);
  return null;
}

/** The same courtesy for music. The Worker enforces both limits for real. */
export function audioRejectionReason(file: File): string | null {
  if (!AUDIO_TYPES.includes(file.type)) {
    return "Use an MP3, WAV, FLAC, OGG or AAC file.";
  }
  if (file.size > MAX_AUDIO_BYTES) return tooBig(file.size, MAX_AUDIO_BYTES);
  return null;
}

/** Timestamped so replacing a file never serves the old one from cache. */
function keyFor(file: File, folder: string): string {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  return `${folder}/${Date.now()}-${safe}`;
}

async function put(
  file: File,
  key: string,
  handle: UploadHandle
): Promise<string> {
  const user = auth().currentUser;
  if (!user) throw new Error("Sign in again — the session has gone.");
  const token = await user.getIdToken();

  return new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", `${ENDPOINT}/${key}`);
    request.setRequestHeader("Authorization", `Bearer ${token}`);
    request.setRequestHeader("Content-Type", file.type);

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      handle.onProgress?.((event.loaded / event.total) * 100);
    });

    request.addEventListener("load", () => {
      let body: { url?: string; error?: string } = {};
      try {
        body = JSON.parse(request.responseText) as typeof body;
      } catch {
        /* A non-JSON body means the endpoint is wrong, handled below. */
      }

      if (request.status >= 200 && request.status < 300 && body.url) {
        resolve(body.url);
        return;
      }
      reject(
        new Error(
          body.error ??
            (request.status === 404
              ? "The upload route is not there. `astro dev` serves it; a plain static preview does not."
              : `The upload failed (${request.status}).`)
        )
      );
    });

    request.addEventListener("error", () =>
      reject(new Error("The upload failed — the endpoint could not be reached."))
    );
    request.addEventListener("abort", () =>
      reject(new Error("The upload was cancelled."))
    );

    request.send(file);
  });
}

/**
 * Deletes an uploaded file, given the URL the record is holding.
 *
 * Clearing the field alone would leave the bytes in the bucket forever, paid
 * for and unreferenced. A URL that did not come from an upload — a path under
 * `public/`, an old Firebase link — is left alone: there is nothing of ours to
 * delete, and the field still clears.
 */
export async function removeUpload(url: string): Promise<void> {
  if (!url.startsWith(`${MEDIA_PREFIX}/`)) return;
  const key = url.slice(MEDIA_PREFIX.length + 1);

  const user = auth().currentUser;
  if (!user) throw new Error("Sign in again — the session has gone.");

  const response = await fetch(`${ENDPOINT}/${key}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${await user.getIdToken()}` },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Could not delete the file (${response.status}).`);
  }
}

/**
 * Puts an image in the bucket and hands back its public URL, which is what the
 * release record stores — so the site reads artwork the same way whether it was
 * uploaded or typed in as a path.
 */
export async function uploadImage(
  file: File,
  folder: string,
  handle: UploadHandle = {}
): Promise<string> {
  const reason = rejectionReason(file);
  if (reason) throw new Error(reason);
  return put(file, keyFor(file, `covers/${folder}`), handle);
}

/**
 * The same for a song or a record's preview. Kept apart from `uploadImage` so
 * the two carry their own accepted types and ceilings — a sleeve has no
 * business being 40MB, and a master has no business being refused at 8.
 */
export async function uploadAudio(
  file: File,
  folder: string,
  handle: UploadHandle = {}
): Promise<string> {
  const reason = audioRejectionReason(file);
  if (reason) throw new Error(reason);
  return put(file, keyFor(file, `audio/${folder}`), handle);
}
