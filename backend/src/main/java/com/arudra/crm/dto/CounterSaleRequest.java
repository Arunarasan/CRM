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
    }

    public static class Installation {
        public boolean enabled;
        public BigDecimal charge;
        public BigDecimal gstRate;    // defaults to 18 when installation is billed
        public Long employeeId;       // null => task goes to the pool (anyone can pick it up)
        public String scheduledDate;  // yyyy-MM-dd
        public String notes;
    }
}
