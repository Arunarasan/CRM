package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** One step in a {@link Bundle}'s history: who moved it from which status to which, and when. */
@Entity
@Table(name = "bundle_events", indexes = {
    @Index(name = "idx_bundle_event_bundle", columnList = "bundle_id")
})
@Getter
@Setter
public class BundleEvent extends BaseEntity {

    @Column(name = "bundle_id", nullable = false)
    private Long bundleId;

    @Column(name = "from_status", length = 20)
    private String fromStatus;

    @Column(name = "to_status", nullable = false, length = 20)
    private String toStatus;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "user_name", length = 150)
    private String userName;

    @Column(length = 1000)
    private String note;

    @Column(name = "photo_url", length = 1000)
    private String photoUrl;
}
