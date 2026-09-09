import { useEffect, useRef } from "react";
import { channel, coverCanvas, renderCover, renderSigil } from "../lib/artwork";
import { deck } from "../lib/audio";
import { useFontsReady, useReducedMotion } from "../lib/hooks";

/**
 * The disc bay. The sleeve is composited from its three colour channels every
 * frame; the low end pushes them apart. Nothing else on the page moves this
 * much — the aberration is the one place the boldness is spent.
 *
 * Works the same on a real cover image as on a generated one.
 */
export function DiscBay({
  seed,
  hue,
  cover,
  size = 560,
}: {
  seed: number;
  hue: number;
  cover?: string;
  size?: number;
}): React.ReactElement {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const fontsReady = useFontsReady();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    let raf = 0;
    let cancelled = false;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d")!;

    const start = (base: HTMLCanvasElement): void => {
      if (cancelled) return;
      const layers = {
        r: channel(base, "r"),
        g: channel(base, "g"),
        b: channel(base, "b"),
      };

      const draw = (split: number): void => {
        ctx.globalCompositeOperation = "source-over";
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = "lighter";
        const d = split * dpr;
        ctx.drawImage(layers.r, -d, d * 0.35);
        ctx.drawImage(layers.g, 0, 0);
        ctx.drawImage(layers.b, d, -d * 0.35);
      };

      draw(0);
      if (reduced) return;

      let last = -1;
      const loop = (): void => {
        raf = requestAnimationFrame(loop);
        const { bass, high } = deck.getLevels();
        const split = bass * 7 + high * 2;
        if (Math.abs(split - last) < 0.05) return;
        last = split;
        draw(split);
      };
      raf = requestAnimationFrame(loop);
    };

    if (cover) {
      void coverCanvas(cover, size)
        .then(start)
        .catch(() => start(renderCover(seed, hue, size)));
    } else {
      start(renderCover(seed, hue, size));
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [seed, hue, cover, size, reduced, fontsReady]);

  return <canvas ref={ref} className="bay__canvas" aria-hidden="true" />;
}

/** A still sleeve — catalogue rows, the transport dock, the hover bleed. */
export function Cover({
  seed,
  hue,
  size,
  cover,
  className,
  fill = false,
}: {
  seed: number;
  hue: number;
  size: number;
  cover?: string;
  className?: string;
  /** Let the stylesheet size it (used by the catalogue hover bleed). */
  fill?: boolean;
}): React.ReactElement {
  const ref = useRef<HTMLCanvasElement>(null);
  const fontsReady = useFontsReady();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let cancelled = false;

    const paint = (source: HTMLCanvasElement): void => {
      if (cancelled) return;
      canvas.width = source.width;
      canvas.height = source.height;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(source, 0, 0);
    };

    if (cover) {
      void coverCanvas(cover, size)
        .then(paint)
        .catch(() => paint(renderCover(seed, hue, size)));
    } else {
      paint(renderCover(seed, hue, size));
    }

    return () => {
      cancelled = true;
    };
  }, [seed, hue, size, cover, fontsReady]);

  return (
    <canvas
      ref={ref}
      className={className}
      style={fill ? undefined : { width: size, height: size, display: "block" }}
      aria-hidden="true"
    />
  );
}

export function Sigil({
  seed,
  size = 88,
}: {
  seed: number;
  size?: number;
}): React.ReactElement {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const source = renderSigil(seed, size);
    canvas.width = source.width;
    canvas.height = source.height;
    canvas.getContext("2d")!.drawImage(source, 0, 0);
  }, [seed, size]);

  return <canvas ref={ref} className="artist__sigil" aria-hidden="true" />;
}
