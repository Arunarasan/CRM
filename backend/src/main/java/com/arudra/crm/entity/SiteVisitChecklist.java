package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "site_visit_checklists")
public class SiteVisitChecklist extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "site_visit_id", nullable = false)
    private SiteVisit siteVisit;

    @Column(nullable = false, length = 255)
    private String item;

    @Column(nullable = false)
    private Boolean isCompleted = false;

    @Column(columnDefinition = "TEXT")
    private String remarks;
}
