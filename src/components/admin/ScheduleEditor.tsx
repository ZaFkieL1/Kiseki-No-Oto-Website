import type { Artist, Slot } from "../../lib/data";
import type { Errors } from "../../lib/store/validate";

/**
 * The running order.
 *
 * The artist is free text because most guests are not on the label, with an
 * optional link to a roster entry for the ones that are — signing a guest up
 * just to schedule them would inflate the count the hero reads.
 *
 * Rows are not sorted while you type. The store sorts by start time on save,
 * so a half-typed "2" never jumps the row out from under the cursor.
 */
export default function ScheduleEditor({
  schedule,
  artists,
  errors,
  onChange,
}: {
  schedule: Slot[];
  artists: Artist[];
  errors: Errors;
  onChange: (next: Slot[]) => void;
}): React.ReactElement {
  const patch = (index: number, changes: Partial<Slot>): void => {
    onChange(
      schedule.map((slot, i) => (i === index ? { ...slot, ...changes } : slot))
    );
  };

  return (
    <div className="sched-edit">
      <div className="kern__listhead kern__listhead--flush">
        <span className="pane__title">Schedule</span>
        <button
          className="kern__new"
          onClick={() => onChange([...schedule, { start: "", artist: "" }])}
        >
          + Slot
        </button>
      </div>

      {schedule.length === 0 ? (
        <p className="fld__hint">
          No slots yet. The public card hides the schedule toggle until there is
          at least one.
        </p>
      ) : (
        schedule.map((slot, index) => (
          <div className="sched-edit__row" key={index}>
            <input
              className="fld__input sched-edit__time"
              value={slot.start}
              placeholder="20:00"
              aria-label={`Slot ${index + 1} start`}
              onChange={(e) => patch(index, { start: e.target.value })}
            />
            <input
              className="fld__input sched-edit__time"
              value={slot.end ?? ""}
              placeholder="20:45"
              aria-label={`Slot ${index + 1} end`}
              onChange={(e) => patch(index, { end: e.target.value || undefined })}
            />
            <input
              className="fld__input"
              value={slot.artist}
              placeholder="As it reads on the flyer"
              aria-label={`Slot ${index + 1} artist`}
              onChange={(e) => patch(index, { artist: e.target.value })}
            />
            <select
              className="fld__input sched-edit__link"
              value={slot.artistKey ?? ""}
              aria-label={`Slot ${index + 1} roster link`}
              onChange={(e) =>
                patch(index, { artistKey: e.target.value || undefined })
              }
            >
              <option value="">Guest</option>
              {artists.map((artist) => (
                <option value={artist.key} key={artist.key}>
                  {artist.name}
                </option>
              ))}
            </select>
            <button
              className="sched-edit__drop"
              aria-label={`Remove slot ${index + 1}`}
              onClick={() => onChange(schedule.filter((_, i) => i !== index))}
            >
              ✕
            </button>

            {(errors[`schedule.${index}.start`] ??
              errors[`schedule.${index}.end`] ??
              errors[`schedule.${index}.artist`]) && (
              <p className="fld__error sched-edit__err">
                {errors[`schedule.${index}.start`] ??
                  errors[`schedule.${index}.end`] ??
                  errors[`schedule.${index}.artist`]}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
}
