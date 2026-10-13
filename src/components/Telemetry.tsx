import { useEffect, useState } from "react";
import { useDeck } from "../lib/hooks";
import { formatTime } from "../lib/data";

/**
 * Six readings, one corner, small and dim. Enough for the interface to feel
 * instrumented; few enough that it stays an interface and not a cockpit.
 */
export default function Telemetry({
  sessionStart,
  mode,
}: {
  sessionStart: number;
  /** Which view the operator is in — real state, unlike a made-up server. */
  mode: string;
}): React.ReactElement {
  const { playing, source } = useDeck();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const clock = now.toTimeString().slice(0, 8);
  const session = formatTime((Date.now() - sessionStart) / 1000);

  return (
    <div className="telemetry">
      <div className="tel">
        <span className="hud">Audio</span>
        <span className="tel__v tel__v--ice">
          <i className={`dot${playing ? " dot--live" : ""}`} />
          {playing ? "48 kHz" : "idle"}
        </span>
      </div>
      <div className="tel">
        <span className="hud">Source</span>
        <span className="tel__v">{source}</span>
      </div>
      <div className="tel">
        <span className="hud">Link</span>
        <span className="meter" aria-hidden="true">
          <i style={{ scale: "1 1" }} />
        </span>
      </div>
      <div className="tel">
        <span className="hud">Mode</span>
        <span className="tel__v">{mode}</span>
      </div>
      <div className="tel">
        <span className="hud">Time</span>
        <span className="tel__v">{clock}</span>
      </div>
      <div className="tel">
        <span className="hud">Session</span>
        <span className="tel__v">{session}</span>
      </div>
    </div>
  );
}
