package com.arudra.crm.dto.customer360;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * A single row in the unified Documents tab, merged from CustomerDocument (direct),
 * ProjectDocument (via the customer's projects), QuotationAttachment (via the customer's
 * quotations), and LeadDocument (via the originating, converted lead) — there is no single
 * table spanning all of these in the schema, so the service merges them at read time.
 */
@Data
public class CustomerDocumentUnifiedDTO {
    private Long id;
    /** CUSTOMER, PROJECT, QUOTATION, LEAD */
    private String sourceType;
    private Long sourceId;
    private String sourceLabel; // e.g. project name / quotation number, for display
    private String fileName;
    private String fileUrl;
    private String documentType;
    private Integer documentVersion;
    private String uploadedByName;
    private LocalDateTime uploadedAt;
}
