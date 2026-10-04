package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * One uploaded phone-call recording on Tasks & Workforce → Call Recordings. Carries what was read
 * from the file (number, call time, length), the follow-up task raised from it, and how it ended
 * (lead created / added to an existing lead / not a lead).
 */
@Getter
@Setter
@Entity
@Table(name = "call_recordings")
public class CallRecording extends BaseEntity {

    public static final String NEW = "NEW";
    public static final String TASK_CREATED = "TASK_CREATED";
    public static final String DONE = "DONE";
    public static final String DISCARDED = "DISCARDED";

    public static final String LEAD_CREATED = "LEAD_CREATED";
    public static final String ADDED_TO_LEAD = "ADDED_TO_LEAD";
    public static final String NOT_A_LEAD = "NOT_A_LEAD";

    @Column(name = "file_url", nullable = false, length = 500)
    private String fileUrl;

    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    @Column(name = "size_bytes")
    private Long sizeBytes;

    @Column(name = "duration_sec")
    private Integer durationSec;

    @Column(name = "phone_number", length = 30)
    private String phoneNumber;

    @Column(name = "called_at")
    private LocalDateTime calledAt;

    @Column(name = "direction", length = 10)
    private String direction;

    @Column(name = "contact_name", length = 150)
    private String contactName;

    @Column(name = "note", length = 1000)
    private String note;

    @Column(name = "status", nullable = false, length = 20)
    private String status = NEW;

    @Column(name = "task_id")
    private Long taskId;

    @Column(name = "matched_lead_id")
    private Long matchedLeadId;

    @Column(name = "outcome", length = 20)
    private String outcome;

    @Column(name = "outcome_reason", length = 500)
    private String outcomeReason;

    @Column(name = "lead_id")
    private Long leadId;

    @Column(name = "outcome_by_id")
    private Long outcomeById;

    @Column(name = "outcome_at")
    private LocalDateTime outcomeAt;

    @Column(name = "uploaded_by_id")
    private Long uploadedById;
}
