package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * A standing definition of a repeating company overhead (rent, electricity, internet…). It is a
 * template only — there is no auto-scheduling. Each period the user records the actual payment as a
 * {@link CompanyTransaction} EXPENSE linked back to this head, with the bill attached, which then
 * flows into the Cash Book and reports like any other expense.
 */
@Getter
@Setter
@Entity
@Table(name = "recurring_expenses", indexes = {
    @Index(name = "idx_recexp_active", columnList = "active"),
    @Index(name = "idx_recexp_category", columnList = "category")
})
public class RecurringExpense extends BaseEntity {

    @Column(nullable = false, length = 150)
    private String name;

    /** RENT, ELECTRICITY, INTERNET, UTILITIES… (shares the company-expense category vocabulary). */
    @Column(nullable = false, length = 40)
    private String category;

    /** Usual amount; null for variable bills (e.g. electricity). */
    @Column(name = "default_amount", precision = 15, scale = 2)
    private BigDecimal defaultAmount;

    @Column(name = "party_name", length = 200)
    private String partyName;

    @Column(name = "payment_method", length = 50)
    private String paymentMethod;

    @Column(nullable = false, length = 20)
    private String frequency = "MONTHLY"; // MONTHLY, QUARTERLY, YEARLY

    /** Informational "usually due on" day of the month (1–31). */
    @Column(name = "day_of_month")
    private Integer dayOfMonth;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recorded_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "refreshTokens", "password"})
    private User recordedBy;
}
