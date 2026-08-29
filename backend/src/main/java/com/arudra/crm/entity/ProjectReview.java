package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/**
 * A star rating + comment left by a customer from the public, no-login project tracking page
 * ({@code /track/{token}}). Moderated in the CRM (APPROVED / HIDDEN) like service reviews.
 */
@Entity
@Table(name = "project_reviews", indexes = {
    @Index(name = "idx_project_review_project", columnList = "project_id")
})
@Getter
@Setter
public class ProjectReview extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id")
    private Project project;

    @Column(name = "reviewer_name", length = 150)
    private String reviewerName;

    @Column(nullable = false)
    private Integer rating;

    @Column(columnDefinition = "TEXT")
    private String comment;

    /** APPROVED (visible) | HIDDEN (moderated out). */
    @Column(nullable = false, length = 20)
    private String status = "APPROVED";
}
