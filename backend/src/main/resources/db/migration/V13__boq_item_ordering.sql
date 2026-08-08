-- Persist a user-defined order for BOQ floors / rooms / items (drag-and-drop reorganize).
-- Floors and rooms are plain strings on boq_items, so the ordering lives on the items: every item
-- sharing a floor/room carries the same floor_order / room_order. Existing rows default to 0 and
-- keep rendering in id order until the first reorder assigns real values.
ALTER TABLE boq_items
    ADD COLUMN floor_order INT NOT NULL DEFAULT 0,
    ADD COLUMN room_order  INT NOT NULL DEFAULT 0,
    ADD COLUMN item_order  INT NOT NULL DEFAULT 0;
