import { useEffect, useMemo, useRef, useState } from "react";
import { useCatalogue } from "../../lib/hooks";
import ReleaseScene from "./ReleaseScene";

type Sort = "newest" | "oldest";

/** How many scenes either side of the viewport get their artwork mounted. */
const NEAR_MARGIN = "120% 0px";

export default function ReleaseDatabase(): React.ReactElement {
  const [sort, setSort] = useState<Sort>("newest");
  const [current, setCurrent] = useState(0);
  const [near, setNear] = useState<Set<number>>(() => new Set([0, 1]));
  const rootRef = useRef<HTMLDivElement>(null);
  const { releases } = useCatalogue();

  // The catalogue is stored newest first, so "oldest" is simply the reverse.
  const ordered = useMemo(
    () => (sort === "newest" ? releases : [...releases].reverse()),
    [sort, releases]
  );

  useEffect(() => {
    const root = rootRef.current?.closest(".pane") as HTMLElement | null;
    if (!root) return;

    const scenes = Array.from(
      root.querySelectorAll<HTMLElement>("[data-index]")
    );

    // Two passes with different intents: one decides what to load, the other
    // decides what the interface is currently *about*.
    const loader = new IntersectionObserver(
      (entries) => {
        setNear((prev) => {
          const next = new Set(prev);
          let changed = false;
          for (const entry of entries) {
            const index = Number(
              (entry.target as HTMLElement).dataset.index ?? -1
            );
            if (index < 0) continue;
            if (entry.isIntersecting && !next.has(index)) {
              next.add(index);
              changed = true;
            } else if (!entry.isIntersecting && next.has(index)) {
              // Unmount distant artwork — 38 live canvases would cost
              // hundreds of megabytes.
              next.delete(index);
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      },
      { root, rootMargin: NEAR_MARGIN, threshold: 0 }
    );

    const focus = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number(
            (entry.target as HTMLElement).dataset.index ?? -1
          );
          if (index >= 0) setCurrent(index);
        }
      },
      { root, rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );

    for (const scene of scenes) {
      loader.observe(scene);
      focus.observe(scene);
    }

    return () => {
      loader.disconnect();
      focus.disconnect();
    };
  }, [ordered]);

  const changeSort = (next: Sort): void => {
    if (next === sort) return;
    setSort(next);
    setCurrent(0);
    setNear(new Set([0, 1]));
    rootRef.current?.closest(".pane")?.scrollTo({ top: 0 });
  };

  const showing = ordered[current];

  return (
    <div className="rel" ref={rootRef}>
      <div className="rel__bar">
        <span className="pane__title">Release database</span>
        <span className="jp">リリース</span>
        <span className="hud">{releases.length} releases found</span>

        <div className="rel__sort">
          <span className="hud">Sort</span>
          <button
            className="rel__sortbtn"
            aria-pressed={sort === "newest"}
            onClick={() => changeSort("newest")}
            data-cursor="sort newest"
          >
            Newest
          </button>
          <button
            className="rel__sortbtn"
            aria-pressed={sort === "oldest"}
            onClick={() => changeSort("oldest")}
            data-cursor="sort oldest"
          >
            Oldest
          </button>
        </div>
      </div>

      {ordered.map((release, index) => (
        <ReleaseScene
          key={release.cat}
          release={release}
          index={index}
          active={index === current}
          near={near.has(index)}
        />
      ))}

      <div className="rel__progress" aria-hidden="true">
        <span className="hud">Release</span>
        <span className="rel__counter">
          {String(current + 1).padStart(3, "0")}
          <i> / </i>
          {String(ordered.length).padStart(3, "0")}
        </span>
        <span className="rel__track">
          <i
            style={{
              transform: `scaleY(${(current + 1) / ordered.length})`,
            }}
          />
        </span>
        {showing && <span className="hud">{showing.cat}</span>}
      </div>
    </div>
  );
}
