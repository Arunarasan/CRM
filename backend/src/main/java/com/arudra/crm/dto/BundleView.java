package com.arudra.crm.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * What the Bundles screens (and a scan of the sticker code) show. List rows leave
 * {@link #items}/{@link #events}/{@link #siblings} null; the detail view fills them.
 */
public class BundleView {
    public Long id;
    public String code;
    public String groupCode;
    public Integer bundleNo;
    public Integer bundleTotal;
    public String status;
    public String nextStatus;          // the next step in the flow (null when terminal / on hold)
    public String heldFromStatus;
    public String holdReason;
    public String workType;
    public String resourceType;
    public Long resourceId;
    public String assigneeName;
    public LocalDate dueDate;
    public boolean overdue;
    public String priority;
    public String handoverMode;
    public String rackLocation;
    public String notes;
    public LocalDateTime packedAt;
    public LocalDateTime deliveredAt;
    public String deliveredTo;
    public LocalDateTime createdAt;

    public Long invoiceId;
    public String invoiceNumber;
    public LocalDate invoiceDate;
    public Long customerId;
    public String customerName;
    public String customerPhone;

    public int itemCount;
    public BigDecimal totalQuantity;

    public List<Item> items;
    public List<Event> events;
    public List<Sibling> siblings;

    public static class Item {
        public Long id;
        public Long invoiceItemId;
        public Long productId;
        public String description;
        public BigDecimal quantity;
        public String unit;
        public String workSpec;
        public String notes;
        public String photoUrls;
        public boolean done;
    }

    public static class Event {
        public Long id;
        public String fromStatus;
        public String toStatus;
        public String userName;
        public String note;
        public String photoUrl;
        public LocalDateTime at;
    }

    public static class Sibling {
        public Long id;
        public String code;
        public Integer bundleNo;
        public String status;
    }
}
