package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "site_visit_history")
public class SiteVisitHistory extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "site_visit_id", nullable = false)
    private SiteVisit siteVisit;

    @Column(nullable = false, length = 100)
    private String action; // Scheduled, Engineer Assigned, Visit Started, Measurements Completed, Photos Uploaded, Customer Signed, Visit Completed

    @Column(nullable = false)
    private LocalDateTime actionTimestamp;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "performed_by_user_id")
    private User performedBy;

    @Column(columnDefinition = "TEXT")
    private String remarks;
}
