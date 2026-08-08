package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "measurement_history")
public class MeasurementHistory extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "measurement_id", nullable = false)
    private Measurement measurement;

    @Column(name = "version_number")
    private Integer versionNumber;

    @Column(name = "snapshot_data", columnDefinition = "LONGTEXT")
    private String snapshotData; // JSON representation of the measurement state at that version

    @Column(name = "changed_by", length = 100)
    private String changedBy;

    @Column(name = "changed_at")
    private LocalDateTime changedAt;

    @Column(columnDefinition = "TEXT")
    private String changeReason;

    /** JSON of the fields as they were before the revision. */
    @Column(name = "previous_values", columnDefinition = "LONGTEXT")
    private String previousValues;

    /** JSON of the fields after the revision. */
    @Column(name = "new_values", columnDefinition = "LONGTEXT")
    private String newValues;
}
