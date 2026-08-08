package com.arudra.crm.dto.lead;

import lombok.Data;

/** Result of a lead conversion: ids of everything that now carries the history. */
@Data
public class LeadConversionResultDTO {
    private Long leadId;
    private Long customerId;
    private String customerName;
    private int linkedQuotations;
    private int linkedSiteVisits;
    private int linkedMeasurements;
}
