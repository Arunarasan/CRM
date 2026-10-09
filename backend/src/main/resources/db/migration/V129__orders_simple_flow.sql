-- Bundles are now called "Orders" on screen, with a simpler four-step flow:
--   ORDER -> PROCESS -> COMPLETED -> DELIVERED   (CANCELLED only when the bill is cancelled)
-- On Hold is gone. Tables, URLs (/bundles) and sticker codes (JB-0042) stay as they are so
-- printed QR stickers keep working. Event history keeps its original status words.
--
-- Orders whose bill included installation leave by INSTALL: they are linked to the bill's
-- installation task (install_task_id), and the installer marks them installed on site.

-- A held order resumes where it was.
UPDATE bundles SET status = held_from_status
 WHERE status = 'ON_HOLD' AND held_from_status IS NOT NULL;
UPDATE bundles SET status = 'RECEIVED' WHERE status = 'ON_HOLD';
UPDATE bundles SET held_from_status = NULL, hold_reason = NULL;

UPDATE bundles SET status = 'ORDER'     WHERE status = 'RECEIVED';
UPDATE bundles SET status = 'PROCESS'   WHERE status IN ('CUTTING', 'STITCHING', 'QC_CHECK');
UPDATE bundles SET status = 'COMPLETED' WHERE status IN ('PACKED', 'READY');

ALTER TABLE bundles ALTER COLUMN status SET DEFAULT 'ORDER';

-- The bill's installation task, when the order is installed at the customer's place.
ALTER TABLE bundles ADD COLUMN install_task_id BIGINT NULL;
CREATE INDEX idx_bundle_install_task ON bundles (install_task_id);

-- A paused bundle task (it was on hold) goes back to following its order.
UPDATE tasks t JOIN bundles b ON b.task_id = t.id
   SET t.status = CASE b.status
                    WHEN 'ORDER' THEN 'PENDING'
                    WHEN 'PROCESS' THEN 'IN_PROGRESS'
                    ELSE t.status END
 WHERE t.status = 'PAUSED';
