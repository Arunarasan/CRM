-- Project cancellation: a project can be cancelled at any stage before completion. The customer's
-- advance may be returned in part (or full) through the normal Refund flow (refunds.project_id),
-- and the cancellation itself is recorded on the project.
ALTER TABLE projects
    ADD COLUMN cancelled_at        DATETIME     NULL,
    ADD COLUMN cancelled_by_id     BIGINT       NULL,
    ADD COLUMN cancellation_reason TEXT         NULL;
