package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "measurement_activity_logs")
public class MeasurementActivityLog extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "measurement_id", nullable = false)
    private Measurement measurement;

    @Column(name = "action_type", length = 100)
    private String actionType; // Created, Room Added, Updated, Photo Uploaded, Estimate Generated, Approved, Revision Requested

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "performed_by", length = 100)
    private String performedBy;

    @Column(name = "role", length = 100)
    private String role;

    @Column(name = "action_time")
    private LocalDateTime actionTime;
}
