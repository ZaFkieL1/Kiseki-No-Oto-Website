import { hash, type LabelEvent } from "../../lib/data";
import { eventState } from "../../lib/catalogue";
import { store } from "../../lib/store";
import { validateEvent } from "../../lib/store/validate";
import { useCatalogue } from "../../lib/hooks";
import { SaveBar, TextField } from "./Fields";
import ScheduleEditor from "./ScheduleEditor";
import { useEditor } from "./useEditor";

function blankEvent(): LabelEvent {
  return {
    id: "",
    date: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
    name: "",
    platform: "",
    stream: undefined,
    flyer: undefined,
    timezone: "JST",
    schedule: [],
  };
}

/**
 * The transmissions.
 *
 * There is no status field: it is derived from the date. The id is minted once
 * on first save from the date and the name, and then never moves — the
 * schedule hangs off it, and both of those fields stay editable.
 */
export default function EventsPanel(): React.ReactElement {
  const { events, artists } = useCatalogue();
  const editor = useEditor<LabelEvent>();
  const { draft, errors, update } = editor;

  const saved = draft !== null && events.some((e) => e.id === draft.id);

  const onSave = (): void =>
    void editor.save(validateEvent, (value) =>
      store.saveEvent({
        ...value,
        id: value.id || `evt-${hash(value.date + value.name)}`,
      })
    );

  const onDelete = (): void => {
    if (!draft) return;
    if (!window.confirm(`Delete ${draft.name}? This cannot be undone.`)) return;
    void store.removeEvent(draft.id).then(editor.reset);
  };

  return (
    <>
      <div className="kern__list">
        <div className="kern__listhead">
          <span className="pane__title">Events</span>
          <button className="kern__new" onClick={() => editor.select(blankEvent())}>
            + New
          </button>
        </div>

        {events.map((event) => (
          <button
            className="kern__row"
            key={event.id}
            aria-current={event.id === draft?.id}
            onClick={() =>
              editor.select({
                ...event,
                schedule: event.schedule.map((slot) => ({ ...slot })),
              })
            }
          >
            <span className="mono">{event.date}</span>
            <span className="kern__rowname">{event.name}</span>
            <span className="mono kern__rowstate">{eventState(event.date)}</span>
          </button>
        ))}
      </div>

      {draft === null ? (
        <div className="kern__blank">
          <p className="hud">No event selected.</p>
          <button className="playcta" onClick={() => editor.select(blankEvent())}>
            Add the first one
          </button>
        </div>
      ) : (
        <div className="kern__form">
          <TextField
            name="Name"
            value={draft.name}
            error={errors.name}
            onChange={(name) => update({ name })}
          />

          <div className="kern__grid">
            <TextField
              name="Date"
              value={draft.date}
              error={errors.date}
              hint="YYYY.MM.DD · the status is read off this"
              onChange={(date) => update({ date })}
            />
            <TextField
              name="Timezone"
              value={draft.timezone}
              error={errors.timezone}
              hint="JST · GMT-6 — shown, never converted"
              onChange={(timezone) => update({ timezone })}
            />
            <TextField
              name="Platform"
              value={draft.platform ?? ""}
              hint="TWITCH · YOUTUBE"
              onChange={(platform) => update({ platform: platform || undefined })}
            />
          </div>

          <div className="kern__grid">
            <TextField
              name="Stream"
              value={draft.stream ?? ""}
              error={errors.stream}
              hint="Unset shows a gap, not a dead link"
              onChange={(stream) => update({ stream: stream || undefined })}
            />
            <TextField
              name="Flyer"
              value={draft.flyer ?? ""}
              error={errors.flyer}
              hint="Path under public/ or a URL"
              onChange={(flyer) => update({ flyer: flyer || undefined })}
            />
          </div>

          {draft.flyer && !errors.flyer && (
            <div className="kern__section">
              <span className="hud">Flyer</span>
              <img className="kern__flyer" src={draft.flyer} alt="" />
            </div>
          )}

          <div className="kern__section">
            <ScheduleEditor
              schedule={draft.schedule}
              artists={artists}
              errors={errors}
              onChange={(schedule) => update({ schedule })}
            />
          </div>

          <SaveBar
            status={editor.status}
            message={editor.message}
            dirty={editor.dirty}
            onSave={onSave}
            onDelete={saved ? onDelete : undefined}
            deleteLabel="Delete event"
          />
        </div>
      )}
    </>
  );
}
