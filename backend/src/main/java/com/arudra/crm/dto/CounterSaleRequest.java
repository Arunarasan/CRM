package com.arudra.crm.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Payload for a walk-in / counter sale — a project-less invoice that bills products sold over
 * the counter, optionally with an installation charge that spins off a Task.
 *
 * The customer is either an existing one ({@code customerId}) or a walk-in resolved find-or-create
 * from {@code customerName}/{@code customerPhone}/{@code customerEmail}.
 */
public class CounterSaleRequest {

    // --- customer: existing OR walk-in (find-or-create) ---
    public Long customerId;
    public String customerName;
    public String customerPhone;
    public String customerEmail;

    // --- invoice header ---
    public String gstType;        // CGST_SGST (default) or IGST
    public Boolean taxInclusive;  // true = the entered prices already include GST
    public String placeOfSupply;
    public String discountType;   // PERCENTAGE or FLAT
    public BigDecimal discountValue;
    public String notes;
    public String terms;

    // --- inventory ---
    public boolean deductStock = true;
    public Long warehouseId;      // default source warehouse for stock-out; per-line override wins

    public List<Item> items;
    public Installation installation;
    public Work work;

    // --- payment ---
    public boolean collectNow;
    public String paymentMethod;  // CASH / UPI / CARD / ... (when collectNow)

    public static class Item {
        public Long productId;    // null for a free-text / non-catalogue line
        public String description;
        public String hsnCode;
        public String unit;
        public Integer quantity;
        public BigDecimal unitPrice;
        public BigDecimal gstRate;
        public Long warehouseId;  // optional per-line source warehouse
        // --- bundle work (stitching / making) for this line ---
        public boolean needsWork;
        public Integer bundleNo;  // which bundle (1-based) this line goes in; default 1
        public String workSpec;   // JSON text: type / width / height / pleat / lining ...
        public String workNotes;
    }

    public static class Installation {
        public boolean enabled;
        public BigDecimal charge;
        public BigDecimal gstRate;    // defaults to 18 when installation is billed
        public Long employeeId;       // null => task goes to the pool (anyone can pick it up)
        public String scheduledDate;  // yyyy-MM-dd
        public String notes;
    }

    /**
     * Stitching / making work on some of the sold lines. Lines flagged {@code needsWork} are packed
     * into {@code bundleCount} stickered bundles (see BundleService); an optional charge is billed.
     */
    public static class Work {
        public boolean enabled;
        public BigDecimal charge;
        public BigDecimal gstRate;    // defaults to 5 when a work charge is billed
        public String workType;       // STITCHING (default) / MAKING / FITTING / OTHER
        public Integer bundleCount;   // number of stickers; default 1
        public String dueDate;        // yyyy-MM-dd
        public String priority;
        public String resourceType;   // EMPLOYEE / CONTRACTOR (optional)
        public Long resourceId;
        public String handoverMode;   // PICKUP / DELIVERY
        public String notes;
    }
}
