import { useEffect, useMemo, useRef, useState } from "react";
import { roster } from "../lib/catalogue";
import { t } from "../lib/i18n";
import { useCatalogue, useReducedMotion } from "../lib/hooks";

/**
 * The boot is theatre — nothing is actually being loaded. It runs itself
 * through and hands off to the OS on its own; a machine powering up does not
 * stop to ask permission. Any key or click cuts it short.
 *
 * It used to end on a gate so the dismissing keypress could double as the
 * gesture the AudioContext needs. That is no longer required: `deck.play()`
 * builds and resumes the context on demand, and the hero's PLAY is itself a
 * user gesture — so nothing is silently broken by opening unattended.
 */

interface Step {
  at: number;
  kind: "brand" | "note" | "ok" | "ready";
  text: string;
  note?: string;
}

/** Built per render: the counts are read off the live catalogue. */
function buildScript(releaseCount: number, rosterCount: number): Step[] {
  return [
    { at: 0.1, kind: "brand", text: "KISEKI NO OTO OS v2.06.11" },
    { at: 0.3, kind: "note", text: t("boot.init") },
    { at: 0.6, kind: "ok", text: t("boot.audio"), note: "48000 HZ / 2CH" },
    { at: 0.75, kind: "ok", text: t("boot.visual") },
    { at: 0.9, kind: "ok", text: t("boot.database") },
    { at: 1.05, kind: "ok", text: t("boot.network") },
    {
      at: 1.2,
      kind: "ok",
      text: t("boot.artists"),
      note: `${rosterCount} ${t("boot.artistCount")}`,
    },
    {
      at: 1.35,
      kind: "ok",
      text: t("boot.releases"),
      note: `${releaseCount} ${t("boot.releaseCount")}`,
    },
    { at: 2.4, kind: "note", text: t("boot.connecting") },
    { at: 2.65, kind: "ready", text: t("boot.ready") },
  ];
}

const BAR_START = 1.55;
const BAR_END = 2.35;
const READY_AT = 2.75;
const BLOCKS = 22;
/** Long enough to read SYSTEM READY, short enough not to feel like a wait. */
const HANDOFF = 320;
const FADE = 420;

function progressAt(elapsed: number): number {
  if (elapsed < BAR_START) return 0;
  // Named for what it is, and not `t` — that is the translator.
  const done = (elapsed - BAR_START) / (BAR_END - BAR_START);
  if (done >= 1) return 100;
  // Stall at 94, the way real progress bars always do.
  if (done > 0.78) return 94;
  return Math.round((done / 0.78) * 94);
}

export default function BootSequence({
  onAccess,
}: {
  onAccess: () => void;
}): React.ReactElement {
  const reduced = useReducedMotion();
  // Subscribed for the repaint; the roster count comes off `roster()` below.
  const { releases } = useCatalogue();
  const [elapsed, setElapsed] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const started = useRef(0);
  const ready = elapsed >= READY_AT;

  // Counted through `roster()`, not `artists.length`: the boot log must report
  // the same list 03 ARTISTS shows, and guests are not on it.
  const rosterCount = roster().length;
  const SCRIPT = useMemo(
    () => buildScript(releases.length, rosterCount),
    [releases.length, rosterCount]
  );

  useEffect(() => {
    if (reduced) {
      setElapsed(READY_AT);
      return;
    }
    started.current = performance.now();
    let raf = 0;
    const loop = (): void => {
      const seconds = (performance.now() - started.current) / 1000;
      setElapsed(seconds);
      if (seconds < READY_AT) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  // The log finishes, the system lets go. Nothing here waits on the reader.
  useEffect(() => {
    if (!ready || leaving) return;
    const timer = window.setTimeout(
      () => setLeaving(true),
      reduced ? 0 : HANDOFF
    );
    return () => window.clearTimeout(timer);
  }, [ready, leaving, reduced]);

  // Held in a ref so a re-render of the host cannot restart the handoff timer
  // and leave the boot hanging on screen.
  const accessRef = useRef(onAccess);
  useEffect(() => {
    accessRef.current = onAccess;
  }, [onAccess]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(
      () => accessRef.current(),
      reduced ? 0 : FADE
    );
    return () => window.clearTimeout(timer);
  }, [leaving, reduced]);

  // Any key, any click: straight through. Once it is leaving there is nothing
  // left to skip.
  useEffect(() => {
    const skip = (): void => setLeaving(true);
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, []);

  const visible = SCRIPT.filter((s) => elapsed >= s.at);
  const pct = progressAt(elapsed);
  const filled = Math.round((pct / 100) * BLOCKS);

  return (
    <div className={`boot${leaving ? " boot--out" : ""}`}>
      {/* The log is scenery — announcing every line would just be noise.
          Only the gate, which the reader has to act on, is live. */}
      {visible.map((step) => (
        <div className="boot__line" key={step.text} aria-hidden="true">
          {step.kind === "ok" && <span className="boot__ok">[ OK ]</span>}
          <span
            className={
              step.kind === "brand"
                ? "boot__brand"
                : step.kind === "note"
                ? "boot__note"
                : "boot__label"
            }
          >
            {step.text}
          </span>
          {step.note && <span className="boot__note">{step.note}</span>}
        </div>
      ))}

      {elapsed >= BAR_START && (
        <div className="boot__line" aria-hidden="true">
          <span className="boot__bar">
            {"█".repeat(filled)}
            <span style={{ opacity: 0.25 }}>{"░".repeat(BLOCKS - filled)}</span>
          </span>
          <span className="boot__note">{String(pct).padStart(3, " ")}%</span>
        </div>
      )}

      {ready && (
        <div className="boot__gate" role="status">
          {t("boot.accessing")}
          <span className="caret" aria-hidden="true" />
        </div>
      )}

      {!ready && (
        <div className="boot__skip hud" aria-hidden="true">
          {t("boot.skip")}
        </div>
      )}
    </div>
  );
}
