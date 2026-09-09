import { useEffect, useState, useSyncExternalStore } from "react";
import { deck, type DeckState } from "./audio";
import { language, type Lang } from "./i18n";
import { store } from "./store";
import type { Snapshot } from "./store/types";

/**
 * The current language. Subscribing is the whole job — the words themselves
 * come from `t()`, which reads the same singleton directly.
 */
export function useLang(): Lang {
  return useSyncExternalStore(
    language.subscribe,
    language.getSnapshot,
    language.getServerSnapshot
  );
}

/** Transport state. Changes rarely — safe to re-render on. */
export function useDeck(): DeckState {
  return useSyncExternalStore(
    deck.subscribe,
    deck.getSnapshot,
    deck.getSnapshot
  );
}

/**
 * The live catalogue. Same shape as `useDeck` — the store is another external
 * source of truth that has to outlive any one component.
 *
 * The server snapshot is the same function: under Node the store falls back to
 * the seed, so there is nothing separate to hand back.
 */
export function useCatalogue(): Snapshot {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot
  );
}

/**
 * Playhead, sampled at 10Hz. Deliberately not 60 — the clock only needs to be
 * right, and anything drawing per frame reads `deck.position` directly.
 */
export function usePosition(): number {
  const [position, setPosition] = useState(0);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (t: number): void => {
      raf = requestAnimationFrame(loop);
      if (t - last < 100) return;
      last = t;
      setPosition(deck.position);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return position;
}

/**
 * Sleeve glyphs are drawn into canvas, which does not re-flow when a webfont
 * arrives. Redraw once the fonts settle.
 */
export function useFontsReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (e: MediaQueryListEvent): void => setReduced(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/**
 * One animation frame loop for the whole document: reads the analyser and
 * publishes the bands as CSS custom properties. Anything that wants to move
 * with the music reads `--lvl-bass` in a stylesheet instead of re-rendering.
 */
export function useLevelBus(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    let raf = 0;

    const loop = (): void => {
      raf = requestAnimationFrame(loop);
      const { bass, mid, high } = deck.getLevels();
      root.style.setProperty("--lvl-bass", bass.toFixed(3));
      root.style.setProperty("--lvl-mid", mid.toFixed(3));
      root.style.setProperty("--lvl-high", high.toFixed(3));
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      root.style.setProperty("--lvl-bass", "0");
      root.style.setProperty("--lvl-mid", "0");
      root.style.setProperty("--lvl-high", "0");
    };
  }, [enabled]);
}

/** Sizes a canvas to its box in device pixels. Returns the CSS-pixel size. */
export function fitCanvas(canvas: HTMLCanvasElement): {
  w: number;
  h: number;
  dpr: number;
} {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  return { w, h, dpr };
}
