package com.arudra.crm.dto;

import java.math.BigDecimal;
import java.util.List;

/** Request payloads for the Bundle tracking API ({@code /api/bundles}). */
public final class BundleRequests {

    private BundleRequests() {}

    /** Create one or more bundles (stickers) for a bill. */
    public static class Create {
        public Long invoiceId;
        public Long customerId;        // only needed when there is no invoice
        public String workType;        // STITCHING (default) / MAKING / FITTING / OTHER
        public String dueDate;         // yyyy-MM-dd
        public String priority;        // LOW / MEDIUM (default) / HIGH / URGENT
        public String resourceType;    // EMPLOYEE / CONTRACTOR (optional)
        public Long resourceId;
        public String handoverMode;    // PICKUP (default) / DELIVERY; INSTALL only with installTaskId
        public Long installTaskId;     // the bill's installation task (counter sale with installation)
        public String rackLocation;
        public String notes;
        public List<BundleSpec> bundles;
    }

    public static class BundleSpec {
        public List<ItemSpec> items;
    }

    public static class ItemSpec {
        public Long invoiceItemId;     // fills description/qty/unit/product from the bill line when blank
        public Long productId;
        public String description;
        public BigDecimal quantity;
        public String unit;
        public String workSpec;        // JSON text
        public String notes;
        public String photoUrls;       // JSON array text
    }

    /** Move a bundle to another status. */
    public static class Move {
        public String status;
        public String note;
        public String photoUrl;
        public String deliveredTo;     // when moving to DELIVERED
    }

    /**
     * Hand one or more bundles to the customer, optionally collecting what is still owed on their
     * bill(s) first. Payments are applied oldest bill first.
     */
    public static class Handover {
        public List<Long> bundleIds;
        public String deliveredTo;
        public String note;
        public String photoUrl;
        public List<Payment> payments;
        /** Manager-only: hand over although a balance is still due. Requires {@link #note}. */
        public boolean allowBalanceDue;
    }

    public static class Payment {
        public String method;          // CASH / UPI / CARD / ...
        public BigDecimal amount;
        public String referenceNumber;
    }

    public static class Assign {
        public String resourceType;    // null/blank clears the assignment
        public Long resourceId;
    }

    /** Edit header fields and/or per-item specs. Null fields are left unchanged. */
    public static class Update {
        public String workType;
        public String dueDate;         // "" clears
        public String priority;
        public String handoverMode;
        public String rackLocation;
        public String notes;
        public List<ItemUpdate> items;
    }

    public static class ItemUpdate {
        public Long id;
        public String workSpec;
        public String notes;
        public String photoUrls;
        public Boolean done;
    }
}
