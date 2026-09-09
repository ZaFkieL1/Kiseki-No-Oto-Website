import { useEffect, useRef } from "react";
import { deck } from "../lib/audio";
import { fitCanvas, useReducedMotion } from "../lib/hooks";

/**
 * A dot lattice that a bass hit pushes outward in a ring. It is invisible
 * until the deck runs, which is the whole point: the room only comes alive
 * once there is something playing in it.
 */
export default function Ambient({
  live,
  hue,
}: {
  live: boolean;
  hue: number;
}): React.ReactElement {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || reduced) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let phase = 0;

    const draw = (): void => {
      raf = requestAnimationFrame(draw);
      const { w, h, dpr } = fitCanvas(canvas);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const { bass, high } = deck.getLevels();
      if (bass < 0.01 && high < 0.01) return;

      phase += 0.02 + bass * 0.05;
      const cx = w / 2;
      const cy = h / 2;
      const gap = 38;

      ctx.fillStyle = `hsl(${hue} 80% 70%)`;
      for (let x = gap / 2; x < w; x += gap) {
        for (let y = gap / 2; y < h; y += gap) {
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.hypot(dx, dy);
          const wave = Math.sin(dist * 0.012 - phase) * bass * 9;
          const angle = Math.atan2(dy, dx);
          const px = x + Math.cos(angle) * wave;
          const py = y + Math.sin(angle) * wave;
          const size = 1 + high * 1.1;
          ctx.globalAlpha = 0.05 + bass * 0.16 * (1 - dist / (w * 0.9));
          ctx.fillRect(px, py, size, size);
        }
      }
      ctx.globalAlpha = 1;
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [hue, reduced]);

  return (
    <div className={`ambient${live ? " ambient--live" : ""}`} aria-hidden="true">
      <canvas ref={ref} />
    </div>
  );
}
