package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/**
 * One enrolled face sample for an employee: a 128-number descriptor (JSON array text) computed in the
 * browser. Several samples per employee make matching tolerant to angle and lighting. Biometric
 * data: never serialised to clients except through the kiosk matching endpoint, and hard-deleted
 * (not soft-deleted) when an employee is re-enrolled or removed.
 */
@Getter
@Setter
@Entity
@Table(name = "employee_face_templates")
public class EmployeeFaceTemplate extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    @Column(name = "sample_no", nullable = false)
    private Integer sampleNo;

    /** JSON array of 128 floats. */
    @JsonIgnore
    @Column(nullable = false, columnDefinition = "TEXT")
    private String descriptor;

    /** Detector confidence (0..1) of the frame this sample came from. */
    private Double quality;

    /** Reference photo taken at enrollment; set on the first sample only. */
    @Column(name = "photo_url", length = 500)
    private String photoUrl;

    @Column(name = "enrolled_by", length = 255)
    private String enrolledBy;
}
