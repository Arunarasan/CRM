package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * An attendance regularization request: an employee (or admin, on their behalf) asks to correct a
 * day's clock times. On approval the target {@link AttendanceSession}'s times are rewritten (or a new
 * session is created for a fully-missed day) and the day's worked-hours/earnings recompute from them.
 * Original times are snapshotted for audit.
 */
@Getter
@Setter
@Entity
@Table(name = "attendance_correction_requests", indexes = {
    @Index(name = "idx_att_corr_employee", columnList = "employee_id"),
    @Index(name = "idx_att_corr_status", columnList = "status")
})
public class AttendanceCorrectionRequest extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    /** The session to correct; null when the request is to add a fully-missed day. */
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "attendance_session_id")
    private AttendanceSession attendanceSession;

    @Column(name = "correction_date", nullable = false)
    private LocalDate correctionDate;

    @Column(nullable = false, length = 20)
    private String type; // FIX_IN | FIX_OUT | ADD_DAY

    @Column(name = "requested_check_in")
    private LocalTime requestedCheckIn;

    @Column(name = "requested_check_out")
    private LocalTime requestedCheckOut;

    @Column(name = "original_check_in")
    private LocalTime originalCheckIn;

    @Column(name = "original_check_out")
    private LocalTime originalCheckOut;

    @Column(length = 500)
    private String reason;

    @Column(nullable = false, length = 20)
    private String status = "PENDING"; // PENDING | APPROVED | REJECTED

    @Column(name = "reviewed_by", length = 255)
    private String reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "review_remarks", length = 500)
    private String reviewRemarks;
}
