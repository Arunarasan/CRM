package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/**
 * A rating + message a customer leaves for a specific employee by scanning that employee's personal
 * review QR code ({@code /r/{token}} on the public site). Captured against the employee, moderated in
 * the CRM (APPROVED / HIDDEN) like {@link ProjectReview} and {@link ServiceReview}. After submitting,
 * the customer is redirected to the company's Google review page.
 */
@Entity
@Table(name = "employee_reviews", indexes = {
    @Index(name = "idx_employee_review_employee", columnList = "employee_id")
})
@Getter
@Setter
public class EmployeeReview extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "employee_id")
    private Employee employee;

    @Column(name = "reviewer_name", length = 150)
    private String reviewerName;

    @Column(name = "reviewer_phone", length = 30)
    private String reviewerPhone;

    @Column(nullable = false)
    private Integer rating = 5;

    @Column(columnDefinition = "TEXT")
    private String comment;

    /** Whether the customer went on to the Google review page after submitting. */
    @Column(name = "redirected_to_google", nullable = false)
    private Boolean redirectedToGoogle = false;

    /** APPROVED (visible) | HIDDEN (moderated out). */
    @Column(nullable = false, length = 20)
    private String status = "APPROVED";

    // --- Google-review reward tracking (V94) ---------------------------------
    /** Confirmed (manually or via the Business Profile API) that this became a real Google review. */
    @Column(name = "google_verified", nullable = false)
    private Boolean googleVerified = false;

    @Column(name = "google_verified_at")
    private java.time.LocalDateTime googleVerifiedAt;

    /** The matched Google review id, when reconciled against the Business Profile API (else null). */
    @Column(name = "google_review_id", length = 255)
    private String googleReviewId;

    /** Reward paid for this verified review. */
    @Column(name = "reward_amount", precision = 15, scale = 2)
    private java.math.BigDecimal rewardAmount;

    /** The employee_bonuses row raised for this reward (null until paid) — guards against double pay. */
    @Column(name = "reward_bonus_id")
    private Long rewardBonusId;
}
