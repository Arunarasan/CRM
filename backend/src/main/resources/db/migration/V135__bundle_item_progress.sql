-- Orders task: per-item progress (0-100). An item is "done" at 100; existing done items backfill to 100.
ALTER TABLE bundle_items ADD COLUMN progress INT NOT NULL DEFAULT 0;
UPDATE bundle_items SET progress = 100 WHERE is_done = 1;
