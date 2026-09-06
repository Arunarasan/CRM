package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/**
 * An inbound enquiry submitted from the public marketing site (contact form, consultation request,
 * or a product "get a quote"). It is a first-class inbox record — the admin triages it in
 * Website → Enquiries and, once qualified, converts it into a CRM {@link Lead} ({@code leadId} links
 * back). Every new enquiry also spawns an ENQUIRY {@link Task} so it surfaces on the task board.
 */
@Entity
@Table(name = "website_enquiries", indexes = {
    @Index(name = "idx_enquiry_status", columnList = "status"),
    @Index(name = "idx_enquiry_created", columnList = "created_at")
})
@Getter
@Setter
public class WebsiteEnquiry extends BaseEntity {

    /** CONTACT | CONSULTATION | PRODUCT_QUOTE — where on the site it came from. */
    @Column(nullable = false, length = 30)
    private String channel = "CONTACT";

    /** Human label kept for display, e.g. "Website Contact" / "Website Consultation". */
    @Column(name = "source_label", length = 120)
    private String sourceLabel;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(length = 30)
    private String phone;

    @Column(length = 150)
    private String email;

    @Column(length = 120)
    private String city;

    /** What they're interested in — project type, service, or product name. */
    @Column(length = 200)
    private String interest;

    /** Slug of the product they enquired about, when the enquiry came from a product page. */
    @Column(name = "product_slug", length = 200)
    private String productSlug;

    @Column(name = "property_type", length = 80)
    private String propertyType;

    @Column(length = 60)
    private String area;

    @Column(length = 60)
    private String budget;

    /** Free-form date preference from the form (kept loose as text). */
    @Column(name = "preferred_date", length = 60)
    private String preferredDate;

    @Column(columnDefinition = "TEXT")
    private String message;

    /** NEW | IN_PROGRESS | CONVERTED | CLOSED */
    @Column(nullable = false, length = 30)
    private String status = "NEW";

    /** Set once converted — the CRM lead this enquiry became (plain id, no FK). */
    @Column(name = "lead_id")
    private Long leadId;

    /** The ENQUIRY task raised for this enquiry (plain id, no FK). */
    @Column(name = "task_id")
    private Long taskId;
}
