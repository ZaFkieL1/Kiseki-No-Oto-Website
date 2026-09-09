import { focus, label } from "../../lib/data";
import { pick, t } from "../../lib/i18n";
import SignalPanel from "./SignalPanel";

/**
 * What the interface opens with.
 *
 * Two columns off one rule: the lockup and the statement on the left, the
 * record the label is putting out on the right. The lockup is the artwork of
 * this screen, not a header — everything under it is set small so the brush
 * keeps the weight, and the statement is the only other thing allowed to be
 * loud.
 *
 * Everything arrives on a stagger, so the identity assembles itself the way
 * the boot log did. The signal column lands last.
 */
export default function IdentityHero({
  onExplore,
}: {
  onExplore: () => void;
}): React.ReactElement {
  return (
    <section className="identity">
      <div className="identity__eyebrow reveal" style={{ animationDelay: "60ms" }}>
        <span className="hud">{t("sys.eyebrow")}</span>
        <span className="hud identity__focus">{focus()}</span>
      </div>

      <div className="identity__lede">
        {/* The lockup is the wordmark — setting the latin name in type as well
            would say it twice. The kana under it is the other half of the
            name, not a repeat. */}
        <h1 className="identity__logo reveal" style={{ animationDelay: "140ms" }}>
          <img
            src={label.logo.src}
            alt={label.logo.alt}
            width={900}
            height={900}
            fetchPriority="high"
          />
        </h1>

        <p className="identity__kana reveal" style={{ animationDelay: "240ms" }}>
          {label.kana}
        </p>

        <p className="hud reveal" style={{ animationDelay: "300ms" }}>
          {pick(label.descriptor)}
        </p>

        {/* One row, not a stack: the label's range reads as a band it is tuned
            across, and it holds the width under the lockup. */}
        <ul className="identity__genres">
          {label.genres.map((genre, i) => (
            <li
              className="reveal"
              key={genre}
              style={{ animationDelay: `${360 + i * 60}ms` }}
            >
              {genre}
            </li>
          ))}
        </ul>

        <hr
          className="identity__rule reveal"
          style={{ animationDelay: "640ms" }}
        />

        <p className="identity__tagline reveal" style={{ animationDelay: "720ms" }}>
          {pick(label.tagline)}
        </p>

        <button
          className="playcta reveal"
          onClick={onExplore}
          data-cursor="open releases"
          style={{ animationDelay: "820ms" }}
        >
          {t("sys.explore")}
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <div className="identity__signal reveal" style={{ animationDelay: "900ms" }}>
        <SignalPanel />
      </div>

      <span className="identity__cue hud" aria-hidden="true">
        {t("sys.scroll")}
      </span>
    </section>
  );
}
