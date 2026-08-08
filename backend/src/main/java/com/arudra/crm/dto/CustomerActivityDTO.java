package com.arudra.crm.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class CustomerActivityDTO {
    private Long id;
    private String action;
    private String description;
    private String performedByName;
    private LocalDateTime createdAt;

    // Optional communication-timeline fields (Customer 360, Tab 3)
    private String channel;
    private String customerMood;
    private String outcome;
    private String customerResponse;
    private String attachmentUrl;
    private String attachmentFileName;
}
