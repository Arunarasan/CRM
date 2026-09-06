import { Fragment, type ReactNode } from "react";
import { TASK_LANES, LANE_STYLES, type TaskLane } from "./taskShared";

interface TaskLanesProps<T> {
  items: T[];
  /** Which lane each item belongs to. */
  laneOf: (item: T) => TaskLane;
  /** Stable key for each item. */
  keyOf: (item: T) => string | number;
  /** Render one item's card. */
  renderCard: (item: T) => ReactNode;
  /** Class for the card container inside a lane (default: single-column stack). */
  gridClassName?: string;
}

/**
 * Groups tasks into the shared status lanes (To do / In progress / Needs approval / Done)
 * with a labelled header + count per lane. Empty lanes are hidden. Both the lead and
 * project task screens render through this so the two look identical.
 */
export default function TaskLanes<T>({ items, laneOf, keyOf, renderCard, gridClassName }: TaskLanesProps<T>) {
  const groups = TASK_LANES
    .map((lane) => ({ lane, rows: items.filter((i) => laneOf(i) === lane.id) }))
    .filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-5">
      {groups.map(({ lane, rows }) => {
        const style = LANE_STYLES[lane.id];
        return (
          <div key={lane.id}>
            <div className="mb-2 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${style.dot}`} />
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{lane.label}</h4>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{rows.length}</span>
            </div>
            <div className={gridClassName ?? "space-y-2.5"}>
              {rows.map((r) => <Fragment key={keyOf(r)}>{renderCard(r)}</Fragment>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
