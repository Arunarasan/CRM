package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "boq_activity_logs")
public class BoqActivityLog extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "boq_id", nullable = false)
    private Boq boq;

    @Column(name = "action_type", length = 100)
    private String actionType;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "performed_by", length = 100)
    private String performedBy;

    @Column(name = "role", length = 100)
    private String role;

    @Column(name = "action_time")
    private LocalDateTime actionTime;
}
