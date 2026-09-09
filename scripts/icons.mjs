/**
 * Regenerates every icon and the share image from the brush lockup.
 *
 * Run with `pnpm icons` after changing `public/KNO blanco.png`. The outputs are
 * committed rather than built on the fly: they are static assets a crawler and
 * a browser tab fetch directly, and a build step that can fail is not something
 * a favicon should depend on.
 *
 * **`flatten` is the whole trick.** The lockup is a *white* brush on real
 * transparency — `blanco` is the ink, not the ground — so anything that
 * composites it on white gets an empty frame, which is what a social scraper
 * and half the browser tabs in the world do. Every output here is flattened
 * onto `--void` first, so the icon carries its own black and looks like the
 * site no matter what it is dropped onto.
 */

import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(root, "public", "KNO blanco.png");
const out = (name) => join(root, "public", name);

/** `--void`, so an icon dropped on any surface still reads as this site. */
const BLACK = { r: 6, g: 7, b: 11, alpha: 1 };

/** A square icon: the lockup fitted whole, never cropped. */
const square = (size) =>
  sharp(SOURCE)
    .resize(size, size, { fit: "contain", background: BLACK })
    .flatten({ background: BLACK })
    .png({ compressionLevel: 9 })
    .toBuffer();

/**
 * An ICO holding PNGs, which every browser since IE11 reads.
 *
 * Written by hand because sharp has no ICO encoder. The format is a 6-byte
 * header, one 16-byte directory entry per image, then the images themselves —
 * and a PNG may be embedded whole rather than converted to a DIB.
 */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    // 0 means 256 — the one place this format counts from a full byte.
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

const written = [];
const save = async (name, data) => {
  await writeFile(out(name), data);
  written.push(`${name} · ${(data.length / 1024).toFixed(1)}KB`);
};

await mkdir(join(root, "public"), { recursive: true });

/* ---- the tab ---- */
const sizes = [16, 32, 48];
const small = await Promise.all(
  sizes.map(async (size) => ({ size, data: await square(size) }))
);
await save("favicon.ico", ico(small));
await save("favicon-32.png", small[1].data);

/* ---- the home screen ---- */
await save("apple-touch-icon.png", await square(180));
await save("icon-192.png", await square(192));
await save("icon-512.png", await square(512));

/* ---- the share card ----
   1200×630 is what every scraper crops to. The lockup is fitted rather than
   filled: cutting the brush in half to cover the frame would be worse than
   the black around it, which is the artwork's own ground anyway. */
await save(
  "og-image.png",
  await sharp(SOURCE)
    .resize(1200, 630, { fit: "contain", background: BLACK })
    .flatten({ background: BLACK })
    .png({ compressionLevel: 9 })
    .toBuffer()
);

console.log(written.map((line) => `  ${line}`).join("\n"));
