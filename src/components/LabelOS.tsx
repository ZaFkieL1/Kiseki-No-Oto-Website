import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dominantHue } from "../lib/artwork";
import { label } from "../lib/data";
import { deck } from "../lib/audio";
import { language, t } from "../lib/i18n";
import {
  useCatalogue,
  useDeck,
  useLang,
  useLevelBus,
  useReducedMotion,
} from "../lib/hooks";
import Ambient from "./Ambient";
import BootSequence from "./BootSequence";
import Cursor from "./Cursor";
import Telemetry from "./Telemetry";
import TransportDock from "./TransportDock";
import AccessSequence from "./AccessSequence";
import SystemView from "./views/SystemView";
import ReleaseDatabase from "./releases/ReleaseDatabase";
import ArtistsView from "./views/ArtistsView";
import EventsView from "./views/EventsView";

/**
 * Four destinations. `archive` and `shop` were dropped from the nav — the
 * archive restated the catalogue as a table and the shop had nothing to sell.
 * `views/ArchiveView.tsx` and `views/ShopView.tsx` still exist but nothing
 * reaches them, so neither is bundled; adding either back means one entry in
 * `VIEWS` and a key here.
 */
type ViewKey = "system" | "releases" | "artists" | "events";

interface ViewDef {
  key: ViewKey;
  label: string;
  /** What the system reports while reaching for the view. */
  access: string[];
  /** Extra class on the scrolling pane, for views that need snap behaviour. */
  paneClass?: string;
  render: (go: (key: ViewKey) => void) => React.ReactElement;
}

/**
 * The numbers are the keyboard shortcuts. They are not decoration.
 *
 * Built per render rather than at module scope: the catalogue count in the
 * access log is live now, and a module constant would freeze it at whatever
 * the build shipped.
 */
function buildViews(releaseCount: number): ViewDef[] {
  return [
  {
    key: "system",
    label: t("nav.system"),
    access: [t("access.system")],
    render: (go) => <SystemView onNavigate={go} />,
  },
  {
    key: "releases",
    label: t("nav.releases"),
    // Entering the catalogue is a moment, so it gets a real sequence.
    access: [
      t("access.releases"),
      t("access.scanning"),
      `${releaseCount} ${t("access.found")}`,
      t("access.ready"),
    ],
    paneClass: "pane--scenes",
    render: () => <ReleaseDatabase />,
  },
  {
    key: "artists",
    label: t("nav.artists"),
    access: [t("access.artists")],
    render: () => <ArtistsView />,
  },
  {
    key: "events",
    label: t("nav.events"),
    access: [t("access.events")],
    render: () => <EventsView />,
  },
  ];
}

const SHORT_ACCESS = 420;
const LONG_ACCESS = 900;

export default function LabelOS(): React.ReactElement {
  const [booted, setBooted] = useState(false);
  const [view, setView] = useState<ViewKey>("system");
  const [accessing, setAccessing] = useState<ViewDef | null>(null);
  const sessionStart = useRef(Date.now());
  const reduced = useReducedMotion();
  const { release, playing } = useDeck();
  const { releases } = useCatalogue();
  // Subscribed so every label here repaints on the switch; `buildViews` reads
  // the words through `t()`, so `lang` is also what re-derives the nav.
  const lang = useLang();

  const VIEWS = useMemo(
    () => buildViews(releases.length),
    [releases.length, lang]
  );

  useLevelBus(booted && !reduced);

  // Pull metadata for the loaded record straight away, so the transport shows
  // a real duration and can be scrubbed before anything is played.
  useEffect(() => {
    deck.prime();
  }, []);

  // The chassis wears the hue of whatever record is loaded. A real sleeve
  // gets sampled, so the accent comes from the actual artwork.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--hue", String(release.hue));

    if (!release.cover) return;
    let cancelled = false;
    void dominantHue(release.cover)
      .then((hue) => {
        if (!cancelled) root.style.setProperty("--hue", String(hue));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [release.hue, release.cover]);

  const go = useCallback(
    (next: ViewKey) => {
      if (next === view) return;
      const def = VIEWS.find((v) => v.key === next)!;
      if (reduced) {
        setView(next);
        return;
      }
      const hold = def.access.length > 1 ? LONG_ACCESS : SHORT_ACCESS;
      setAccessing(def);
      window.setTimeout(() => {
        setView(next);
        setAccessing(null);
      }, hold);
    },
    [view, reduced, VIEWS]
  );

  useEffect(() => {
    if (!booted) return;

    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const digit = Number(e.key);
      if (digit >= 1 && digit <= VIEWS.length) {
        go(VIEWS[digit - 1]!.key);
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        void deck.toggle();
      }
      if (e.key === "ArrowRight") deck.seek(deck.position + 5);
      if (e.key === "ArrowLeft") deck.seek(deck.position - 5);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [booted, go, VIEWS]);

  if (!booted) {
    return (
      <>
        <BootSequence onAccess={() => setBooted(true)} />
        <div className="scan" aria-hidden="true" />
      </>
    );
  }

  const active = VIEWS.find((v) => v.key === view)!;

  return (
    <>
      <Ambient live={playing} hue={release.hue} />
      <div className="vignette" aria-hidden="true" />

      <div className="os">
        <header className="bar">
          <span className="bar__mark">
            KISEKI<em>_OS</em>
          </span>
          <span className="jp">{label.kana}</span>
          <span className="bar__spacer" />
          <span className="bar__stat hud">
            <i className={`dot${playing ? " dot--live" : ""}`} />
            {playing ? t("bar.online") : t("bar.standby")}
          </span>

          {/* Two words, both always legible, the current one lit — a switch
              rather than a menu, because there are exactly two. */}
          <button
            className="bar__lang hud"
            onClick={() => language.toggle()}
            aria-label={t("bar.lang")}
            data-cursor={lang === "es" ? "english" : "español"}
          >
            <span aria-current={lang === "es"}>ES</span>
            <i aria-hidden="true">/</i>
            <span aria-current={lang === "en"}>EN</span>
          </button>

          <span className="bar__stat hud">{release.cat}</span>
        </header>

        <div className="body">
          <div className="rail">
            <nav className="nav" aria-label="System">
              {VIEWS.map((def, index) => (
                <button
                  key={def.key}
                  className="nav__item"
                  aria-current={def.key === view}
                  onClick={() => go(def.key)}
                  data-cursor={`${t("cursor.open")} ${def.label}`}
                >
                  <span className="nav__num">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {def.label}
                </button>
              ))}
            </nav>
            <Telemetry sessionStart={sessionStart.current} mode={active.label} />
          </div>

          <main className="viewport">
            <div
              className={`pane${active.paneClass ? ` ${active.paneClass}` : ""}`}
              key={view}
            >
              {active.render(go)}
            </div>

            {accessing && (
              <AccessSequence
                lines={accessing.access}
                duration={
                  accessing.access.length > 1 ? LONG_ACCESS : SHORT_ACCESS
                }
              />
            )}
          </main>
        </div>

        <TransportDock />
      </div>

      <div className="scan" aria-hidden="true" />
      <Cursor />
    </>
  );
}
