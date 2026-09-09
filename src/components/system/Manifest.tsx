import { focus, label } from "../../lib/data";
import { pick, t } from "../../lib/i18n";
import { useCatalogue } from "../../lib/hooks";

function Stat({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="stat">
      <span className="hud">{name}</span>
      <span className="stat__v">{children}</span>
    </div>
  );
}

/**
 * What the label is. Purely editorial — the catalogue and roster figures live
 * in the hero's signal column now, and are read off the arrays there, so they
 * are deliberately not repeated here.
 */
export default function Manifest(): React.ReactElement {
  const { socials } = useCatalogue();

  return (
    <section className="sys__section manifest">
      <header className="sys__head">
        <span className="pane__title">{t("sys.manifest")}</span>
        <span className="jp">理念</span>
      </header>

      <div className="manifest__body">
        <div className="manifest__statement">
          <h2 className="manifest__headline">{pick(label.manifest.headline)}</h2>
          <p className="manifest__text">{pick(label.manifest.body)}</p>
          <p className="manifest__creed">{pick(label.manifest.creed)}</p>
        </div>

        <div className="manifest__stats">
          <Stat name={t("sys.focus")}>{focus()}</Stat>
          <Stat name={t("sys.origin")}>{label.origin}</Stat>
          <Stat name={t("sys.status")}>
            <i className={label.active ? "dot dot--live" : "dot"} />
            {label.active ? t("sys.active") : t("sys.dormant")}
          </Stat>
        </div>
      </div>

      {/* Where the label can be found — the networks it is actually on, named
          the way it names them. There is no heading and no placeholder: with
          nothing on file the row is not drawn, rather than announcing a
          contact block that has nothing in it. */}
      {socials.length > 0 && (
        <footer className="contact">
          <ul className="contact__links">
            {socials.map((social) => (
              <li key={`${social.name}-${social.url}`}>
                <a
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-cursor={`${t("cursor.open")} ${social.name}`}
                >
                  {social.name} <span aria-hidden="true">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </footer>
      )}

      {/* The ask, and the line that closes the page. Both sit under the links
          and outside them: a place the label posts from and a place a reader
          puts money are not the same kind of thing, and a row in that list is
          not where you say the second one. */}
      <div className="support">
        <a
          className="support__cta"
          href={label.support}
          target="_blank"
          rel="noopener noreferrer"
          data-cursor="ko-fi"
        >
          <span aria-hidden="true">☕</span>
          <span className="support__lines">
            <span className="support__title">{t("sys.support")}</span>
            <span className="support__note hud">{t("sys.supportNote")}</span>
          </span>
        </a>

        {/* The year is read, not typed: a hardcoded one is wrong every January
            and nobody remembers to come back for it. */}
        <p className="support__legal hud">
          © {new Date().getFullYear()} Kiseki no Oto
        </p>
      </div>
    </section>
  );
}
