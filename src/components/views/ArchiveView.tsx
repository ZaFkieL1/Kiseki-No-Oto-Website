import { releaseCredit } from "../../lib/catalogue";
import { useCatalogue } from "../../lib/hooks";

/**
 * The archive is the catalogue as a log — everything the label has pressed,
 * oldest last, in the order the system would have written it down.
 */
export default function ArchiveView(): React.ReactElement {
  const { releases } = useCatalogue();
  const years = [...new Set(releases.map((r) => r.date.slice(0, 4)))];
  const formats = releases.reduce<Record<string, number>>((acc, release) => {
    acc[release.type] = (acc[release.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div className="pane__head">
        <span className="pane__title">Archive</span>
        <span className="jp">アーカイブ</span>
        <span className="hud pane__count">
          {years.at(-1)}–{years[0]}
        </span>
      </div>

      <div className="log">
        <div className="log__line">
          <span className="log__year">TOTAL</span>
          <span>{releases.length}</span>
          <span className="log__hide">
            {Object.entries(formats)
              .map(([type, count]) => `${type} ${count}`)
              .join("   ")}
          </span>
        </div>

        {releases.map((release) => (
          <div className="log__line" key={release.cat}>
            <span>
              <span className="log__year">{release.date.slice(0, 4)}</span>
              {release.date.slice(4)}
            </span>
            <span>{release.cat}</span>
            <span className="log__hide">
              {release.title} — {releaseCredit(release)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
