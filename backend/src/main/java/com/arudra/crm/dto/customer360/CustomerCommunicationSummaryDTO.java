package com.arudra.crm.dto.customer360;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CustomerCommunicationSummaryDTO {
    private long totalInteractions;
    private long calls;
    private long whatsappMessages;
    private long emails;
    private long meetings;
    private long siteVisitDiscussions;
    private LocalDateTime lastCommunicationDate;
    private String lastCommunicationChannel;
    private String lastCommunicationOutcome;
}
