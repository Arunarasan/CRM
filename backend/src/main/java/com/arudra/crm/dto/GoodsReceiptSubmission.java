package com.arudra.crm.dto;

import java.util.List;

/**
 * Employee-portal payload to receive goods against a purchase order and approve the receipt in one
 * step. Reuses the existing GRN engine (create → quality-check → approve). The receiver is always
 * the signed-in user — never taken from the client.
 */
public class GoodsReceiptSubmission {

    public Long purchaseOrderId;
    public Long warehouseId;            // optional; defaults to the PO's destination warehouse
    public String supplierInvoiceNumber;
    public String vehicleNumber;
    public String qcStatus;             // PASS (default), PARTIAL_PASS, REJECT
    public String qcRemarks;
    public String notes;
    public List<String> photoUrls;
    public List<Line> items;

    public static class Line {
        public Long productId;
        public Integer receivedQuantity;
        public Integer damagedQuantity;
        public String remarks;
    }
}
