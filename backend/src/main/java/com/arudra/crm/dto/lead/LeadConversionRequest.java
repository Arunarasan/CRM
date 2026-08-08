package com.arudra.crm.dto.lead;

import lombok.Data;

/** Payload for the lead conversion flow (customer only — Projects are only ever created from an approved Quotation). */
@Data
public class LeadConversionRequest {
    private String notes;
}
