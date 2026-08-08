package com.arudra.crm.dto.customer360;

import lombok.Data;

import java.time.LocalDateTime;

/** One row in the Customer 360 Activity Log tab (Tab 12), sourced from the shared ActivityLog table. */
@Data
public class CustomerActivityLogEntryDTO {
    private Long id;
    private String action;
    private String description;
    private String performedBy;
    private String performedRole;
    private LocalDateTime performedAt;
    private String ipAddress;
}
