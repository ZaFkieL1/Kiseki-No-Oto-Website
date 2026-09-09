import { artistByKey } from "../lib/catalogue";
import { formatTime, trackSource } from "../lib/data";
import { deck } from "../lib/audio";
import { t } from "../lib/i18n";
import { useDeck, usePosition } from "../lib/hooks";
import { Cover } from "./Artwork";
import Waveform from "./Waveform";
import { Next, Pause, Play, Prev, Speaker } from "./icons";

/** Isolated so the 10Hz clock does not re-render the rest of the dock. */
function Clock({ duration }: { duration: number }): React.ReactElement {
  const position = usePosition();
  return (
    <span className="dock__clock">
      <b>{formatTime(position)}</b> / {duration > 0 ? formatTime(duration) : "--:--"}
    </span>
  );
}

/**
 * The transport outlives the view. Browsing the catalogue never interrupts
 * playback, which is the one behaviour every music interface has to get right.
 */
export default function TransportDock(): React.ReactElement {
  const { release, track, playing, muted, volume, duration, preview } =
    useDeck();
  const song = release.tracks[track];
  // The credit belongs to the song now, so the dock names who made *this* one,
  // not who the whole record is filed under.
  const artist = artistByKey(song?.artist ?? "");

  return (
    <div className="dock">
      <div className="transport">
        <button
          className="tbtn"
          onClick={() => void deck.prev()}
          data-cursor={t("deck.prev").toLowerCase()}
          aria-label={t("deck.prev")}
        >
          <Prev />
        </button>
        <button
          className="tbtn tbtn--play"
          onClick={() => void deck.toggle()}
          data-cursor={(playing ? t("deck.pause") : t("deck.play")).toLowerCase()}
          aria-label={playing ? t("deck.pause") : t("deck.play")}
        >
          {playing ? <Pause /> : <Play />}
        </button>
        <button
          className="tbtn"
          onClick={() => void deck.next()}
          data-cursor={t("deck.next").toLowerCase()}
          aria-label={t("deck.next")}
        >
          <Next />
        </button>
      </div>

      <div className="dock__now">
        <Cover
          seed={release.seed}
          hue={release.hue}
          cover={release.cover}
          size={38}
        />
        {/* The song, then where it comes from — on a single those are the
            same words, on an album they are not. A preview is neither: it is
            the record, so it says so rather than naming a track it is not. */}
        <div className="dock__title">
          <span className="dock__t">
            {preview ? release.title : song?.title ?? release.title}
          </span>
          <span className="hud">
            {preview ? t("deck.preview") : artist.name} · {release.cat}
          </span>
        </div>
      </div>

      <Waveform
        seed={release.seed}
        hue={release.hue}
        duration={duration}
        audio={trackSource(song)}
      />

      <div className="dock__tail">
        <div className="vol">
          <button
            className="tbtn"
            onClick={() => deck.toggleMute()}
            data-cursor={(muted ? t("deck.unmute") : t("deck.mute")).toLowerCase()}
            aria-label={muted ? t("deck.unmute") : t("deck.mute")}
          >
            <Speaker muted={muted} />
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(e) => deck.setVolume(Number(e.target.value))}
            aria-label={t("deck.volume")}
          />
        </div>
        <Clock duration={duration} />
      </div>
    </div>
  );
}
