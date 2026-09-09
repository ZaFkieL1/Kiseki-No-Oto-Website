import { useEffect, useRef, useState } from "react";

/**
 * A crosshair that reports what is under it. The label comes from
 * `data-cursor` on whatever the pointer is over, so the cursor is reading the
 * interface rather than decorating it.
 */
export default function Cursor(): React.ReactElement | null {
  const crossRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    setEnabled(true);

    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const ring = { ...target };
    let raf = 0;

    const onMove = (e: PointerEvent): void => {
      target.x = e.clientX;
      target.y = e.clientY;
      const hit = (e.target as HTMLElement | null)?.closest?.("[data-cursor]");
      setLabel(hit ? hit.getAttribute("data-cursor") : null);
    };

    const loop = (): void => {
      raf = requestAnimationFrame(loop);
      // The ring lags the crosshair. One trailing element, not a particle trail.
      ring.x += (target.x - ring.x) * 0.18;
      ring.y += (target.y - ring.y) * 0.18;
      if (crossRef.current) {
        crossRef.current.style.transform = `translate3d(${target.x}px,${target.y}px,0)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ring.x}px,${ring.y}px,0)`;
      }
    };

    window.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Never mount on touch — the styles only exist behind a fine-pointer query,
  // so these would otherwise land in the document flow as stray nodes.
  if (!enabled) return null;

  return (
    <>
      <div
        ref={ringRef}
        className={`cursor${label ? " cursor--hot" : ""}`}
        aria-hidden="true"
      >
        <div className="cursor__ring" />
      </div>
      <div
        ref={crossRef}
        className={`cursor${label ? " cursor--hot" : ""}`}
        aria-hidden="true"
      >
        <div className="cursor__cross" />
        {label && <div className="cursor__label">{label}</div>}
      </div>
    </>
  );
}
