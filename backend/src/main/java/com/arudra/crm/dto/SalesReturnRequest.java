package com.arudra.crm.dto;

import java.util.List;

/**
 * Payload to record a customer/product return against an invoice. Restocks inventory and settles
 * the value as a credit note or cash refund.
 */
public class SalesReturnRequest {

    public Long invoiceId;              // the sale the goods came from
    public String reason;
    public String settlementMode;       // CREDIT_NOTE (default) or REFUND
    public String refundMethod;         // CASH/UPI/... when settlementMode = REFUND
    public boolean restock = true;
    public Long warehouseId;            // where returned stock goes (optional)
    public List<Line> items;

    public static class Line {
        public Long invoiceItemId;      // the invoice line being returned
        public Integer quantity;        // how many units come back
        public String condition;        // GOOD (default) or DAMAGED
        public java.math.BigDecimal unitPrice; // refund rate override; falls back to the sold rate
    }
}
