package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "leave_requests")
public class LeaveRequest extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(nullable = false, length = 50)
    private String type; // SICK, CASUAL, EARNED, MATERNITY

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(nullable = false, length = 20)
    private String status = "PENDING"; // PENDING, APPROVED, REJECTED
    
    @Column(name = "approved_by")
    private String approvedBy;
}
