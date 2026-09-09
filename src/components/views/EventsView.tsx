import { eventState } from "../../lib/catalogue";
import { t } from "../../lib/i18n";
import { useCatalogue } from "../../lib/hooks";
import EventCard from "../events/EventCard";

export default function EventsView(): React.ReactElement {
  const { events } = useCatalogue();
  const upcoming = events.filter((e) => eventState(e.date) === "SCHEDULED");

  return (
    <div>
      <div className="pane__head">
        <span className="pane__title">{t("evt.title")}</span>
        <span className="jp">イベント</span>
        <span className="hud pane__count">{upcoming.length} {t("evt.upcoming")}</span>
      </div>

      {events.length === 0 ? (
        <p className="hud empty">{t("evt.empty")}</p>
      ) : (
        <div className="stack">
          {events.map((event) => (
            <EventCard event={event} key={event.id} />
          ))}
        </div>
      )}
    </div>
  );
}
