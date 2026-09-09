import { TYPE_LABEL, formatTime, trackSource } from "../../lib/data";
import { artistByKey, roster } from "../../lib/catalogue";
import { deck, type Phase } from "../../lib/audio";
import { t } from "../../lib/i18n";
import { useCatalogue, useDeck, usePosition } from "../../lib/hooks";
import { DiscBay } from "../Artwork";
import Waveform from "../Waveform";
import ReleaseLink from "../releases/ReleaseLink";
import { Pause, Play } from "../icons";

/**
 * The machine's words, in the reader's. The keys are the deck's phases; the
 * values are what an operating system would put on a status line.
 */
const phaseLabel = (phase: Phase): string =>
  t(`phase.${phase}` as const);

function Elapsed({ duration }: { duration: number }): React.ReactElement {
  const position = usePosition();
  return (
    <div className="scrub__times">
      <span>{formatTime(position)}</span>
      <span>{duration > 0 ? formatTime(duration) : "--:--"}</span>
    </div>
  );
}

function IndexRow({
  name,
  value,
}: {
  name: string;
  value: string;
}): React.ReactElement {
  return (
    <div className="signal__row">
      <dt className="hud">{name}</dt>
      <dd className="mono">{value}</dd>
    </div>
  );
}

/**
 * The right half of the hero, hung off a full-height rule.
 *
 * It answers what the label is currently putting out while the lockup answers
 * who it is — the two read at once instead of one scroll apart.
 *
 * The heading is "Latest release" rather than "now playing" because the record
 * sits here loaded whether or not anyone has pressed anything. The class names
 * still say `signal`, which is what the panel was called first; what it shows
 * is the record on air, and that is the mark KERNEL sets.
 *
 * The index at the foot is read off the catalogue, so it cannot drift.
 */
export default function SignalPanel(): React.ReactElement {
  const { release, track, playing, duration, phase, problem } = useDeck();
  const { releases } = useCatalogue();
  // The label's own acts, not every credited name — the same list 03 ARTISTS
  // prints, so the figure here cannot claim more than the page shows.
  const acts = roster();
  const song = release.tracks[track];
  const artist = artistByKey(song?.artist ?? "");
  const position = releases.findIndex((r) => r.cat === release.cat) + 1;
  const pad = (n: number): string => String(n).padStart(3, "0");

  return (
    <aside className="signal">
      <header className="signal__head">
        <span className="pane__title">{t("signal.title")}</span>
        <span className="jp">最新リリース</span>
      </header>

      <div className="signal__bay">
        <DiscBay
          seed={release.seed}
          hue={release.hue}
          cover={release.cover}
          size={420}
        />
        <div className="bay__frame" />
      </div>

      {/* The machine says what it is doing, including while it is only
          fetching — and including when it has failed, which it used to do in
          silence. `problem` carries the reason to the tooltip. */}
      <p className="signal__state hud" title={problem ?? undefined}>
        <i className={`dot dot--${phase.toLowerCase().replace(" ", "-")}`} />
        {phaseLabel(phase)}
        <span className="signal__cat">{release.cat}</span>
      </p>

      <h2 className="signal__artist">{artist.name}</h2>
      {/* The song leads. On a single that is the record's name too; on an
          album it is not, so the record is named underneath. */}
      <p className="signal__title">{song?.title ?? release.title}</p>
      <p className="signal__meta mono">
        {release.tracks.length > 1 && `${release.title} · `}
        {TYPE_LABEL[release.type]} · {release.date}
      </p>

      <div className="scrub">
        <Waveform
          seed={release.seed}
          hue={release.hue}
          duration={duration}
          audio={trackSource(song)}
          variant="hero"
        />
        <Elapsed duration={duration} />
      </div>

      <div className="signal__actions">
        <button
          className="playcta"
          onClick={() => void deck.toggle()}
          data-cursor="audio_module"
        >
          {playing ? <Pause /> : <Play />}
          {playing ? t("deck.pause") : t("deck.play")}
        </button>
        <ReleaseLink release={release} />
      </div>

      <dl className="signal__index">
        <IndexRow name={t("signal.catalogue")} value={pad(releases.length)} />
        <IndexRow name={t("signal.roster")} value={pad(acts.length)} />
        <IndexRow
          name={t("signal.loaded")}
          value={`${pad(position)} / ${pad(releases.length)}`}
        />
      </dl>
    </aside>
  );
}
