import { useState } from "react";
import { eventState } from "../../lib/catalogue";
import { t } from "../../lib/i18n";
import type { LabelEvent } from "../../lib/store/types";
import EventSchedule from "./EventSchedule";

/**
 * One transmission. The stream link is the primary action while the event is
 * still ahead; the flyer and the running order are the two things a reader
 * actually wants before deciding to show up.
 *
 * Anything unset shows as a visible gap rather than a dead control — the same
 * rule the Bandcamp button follows.
 */
export default function EventCard({
  event,
}: {
  event: LabelEvent;
}): React.ReactElement {
  const [showSchedule, setShowSchedule] = useState(false);
  const state = eventState(event.date);
  const hasSchedule = event.schedule.length > 0;

  return (
    <article className={`evt evt--${state.toLowerCase()}`}>
      <header className="evt__head">
        <span className="row__meta evt__date">{event.date}</span>
        <span className={`state state--${state.toLowerCase()}`}>
          {t(`evt.${state}` as const)}
        </span>
      </header>

      <h2 className="evt__name">{event.name}</h2>
      <p className="evt__sub hud">
        {event.platform ?? t("evt.platformTBA")} · {event.timezone}
      </p>

      <div className="evt__actions">
        {event.stream ? (
          <a
            className="playcta"
            href={event.stream}
            target="_blank"
            rel="noopener noreferrer"
            data-cursor="external_link"
          >
            {state === "ENDED" ? t("evt.channel") : t("evt.watch")}
            <span aria-hidden="true">↗</span>
          </a>
        ) : (
          <span className="hud evt__unset">{t("evt.streamUnset")}</span>
        )}

        {event.flyer ? (
          <a
            className="evt__link"
            href={event.flyer}
            target="_blank"
            rel="noopener noreferrer"
            data-cursor="open flyer"
          >
            {t("evt.flyer")} ↗
          </a>
        ) : (
          <span className="hud evt__unset">{t("evt.noFlyer")}</span>
        )}

        {hasSchedule && (
          <button
            className="evt__link"
            onClick={() => setShowSchedule((open) => !open)}
            aria-expanded={showSchedule}
            data-cursor={showSchedule ? "hide schedule" : "show schedule"}
          >
            {t("evt.schedule")} ({event.schedule.length}){" "}
            {showSchedule ? "↑" : "↓"}
          </button>
        )}
      </div>

      {showSchedule && (
        <EventSchedule schedule={event.schedule} timezone={event.timezone} />
      )}
    </article>
  );
}
