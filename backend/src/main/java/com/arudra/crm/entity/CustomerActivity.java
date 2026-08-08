package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "customer_activities")
public class CustomerActivity extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Column(nullable = false, length = 100)
    private String action; // e.g. "CREATED", "UPDATED", "NOTE_ADDED", "DOCUMENT_UPLOADED"

    @Column(columnDefinition = "TEXT")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "performed_by_id", nullable = false)
    private User performedBy;

    // --- Communication Timeline fields (Customer 360, Tab 3) ---
    // All nullable/optional so existing callers sending only action+description are unaffected.

    @Column(length = 50)
    private String channel; // CALL, WHATSAPP, EMAIL, MEETING, OFFICE_VISIT, SITE_VISIT, VIDEO_CALL, NOTE

    @Column(name = "customer_mood", length = 20)
    private String customerMood; // POSITIVE, NEUTRAL, NEGATIVE

    @Column(length = 200)
    private String outcome;

    @Column(name = "customer_response", columnDefinition = "TEXT")
    private String customerResponse;

    @Column(name = "attachment_url", length = 500)
    private String attachmentUrl;

    @Column(name = "attachment_file_name", length = 200)
    private String attachmentFileName;
}
