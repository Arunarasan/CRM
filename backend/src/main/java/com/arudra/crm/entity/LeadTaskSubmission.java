package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * The structured data an employee captures when completing a lead-workflow task — the record behind
 * the lead's "Task Data" log. One row per task submission. Common fields (outcome/notes/next
 * follow-up/media) are typed columns; the task-specific fields (which vary per {@code formType}) are
 * kept as a JSON blob in {@code dataJson}. The submission is also applied to the native lead records
 * (LeadFollowup, requirement fields, status…) at submit time — see LeadTaskFormService.
 */
@Entity
@Table(name = "lead_task_submissions", indexes = {
        @Index(name = "idx_lts_lead", columnList = "lead_id"),
        @Index(name = "idx_lts_task", columnList = "task_id")
})
@Getter
@Setter
public class LeadTaskSubmission extends BaseEntity {

    @Column(name = "task_id", nullable = false)
    private Long taskId;

    @Column(name = "lead_id", nullable = false)
    private Long leadId;

    /** FOLLOW_UP | REQUIREMENT | QUALIFY | SCHEDULE_VISIT | SITE_VISIT | REVIEW */
    @Column(name = "form_type", nullable = false, length = 40)
    private String formType;

    @Column(name = "task_name", length = 200)
    private String taskName;

    /** Short per-task outcome (e.g. Connected / Callback / Not reachable). Common field. */
    @Column(length = 120)
    private String outcome;

    /** Free-text notes on what was done. Common field. */
    @Column(columnDefinition = "TEXT")
    private String notes;

    /** When to next contact the lead. Common field; also pushed onto Lead.nextFollowUpDate. */
    @Column(name = "next_follow_up_date")
    private LocalDate nextFollowUpDate;

    /** JSON array of {url,type,caption} for captured photos/attachments. Common field. */
    @Column(name = "media_json", columnDefinition = "TEXT")
    private String mediaJson;

    /** JSON object of the task-specific fields for this formType. */
    @Column(name = "data_json", columnDefinition = "TEXT")
    private String dataJson;

    @Column(name = "submitted_by_id")
    private Long submittedById;

    @Column(name = "submitted_by_name", length = 150)
    private String submittedByName;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;
}
