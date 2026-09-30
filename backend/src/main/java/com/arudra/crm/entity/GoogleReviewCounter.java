package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Single-row tracker for count-based Google-review verification. Remembers the last-seen public total
 * review count (Places API {@code user_ratings_total}) so a rise in the count can be attributed to
 * pending QR reviews, and the baseline captured on first sync so pre-existing reviews aren't rewarded.
 */
@Entity
@Table(name = "google_review_counter")
@Getter
@Setter
public class GoogleReviewCounter extends BaseEntity {

    /** Last-seen Google total. NULL until the first successful sync. */
    @Column(name = "last_total")
    private Integer lastTotal;

    /** Total captured on the very first sync — pre-existing reviews, never rewarded. */
    @Column(name = "baseline")
    private Integer baseline;

    @Column(name = "last_synced_at")
    private LocalDateTime lastSyncedAt;
}
