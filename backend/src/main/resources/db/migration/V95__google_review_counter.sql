-- Count-based auto-verification of Google reviews. We poll the business's public total review count
-- (Places API user_ratings_total). When the total rises by N, the N oldest still-pending QR reviews
-- are auto-verified (FIFO) — a submission is only ever confirmed by a REAL increase in Google's count,
-- which is the anti-fraud guard. This single-row table remembers the last-seen total (and the baseline
-- established on first sync, so pre-existing Google reviews are never miscounted as rewards).

CREATE TABLE google_review_counter (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    created_at   DATETIME(6),
    updated_at   DATETIME(6),
    created_by   VARCHAR(255),
    updated_by   VARCHAR(255),
    version      BIGINT       NOT NULL DEFAULT 0,
    deleted_by   VARCHAR(255),
    deleted_at   DATETIME(6),
    is_deleted   BIT(1)       NOT NULL DEFAULT b'0',

    -- Last-seen Google total (user_ratings_total). NULL until the first successful sync (baseline).
    last_total   INT          NULL,
    -- The total captured on the very first sync — pre-existing reviews, never rewarded.
    baseline     INT          NULL,
    last_synced_at DATETIME(6) NULL,

    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- The single tracking row.
INSERT INTO google_review_counter (id, is_deleted, version) VALUES (1, b'0', 0);
