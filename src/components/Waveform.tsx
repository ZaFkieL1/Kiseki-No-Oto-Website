import { useEffect, useRef, useState } from "react";
import { waveformShape } from "../lib/artwork";
import { deck } from "../lib/audio";
import { formatTime } from "../lib/data";
import { cachedPeaks, loadPeaks } from "../lib/peaks";
import { fitCanvas, usePosition } from "../lib/hooks";

/**
 * The scrubber.
 *
 * The bars are the track's real dynamics, measured once from the file, and
 * they do not move — a waveform that wobbles with the analyser tells you
 * nothing about the track and makes the whole strip hard to aim at. The only
 * things that change here are the progress fill and the playhead.
 */
export default function Waveform({
  seed,
  hue,
  duration,
  audio,
  variant = "dock",
}: {
  seed: number;
  hue: number;
  duration: number;
  audio?: string;
  variant?: "dock" | "hero";
}): React.ReactElement {
  const ref = useRef<HTMLCanvasElement>(null);
  const hitRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const position = usePosition();

  const [peaks, setPeaks] = useState<number[] | null>(() =>
    audio ? cachedPeaks(audio) : null
  );

  // Measure the real file. Until it lands, the seeded shape stands in — it is
  // replaced, never blended, so the bars are always one honest thing.
  useEffect(() => {
    if (!audio) {
      setPeaks(null);
      return;
    }
    let cancelled = false;
    void loadPeaks(audio).then((result) => {
      if (!cancelled && result) setPeaks(result);
    });
    return () => {
      cancelled = true;
    };
  }, [audio]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const shape = peaks ?? waveformShape(seed);

    const played = `hsl(${hue} 88% 62%)`;
    const pending = "rgba(180,196,235,0.26)";
    const head = `hsl(${hue} 95% 82%)`;

    let raf = 0;
    let last = "";

    const draw = (): void => {
      raf = requestAnimationFrame(draw);

      const rect = canvas.getBoundingClientRect();
      const width = Math.round(rect.width);
      const progress =
        duration > 0 ? Math.min(1, deck.position / duration) : 0;
      const playedPx = Math.round(progress * width);
      const hover = hoverRef.current;

      // Static bars mean there is nothing to repaint until the playhead moves
      // a whole pixel.
      const signature = `${playedPx}:${hover ?? -1}:${width}:${shape.length}`;
      if (signature === last) return;
      last = signature;

      const { w, h, dpr } = fitCanvas(canvas);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const step = variant === "hero" ? 4 : 3;
      const bars = Math.max(8, Math.floor(w / step));
      const centre = h / 2;

      for (let i = 0; i < bars; i++) {
        const t = i / bars;
        const value = shape[Math.floor(t * shape.length)] ?? 0.2;
        const amp = Math.max(1, value * (h / 2 - 1));
        const x = i * step;

        ctx.fillStyle = x < playedPx ? played : pending;
        ctx.fillRect(x, centre - amp, step - 1, amp * 2);
      }

      ctx.fillStyle = head;
      ctx.fillRect(playedPx - 0.5, 0, 1.5, h);

      // Where you are about to land, drawn on the strip itself — a title
      // attribute would go stale, since hovering deliberately never re-renders.
      if (hover !== null && hover >= 0 && duration > 0) {
        ctx.fillStyle = "rgba(238,241,247,0.4)";
        ctx.fillRect(hover, 0, 1, h);

        const label = formatTime((hover / w) * duration);
        ctx.font = '400 9px "Martian Mono", ui-monospace, monospace';
        ctx.textBaseline = "middle";
        const textWidth = ctx.measureText(label).width;
        const x = Math.min(w - textWidth - 4, Math.max(4, hover + 7));
        ctx.fillStyle = "rgba(6,7,11,0.88)";
        ctx.fillRect(x - 3, centre - 7, textWidth + 6, 14);
        ctx.fillStyle = "#eef1f7";
        ctx.fillText(label, x, centre);
      }
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [seed, hue, duration, peaks, variant]);

  const ratioAt = (clientX: number): number => {
    const rect = hitRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const seekTo = (clientX: number): void => {
    if (duration <= 0) return;
    deck.seek(ratioAt(clientX) * duration);
  };

  return (
    <div className={`wave wave--${variant}`}>
      <canvas ref={ref} />
      <div
        ref={hitRef}
        className="wave__hit"
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(position)}
        aria-valuetext={
          duration > 0
            ? `${formatTime(position)} of ${formatTime(duration)}`
            : "Track length not loaded yet"
        }
        aria-disabled={duration <= 0}
        data-cursor={duration > 0 ? "seek" : undefined}
        onPointerDown={(e) => {
          if (duration <= 0) return;
          draggingRef.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          seekTo(e.clientX);
        }}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          hoverRef.current = Math.round(e.clientX - rect.left);
          if (draggingRef.current) seekTo(e.clientX);
        }}
        onPointerUp={(e) => {
          draggingRef.current = false;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerLeave={() => {
          hoverRef.current = null;
        }}
        onKeyDown={(e) => {
          if (duration <= 0) return;
          // Stop the window-level shortcut from seeking a second time.
          if (e.key === "ArrowRight") {
            e.stopPropagation();
            deck.seek(deck.position + 5);
          }
          if (e.key === "ArrowLeft") {
            e.stopPropagation();
            deck.seek(deck.position - 5);
          }
          if (e.key === "Home") {
            e.stopPropagation();
            deck.seek(0);
          }
        }}
      />
    </div>
  );
}
