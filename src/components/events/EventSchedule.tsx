import { artistByKey } from "../../lib/catalogue";
import { t } from "../../lib/i18n";
import type { Slot } from "../../lib/store/types";

/**
 * The running order, in the event's own timezone.
 *
 * Times are shown exactly as they were captured — the flyer is the source, and
 * converting them would put the site and the flyer at odds. The timezone label
 * travels with them so the reader can do the arithmetic themselves.
 */
export default function EventSchedule({
  schedule,
  timezone,
}: {
  schedule: Slot[];
  timezone: string;
}): React.ReactElement {
  return (
    <div className="sched">
      <p className="hud sched__tz">
        {t("evt.times")} {timezone}
      </p>
      <ol className="sched__list">
        {schedule.map((slot) => {
          const linked = slot.artistKey ? artistByKey(slot.artistKey) : null;
          return (
            <li className="sched__slot" key={slot.start + slot.artist}>
              <span className="mono sched__time">
                {slot.start}
                {slot.end ? `–${slot.end}` : ""}
              </span>
              <span className="sched__artist">{slot.artist}</span>
              {linked && linked.kana && (
                <span className="jp sched__kana">{linked.kana}</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
