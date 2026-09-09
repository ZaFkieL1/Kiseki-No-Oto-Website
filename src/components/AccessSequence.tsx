import { useEffect, useState } from "react";
import { useReducedMotion } from "../lib/hooks";

/**
 * The handoff between views. Short enough to read as part of the machine
 * rather than as a loading screen — the whole sequence is under a second, and
 * reduced motion collapses it to the final line.
 */
export default function AccessSequence({
  lines,
  duration,
}: {
  lines: string[];
  duration: number;
}): React.ReactElement {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(reduced ? lines.length - 1 : 0);

  useEffect(() => {
    if (reduced || lines.length < 2) return;
    const gap = duration / lines.length;
    const id = setInterval(() => {
      setStep((s) => Math.min(s + 1, lines.length - 1));
    }, gap);
    return () => clearInterval(id);
  }, [lines, duration, reduced]);

  return (
    <div className="access" role="status">
      <div className="access__log">
        {lines.slice(0, step + 1).map((line) => (
          <span className="access__line" key={line}>
            {line}
          </span>
        ))}
      </div>
      <span className="access__bar">
        <i style={{ animationDuration: `${duration}ms` }} />
      </span>
    </div>
  );
}
