import { label } from "../../lib/data";
import { pick, t } from "../../lib/i18n";

/** The name, taken apart. Two words, and what the label is called. */
export default function NameMeaning(): React.ReactElement {
  return (
    <section className="sys__section name">
      <header className="sys__head">
        <span className="pane__title">{t("sys.name")}</span>
        <span className="jp">名前</span>
      </header>

      <dl className="name__grid">
        {label.etymology.map((part) => (
          <div className="name__row" key={part.romaji}>
            <dt className="name__romaji hud">{part.romaji}</dt>
            <dd className="name__glyph">{part.glyph}</dd>
            <dd className="name__meaning">{pick(part.meaning)}</dd>
          </div>
        ))}
      </dl>

      <p className="name__translation">“{pick(label.translation)}”</p>
    </section>
  );
}
