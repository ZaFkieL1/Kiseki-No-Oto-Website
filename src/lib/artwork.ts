/**
 * Sleeve art, generated.
 *
 * No cover images ship with this repo, so each release draws its own from its
 * seed: same catalogue number, same sleeve, every time. Four compositions,
 * picked by seed, all tinted by the release hue the OS also adopts.
 *
 * Real artwork wins when it exists — see `cover` handling in Artwork.tsx.
 */

import { mulberry32 } from "./data";

/**
 * Capped LRU. The release scenes mount backgrounds and foregrounds for
 * whatever is near the viewport, and a full-size canvas is several megabytes —
 * an unbounded cache across a 38-record catalogue would run into hundreds.
 */
const CACHE_LIMIT = 32;
const cache = new Map<string, HTMLCanvasElement>();

function remember(key: string, canvas: HTMLCanvasElement): HTMLCanvasElement {
  cache.set(key, canvas);
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  return canvas;
}

function recall(key: string): HTMLCanvasElement | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  // Touch it so the most recently used entries survive eviction.
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

const GLYPHS = ["奇", "音", "光", "夢", "零", "爆", "雷", "花", "闇", "翔"];

export function renderCover(
  seed: number,
  hue: number,
  size: number
): HTMLCanvasElement {
  const key = `${seed}:${hue}:${size}`;
  const hit = recall(key);
  if (hit) return hit;

  const canvas = document.createElement("canvas");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const rand = mulberry32(seed);
  const s = size;

  // --- ground ---------------------------------------------------------
  ctx.fillStyle = `hsl(${hue} 45% 5%)`;
  ctx.fillRect(0, 0, s, s);

  const glow = ctx.createRadialGradient(
    s * (0.3 + rand() * 0.4),
    s * (0.25 + rand() * 0.4),
    0,
    s * 0.5,
    s * 0.5,
    s * 0.85
  );
  glow.addColorStop(0, `hsl(${hue} 90% 58% / 0.85)`);
  glow.addColorStop(0.55, `hsl(${(hue + 28) % 360} 80% 30% / 0.5)`);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, s, s);

  const ink = `hsl(${hue} 20% 4%)`;
  const paper = `hsl(${(hue + 180) % 360} 30% 96%)`;

  // --- composition ----------------------------------------------------
  const form = Math.floor(rand() * 4);

  if (form === 0) {
    // concentric — a record seen head on
    const cx = s * 0.5;
    const cy = s * 0.5;
    ctx.strokeStyle = ink;
    for (let r = s * 0.06; r < s * 0.72; r += s * (0.018 + rand() * 0.03)) {
      ctx.lineWidth = 1 + rand() * 3;
      ctx.globalAlpha = 0.25 + rand() * 0.55;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = paper;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.045, 0, Math.PI * 2);
    ctx.fill();
  } else if (form === 1) {
    // diagonal bands
    ctx.save();
    ctx.translate(s * 0.5, s * 0.5);
    ctx.rotate((-25 + rand() * 50) * (Math.PI / 180));
    ctx.translate(-s, -s);
    let y = 0;
    while (y < s * 2) {
      const h = s * (0.01 + rand() * 0.07);
      ctx.globalAlpha = 0.15 + rand() * 0.6;
      ctx.fillStyle = rand() > 0.78 ? paper : ink;
      ctx.fillRect(0, y, s * 2, h);
      y += h + s * (0.005 + rand() * 0.035);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  } else if (form === 2) {
    // burst
    const cx = s * (0.35 + rand() * 0.3);
    const cy = s * (0.35 + rand() * 0.3);
    const spokes = 18 + Math.floor(rand() * 26);
    ctx.fillStyle = ink;
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2;
      const w = 0.006 + rand() * 0.04;
      ctx.globalAlpha = 0.3 + rand() * 0.55;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, s * 1.2, a, a + w);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else {
    // mosaic
    const cells = 6 + Math.floor(rand() * 6);
    const unit = s / cells;
    for (let x = 0; x < cells; x++) {
      for (let y = 0; y < cells; y++) {
        const roll = rand();
        if (roll < 0.42) continue;
        ctx.globalAlpha = 0.2 + rand() * 0.65;
        ctx.fillStyle = roll > 0.9 ? paper : ink;
        const inset = rand() > 0.7 ? unit * 0.18 : 0;
        ctx.fillRect(
          x * unit + inset,
          y * unit + inset,
          unit - inset * 2,
          unit - inset * 2
        );
      }
    }
    ctx.globalAlpha = 1;
  }

  // --- glyph ----------------------------------------------------------
  const glyph = GLYPHS[Math.floor(rand() * GLYPHS.length)]!;
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = rand() > 0.5 ? paper : ink;
  ctx.font = `900 ${s * 0.42}px "Zen Kaku Gothic New", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(glyph, s * (0.3 + rand() * 0.4), s * (0.35 + rand() * 0.3));
  ctx.globalAlpha = 1;

  // --- grain ----------------------------------------------------------
  // Via an offscreen canvas: putImageData replaces pixels instead of
  // compositing them, so writing grain straight onto the sleeve would erase it.
  const grain = document.createElement("canvas");
  grain.width = s;
  grain.height = s;
  const gctx = grain.getContext("2d")!;
  const pixels = gctx.createImageData(s, s);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 255;
    pixels.data[i] = v;
    pixels.data[i + 1] = v;
    pixels.data[i + 2] = v;
    pixels.data[i + 3] = 14;
  }
  gctx.putImageData(pixels, 0, 0);
  ctx.drawImage(grain, 0, 0, s, s);

  // Only keep it once the display face is available, or the glyph is cached
  // forever in a fallback typeface.
  if (fontsLoaded()) remember(key, canvas);
  return canvas;
}

function fontsLoaded(): boolean {
  return typeof document !== "undefined" && document.fonts?.status === "loaded";
}

/**
 * Isolate one channel of a cover so the three can be recombined with an
 * offset — the aberration in the disc bay is a real channel split, not a
 * coloured drop-shadow.
 */
export function channel(
  source: HTMLCanvasElement,
  rgb: "r" | "g" | "b"
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0);
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = rgb === "r" ? "#f00" : rgb === "g" ? "#0f0" : "#00f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

/* -------------------------------------------------------------------------
   real sleeves
   ------------------------------------------------------------------------- */

const images = new Map<string, Promise<HTMLImageElement>>();
const hues = new Map<string, number>();

function isCrossOrigin(url: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URL(url, window.location.href).origin !== window.location.origin;
  } catch {
    return false;
  }
}

function fetchImage(url: string, anonymous: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    // Without this a cover served from another host taints every canvas it is
    // drawn into, and `dominantHue` throws on `getImageData` — which is how
    // uploaded sleeves would silently stop tinting the interface.
    if (anonymous) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`cover failed: ${url}`));
    img.src = encodeURI(url);
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  const hit = images.get(url);
  if (hit) return hit;

  const remote = isCrossOrigin(url);
  // A host that sends no CORS headers refuses an anonymous request outright,
  // so fall back to a plain load: a visible sleeve that cannot be sampled
  // beats no sleeve at all.
  const job = remote
    ? fetchImage(url, true).catch(() => fetchImage(url, false))
    : fetchImage(url, false);

  images.set(url, job);
  return job;
}

/**
 * A real sleeve, drawn square at the size we actually display. Decoding a
 * large PNG once into a small canvas keeps the channel split cheap.
 */
export async function coverCanvas(
  url: string,
  size: number
): Promise<HTMLCanvasElement> {
  const key = `img:${url}:${size}`;
  const hit = recall(key);
  if (hit) return hit;

  const img = await loadImage(url);
  const canvas = document.createElement("canvas");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext("2d")!;

  // Cover-fit, so a non-square sleeve is cropped rather than squashed.
  const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);

  return remember(key, canvas);
}

/**
 * The dominant hue of a sleeve, so the interface can take its accent from the
 * real artwork the same way it takes one from a generated cover.
 */
export async function dominantHue(url: string): Promise<number> {
  const hit = hues.get(url);
  if (hit !== undefined) return hit;

  const img = await loadImage(url);
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 48;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, 48, 48);

  // Still reachable when the anonymous load above fell back: the sleeve is on
  // screen but the pixels are not readable. Rejecting lets the caller keep the
  // release's own hue instead of tinting the whole chassis from an exception.
  let data: Uint8ClampedArray;
  try {
    ({ data } = ctx.getImageData(0, 0, 48, 48));
  } catch {
    throw new Error(`cover is not readable cross-origin: ${url}`);
  }

  // Average hue as a vector, weighted by saturation — averaging the angle
  // directly would put red and violet in the middle of the spectrum.
  let x = 0;
  let y = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]! / 255;
    const g = data[i + 1]! / 255;
    const b = data[i + 2]! / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    if (delta < 0.08 || max < 0.12) continue;

    let h: number;
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;

    const weight = delta * max;
    x += Math.cos((h * Math.PI) / 180) * weight;
    y += Math.sin((h * Math.PI) / 180) * weight;
  }

  let hue = Math.round((Math.atan2(y, x) * 180) / Math.PI);
  if (hue < 0) hue += 360;
  if (x === 0 && y === 0) hue = 340; // fully desaturated sleeve

  hues.set(url, hue);
  return hue;
}

/** A small mark for an artist record — quieter than a sleeve. */
export function renderSigil(seed: number, size: number): HTMLCanvasElement {
  const key = `sigil:${seed}:${size}`;
  const hit = recall(key);
  if (hit) return hit;

  const canvas = document.createElement("canvas");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const rand = mulberry32(seed);
  const cells = 5;
  const unit = size / cells;

  ctx.fillStyle = "#0b0d13";
  ctx.fillRect(0, 0, size, size);

  // Mirrored down the centre so it reads as a mark rather than noise.
  for (let x = 0; x < Math.ceil(cells / 2); x++) {
    for (let y = 0; y < cells; y++) {
      if (rand() < 0.5) continue;
      ctx.fillStyle = `rgba(238,241,247,${0.25 + rand() * 0.6})`;
      ctx.fillRect(x * unit, y * unit, unit, unit);
      ctx.fillRect((cells - 1 - x) * unit, y * unit, unit, unit);
    }
  }

  remember(key, canvas);
  return canvas;
}

/**
 * A plausible track envelope: quiet intro, build, two drops, breakdown.
 * Drawn as the scrubber, then modulated live by the analyser.
 */
export function waveformShape(seed: number, bars = 180): number[] {
  const rand = mulberry32(seed ^ 0x9e37);
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    const p = i / bars;
    let energy: number;
    if (p < 0.08) energy = 0.18 + p * 2;
    else if (p < 0.28) energy = 0.42 + (p - 0.08) * 1.6;
    else if (p < 0.5) energy = 0.92;
    else if (p < 0.62) energy = 0.3;
    else if (p < 0.9) energy = 0.95;
    else energy = 0.95 - (p - 0.9) * 7;
    const kick = i % 4 === 0 ? 1.05 : 0.86;
    out.push(
      Math.max(0.05, Math.min(1, energy * kick * (0.72 + rand() * 0.45)))
    );
  }
  return out;
}
