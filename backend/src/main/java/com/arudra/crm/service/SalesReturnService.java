package com.arudra.crm.service;

import com.arudra.crm.dto.SalesReturnRequest;
import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Customer / product returns (sales side). Restocks inventory and settles the returned value as a
 * credit note (store credit — always posted, reducing the customer's receivable) and, when the user
 * chooses a cash refund, an additional paid refund of the same value — so a fully-paid sale nets to
 * zero on the ledger with a clear audit trail. Reuses {@link FinanceService} and {@link InventoryService}.
 */
@Service
public class SalesReturnService {

    @Autowired private SalesReturnRepository returnRepository;
    @Autowired private SalesReturnItemRepository returnItemRepository;
    @Autowired private InvoiceRepository invoiceRepository;
    @Autowired private InvoiceItemRepository invoiceItemRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private WarehouseRepository warehouseRepository;
    @Autowired private InventoryService inventoryService;
    @Autowired private DamageEntryService damageEntryService;
    @Autowired private FinanceService financeService;
    @Autowired private DocumentNumberService documentNumberService;

    public Page<SalesReturn> getReturns(int page, int size) {
        return returnRepository.findByIsDeletedFalseOrderByIdDesc(PageRequest.of(page, size));
    }

    public SalesReturn getReturn(Long id) {
        return returnRepository.findById(id).orElseThrow(() -> new RuntimeException("Return not found: " + id));
    }

    public List<SalesReturnItem> getReturnItems(Long returnId) {
        return returnItemRepository.findBySalesReturnId(returnId);
    }

    /** What can still be returned from an invoice — sold minus already-returned per line. */
    @Transactional(readOnly = true)
    public Map<String, Object> getReturnableItems(Long invoiceId) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new RuntimeException("Invoice not found: " + invoiceId));
        List<Map<String, Object>> lines = new ArrayList<>();
        for (InvoiceItem it : invoiceItemRepository.findByInvoiceId(invoiceId)) {
            int returned = returnItemRepository.totalReturnedForInvoiceItem(it.getId());
            int returnable = Math.max(it.getQuantity() - returned, 0);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("invoiceItemId", it.getId());
            m.put("productId", it.getProductId());
            m.put("description", it.getDescription());
            m.put("hsnCode", it.getHsnCode());
            m.put("unit", it.getUnit());
            m.put("soldQty", it.getQuantity());
            m.put("returnedQty", returned);
            m.put("returnableQty", returnable);
            m.put("unitPrice", it.getUnitPrice());
            m.put("gstRate", it.getGstRate());
            lines.add(m);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("invoiceId", invoice.getId());
        out.put("invoiceNumber", invoice.getInvoiceNumber());
        out.put("invoiceType", invoice.getInvoiceType());
        out.put("customerId", invoice.getCustomer() != null ? invoice.getCustomer().getId() : null);
        out.put("customerName", invoice.getCustomer() != null ? invoice.getCustomer().getName() : null);
        out.put("items", lines);
        return out;
    }

    private record Restock(Long productId, Long warehouseId, int qty, boolean damaged) {}

    @Transactional
    public SalesReturn createReturn(SalesReturnRequest req, User user) {
        if (req == null || req.invoiceId == null) throw new RuntimeException("A return needs an invoice");
        if (req.items == null || req.items.isEmpty()) throw new RuntimeException("Select at least one item to return");
        Invoice invoice = invoiceRepository.findById(req.invoiceId)
                .orElseThrow(() -> new RuntimeException("Invoice not found: " + req.invoiceId));
        Customer customer = invoice.getCustomer();
        if (customer == null) throw new RuntimeException("Invoice has no customer");

        SalesReturn ret = new SalesReturn();
        ret.setInvoice(invoice);
        ret.setCustomer(customer);
        ret.setDate(LocalDate.now());
        ret.setReason(blankToNull(req.reason));
        ret.setSettlementMode("REFUND".equals(req.settlementMode) ? "REFUND" : "CREDIT_NOTE");
        ret.setRestocked(req.restock);
        ret.setWarehouseId(req.warehouseId);
        ret.setReturnNumber(String.format("SRET-%06d", documentNumberService.nextValue("SALES_RETURN")));

        BigDecimal subTotal = BigDecimal.ZERO;
        BigDecimal gstTotal = BigDecimal.ZERO;
        List<SalesReturnItem> items = new ArrayList<>();
        List<Restock> restocks = new ArrayList<>();

        for (SalesReturnRequest.Line line : req.items) {
            if (line == null || line.invoiceItemId == null) continue;
            int qty = line.quantity == null ? 0 : line.quantity;
            if (qty <= 0) continue;
            InvoiceItem ii = invoiceItemRepository.findById(line.invoiceItemId)
                    .orElseThrow(() -> new RuntimeException("Invoice line not found"));
            if (ii.getInvoice() == null || !ii.getInvoice().getId().equals(invoice.getId())) {
                throw new RuntimeException("Line does not belong to this invoice");
            }
            int alreadyReturned = returnItemRepository.totalReturnedForInvoiceItem(ii.getId());
            int returnable = ii.getQuantity() - alreadyReturned;
            if (qty > returnable) {
                throw new RuntimeException("Cannot return " + qty + " of \"" + ii.getDescription()
                        + "\" — only " + returnable + " left to return");
            }
            // Refund rate is editable at return time (e.g. a reduced rate for damaged/opened goods);
            // falls back to the original sold rate.
            BigDecimal unitPrice = (line.unitPrice != null && line.unitPrice.signum() > 0)
                    ? line.unitPrice : ii.getUnitPrice();
            BigDecimal lineBase = unitPrice.multiply(BigDecimal.valueOf(qty));
            BigDecimal rate = ii.getGstRate() == null ? BigDecimal.ZERO : ii.getGstRate();
            BigDecimal lineGst = lineBase.multiply(rate).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            subTotal = subTotal.add(lineBase);
            gstTotal = gstTotal.add(lineGst);

            boolean damaged = "DAMAGED".equalsIgnoreCase(line.condition);

            SalesReturnItem sri = new SalesReturnItem();
            sri.setInvoiceItemId(ii.getId());
            sri.setProductId(ii.getProductId());
            sri.setDescription(ii.getDescription());
            sri.setHsnCode(ii.getHsnCode());
            sri.setQuantity(qty);
            sri.setUnitPrice(unitPrice);
            sri.setGstRate(rate);
            sri.setLineTotal(lineBase.add(lineGst));
            sri.setCondition(damaged ? "DAMAGED" : "GOOD");
            items.add(sri);

            if (req.restock && ii.getProductId() != null) {
                Long wh = req.warehouseId != null ? req.warehouseId : ii.getSourceWarehouseId();
                restocks.add(new Restock(ii.getProductId(), wh, qty, damaged));
            }
        }
        if (items.isEmpty()) throw new RuntimeException("Nothing to return");

        BigDecimal total = subTotal.add(gstTotal).setScale(2, RoundingMode.HALF_UP);
        ret.setSubTotal(subTotal.setScale(2, RoundingMode.HALF_UP));
        ret.setGstAmount(gstTotal.setScale(2, RoundingMode.HALF_UP));
        ret.setTotalAmount(total);

        SalesReturn saved = returnRepository.save(ret);
        for (SalesReturnItem sri : items) {
            sri.setSalesReturn(saved);
            returnItemRepository.save(sri);
        }

        // Restore inventory. GOOD items go back to usable stock; DAMAGED items are restocked and
        // then moved into the damaged bucket via a damage entry (so they are never resold).
        if (req.restock) {
            String damageReason = "Returned damaged — " + saved.getReturnNumber()
                    + (saved.getReason() != null ? " (" + saved.getReason() + ")" : "");
            for (Restock r : restocks) {
                try {
                    Long warehouseUsed = restock(r.productId(), r.warehouseId(), r.qty(), saved.getReturnNumber(), saved.getId());
                    if (r.damaged() && warehouseUsed != null) {
                        damageEntryService.report(r.productId(), warehouseUsed, r.qty(), damageReason, null, null, user);
                    }
                } catch (Exception ignored) { /* stock hiccup must not block the return */ }
            }
        }

        // Money: always a credit note (reduces receivable / gives store credit).
        CreditDebitNote note = new CreditDebitNote();
        note.setType("CREDIT");
        note.setCustomer(customer);
        note.setAmount(total);
        note.setDate(LocalDate.now());
        note.setReason("Sales return " + saved.getReturnNumber());
        CreditDebitNote savedNote = financeService.addNote(note);
        saved.setNoteId(savedNote.getId());

        // If a cash refund was chosen, pay it out too (nets the ledger to zero for a paid sale).
        if ("REFUND".equals(saved.getSettlementMode())) {
            String method = blankToNull(req.refundMethod) != null ? req.refundMethod.trim() : "CASH";
            Refund refund = new Refund();
            refund.setCustomer(customer);
            refund.setInvoice(invoice);
            refund.setAmount(total);
            refund.setReason("Refund for sales return " + saved.getReturnNumber());
            Refund r = financeService.requestRefund(refund, user);
            financeService.decideRefund(r.getId(), true, user);
            financeService.markRefundPaid(r.getId(), method, saved.getReturnNumber());
            saved.setRefundId(r.getId());
            saved.setRefundMethod(method);
        }

        return returnRepository.save(saved);
    }

    /** Adds returned units back to usable stock; returns the warehouse id used (or null if none). */
    private Long restock(Long productId, Long warehouseId, int qty, String ref, Long refId) {
        Warehouse wh = resolveWarehouse(productId, warehouseId);
        if (wh == null) return null;
        InventoryTransaction tx = new InventoryTransaction();
        tx.setProduct(productRepository.findById(productId).orElseThrow());
        tx.setDestinationWarehouse(wh);
        tx.setType("ADJUSTMENT"); // inbound branch of processTransaction adds to the destination warehouse
        tx.setQuantity(qty);
        tx.setReference(ref);
        tx.setReferenceType("SALES_RETURN");
        tx.setReferenceId(refId);
        tx.setDate(LocalDateTime.now());
        inventoryService.processTransaction(tx);
        return wh.getId();
    }

    private Warehouse resolveWarehouse(Long productId, Long warehouseId) {
        if (warehouseId != null) return warehouseRepository.findById(warehouseId).orElse(null);
        Product p = productRepository.findById(productId).orElse(null);
        if (p != null && p.getDefaultWarehouse() != null) return p.getDefaultWarehouse();
        return warehouseRepository.findAll().stream().findFirst().orElse(null);
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}
