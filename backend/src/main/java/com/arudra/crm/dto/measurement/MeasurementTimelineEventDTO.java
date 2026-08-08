package com.arudra.crm.dto.measurement;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** A single step for the measurement progress timeline (built from activity logs). */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MeasurementTimelineEventDTO {
    private String actionType;
    private String description;
    private String performedBy;
    private String role;
    private LocalDateTime actionTime;
}
