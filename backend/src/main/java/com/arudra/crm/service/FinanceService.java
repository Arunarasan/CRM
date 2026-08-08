package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Enterprise Billing & Finance core: GST invoices, payment collection & allocation,
 * customer ledger, credit/debit notes, refunds and stage-wise payment schedules.
 * Supersedes (but does not break) the legacy BillingService — both operate on the
 * same invoice/payment tables; this service adds the accounting discipline
 * (immutable ledger, idempotent postings, status recalculation).
 */
@Service
public class FinanceService {

    /** Invoice statuses that still owe money and count toward outstanding. */
    public static final List<String> OPEN_INVOICE_STATUSES = List.of("GENERATED", "SENT", "PARTIAL", "OVERDUE");
    private static final List<String> NOT_REVENUE_STATUSES = List.of("DRAFT", "CANCELLED");

    @Autowired private InvoiceRepository invoiceRepository;
    @Autowired private InvoiceItemRepository invoiceItemRepository;
    @Autowired private CustomerPaymentRepository paymentRepository;
    @Autowired private CreditDebitNoteRepository noteRepository;
    @Autowired private RefundRepository refundRepository;
    @Autowired private PaymentScheduleRepository scheduleRepository;
    @Autowired private CustomerLedgerEntryRepository ledgerRepository;
    @Autowired private CustomerRepository customerRepository;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private QuotationRepository quotationRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private NotificationService notificationService;

    // =====================================================================
    // Numbering
    // =====================================================================

    private String nextNumber(String prefix, Optional<Long> lastId) {
        return prefix + String.format("%06d", lastId.orElse(0L) + 1);
    }

    private String nextInvoiceNumber() {
        return nextNumber("INV-", invoiceRepository.findTopByOrderByIdDesc().map(Invoice::getId));
    }

    private String nextPaymentNumber() {
        return nextNumber("PAY-", paymentRepository.findTopByOrderByIdDesc().map(CustomerPayment::getId));
    }

    // =====================================================================
    // Invoices
    // =====================================================================

    public Page<Invoice> searchInvoices(String status, String invoiceType, Long customerId, Long projectId,
                                        LocalDate from, LocalDate to, String search, int page, int size) {
        String q = (search == null || search.isBlank()) ? null : search.trim();
        return invoiceRepository.search(emptyToNull(status), emptyToNull(invoiceType), customerId, projectId,
                from, to, q, PageRequest.of(page, size));
    }

    public Invoice getInvoice(Long id) {
        return invoiceRepository.findById(id).orElseThrow(() -> new RuntimeException("Invoice not found: " + id));
    }

    public List<InvoiceItem> getInvoiceItems(Long invoiceId) {
        return invoiceItemRepository.findByInvoiceId(invoiceId);
    }

    /**
     * Creates an invoice with full GST math: per-line tax, header discount applied
     * proportionally before tax, CGST/SGST vs IGST split, retention and round-off.
     */
    @Transactional
    public Invoice createInvoice(Invoice invoice, List<InvoiceItem> items) {
        if (items == null || items.isEmpty()) {
            throw new RuntimeException("Invoice needs at least one line item");
        }
        if (invoice.getCustomer() == null || invoice.getCustomer().getId() == null) {
            throw new RuntimeException("Invoice needs a customer");
        }
        invoice.setId(null);
        invoice.setInvoiceNumber(nextInvoiceNumber());
        if (invoice.getDate() == null) invoice.setDate(LocalDate.now());
        if (invoice.getStatus() == null || invoice.getStatus().isBlank()) invoice.setStatus("DRAFT");

        computeTotals(invoice, items);

        Invoice saved = invoiceRepository.save(invoice);
        for (InvoiceItem item : items) {
            item.setId(null);
            item.setInvoice(saved);
            invoiceItemRepository.save(item);
        }
        if (!"DRAFT".equals(saved.getStatus())) {
            postInvoiceToLedger(saved);
        }
        if (saved.getPaymentSchedule() != null && saved.getPaymentSchedule().getId() != null) {
            scheduleRepository.findById(saved.getPaymentSchedule().getId()).ifPresent(s -> {
                s.setInvoice(saved);
                s.setStatus("INVOICED");
                scheduleRepository.save(s);
            });
        }
        notifyFinanceUsers("Invoice " + saved.getInvoiceNumber() + " created",
                "Invoice for ₹" + saved.getTotalAmount() + " created for " + saved.getCustomer().getName(),
                "INVOICE_GENERATED", "/finance/invoices/" + saved.getId());
        return saved;
    }

    /** Recomputes an existing DRAFT invoice's lines and totals (issued invoices are immutable). */
    @Transactional
    public Invoice updateDraftInvoice(Long id, Invoice changes, List<InvoiceItem> items) {
        Invoice invoice = getInvoice(id);
        if (!"DRAFT".equals(invoice.getStatus())) {
            throw new RuntimeException("Only DRAFT invoices can be edited; issue a credit/debit note instead");
        }
        invoice.setDate(changes.getDate() != null ? changes.getDate() : invoice.getDate());
        invoice.setDueDate(changes.getDueDate());
        invoice.setInvoiceType(changes.getInvoiceType() != null ? changes.getInvoiceType() : invoice.getInvoiceType());
        invoice.setPaymentStage(changes.getPaymentStage());
        invoice.setDiscountType(changes.getDiscountType());
        invoice.setDiscountValue(changes.getDiscountValue());
        invoice.setGstType(changes.getGstType() != null ? changes.getGstType() : invoice.getGstType());
        invoice.setRetentionPercent(changes.getRetentionPercent());
        invoice.setPlaceOfSupply(changes.getPlaceOfSupply());
        invoice.setNotes(changes.getNotes());
        invoice.setTerms(changes.getTerms());
        if (changes.getProject() != null) invoice.setProject(changes.getProject());
        if (changes.getQuotation() != null) invoice.setQuotation(changes.getQuotation());
        if (changes.getBoq() != null) invoice.setBoq(changes.getBoq());

        if (items != null && !items.isEmpty()) {
            invoiceItemRepository.deleteAll(invoiceItemRepository.findByInvoiceId(id));
            computeTotals(invoice, items);
            Invoice saved = invoiceRepository.save(invoice);
            for (InvoiceItem item : items) {
                item.setId(null);
                item.setInvoice(saved);
                invoiceItemRepository.save(item);
            }
            return saved;
        }
        computeTotals(invoice, invoiceItemRepository.findByInvoiceId(id));
        return invoiceRepository.save(invoice);
    }

    private void computeTotals(Invoice invoice, List<InvoiceItem> items) {
        BigDecimal subTotal = BigDecimal.ZERO;
        for (InvoiceItem item : items) {
            if (item.getGstRate() == null) item.setGstRate(BigDecimal.ZERO);
            BigDecimal lineTotal = item.getUnitPrice().multiply(BigDecimal.valueOf(item.getQuantity()));
            BigDecimal lineGst = lineTotal.multiply(item.getGstRate()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            item.setTotalPrice(lineTotal.add(lineGst));
            subTotal = subTotal.add(lineTotal);
        }

        BigDecimal discount = BigDecimal.ZERO;
        if (invoice.getDiscountValue() != null && invoice.getDiscountValue().signum() > 0) {
            if ("PERCENTAGE".equals(invoice.getDiscountType())) {
                discount = subTotal.multiply(invoice.getDiscountValue()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            } else {
                discount = invoice.getDiscountValue();
            }
        }
        if (discount.compareTo(subTotal) > 0) discount = subTotal;
        BigDecimal taxableValue = subTotal.subtract(discount);

        // GST on the discounted taxable value, scaling each line's tax proportionally.
        BigDecimal totalGst = BigDecimal.ZERO;
        for (InvoiceItem item : items) {
            BigDecimal lineTotal = item.getUnitPrice().multiply(BigDecimal.valueOf(item.getQuantity()));
            BigDecimal share = subTotal.signum() == 0 ? BigDecimal.ZERO
                    : lineTotal.divide(subTotal, 6, RoundingMode.HALF_UP);
            BigDecimal lineTaxable = taxableValue.multiply(share);
            totalGst = totalGst.add(lineTaxable.multiply(item.getGstRate()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP));
        }
        totalGst = totalGst.setScale(2, RoundingMode.HALF_UP);

        invoice.setSubTotal(subTotal);
        invoice.setDiscountAmount(discount);
        invoice.setGstAmount(totalGst);
        if ("IGST".equals(invoice.getGstType())) {
            invoice.setIgstAmount(totalGst);
            invoice.setCgstAmount(BigDecimal.ZERO);
            invoice.setSgstAmount(BigDecimal.ZERO);
        } else {
            BigDecimal half = totalGst.divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
            invoice.setCgstAmount(half);
            invoice.setSgstAmount(totalGst.subtract(half));
            invoice.setIgstAmount(BigDecimal.ZERO);
        }

        BigDecimal rawTotal = taxableValue.add(totalGst);
        BigDecimal rounded = rawTotal.setScale(0, RoundingMode.HALF_UP);
        invoice.setRoundOff(rounded.subtract(rawTotal).setScale(2, RoundingMode.HALF_UP));
        invoice.setTotalAmount(rounded.setScale(2, RoundingMode.HALF_UP));

        if (invoice.getRetentionPercent() != null && invoice.getRetentionPercent().signum() > 0) {
            invoice.setRetentionAmount(invoice.getTotalAmount().multiply(invoice.getRetentionPercent())
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP));
        } else {
            invoice.setRetentionAmount(BigDecimal.ZERO);
        }
        invoice.setBalanceDue(invoice.getTotalAmount().subtract(invoice.getAmountPaid() == null ? BigDecimal.ZERO : invoice.getAmountPaid()));
    }

    /** DRAFT -> GENERATED: the invoice becomes a real receivable and hits the ledger. */
    @Transactional
    public Invoice issueInvoice(Long id) {
        Invoice invoice = getInvoice(id);
        if (!"DRAFT".equals(invoice.getStatus())) return invoice;
        invoice.setStatus("GENERATED");
        Invoice saved = invoiceRepository.save(invoice);
        postInvoiceToLedger(saved);
        return saved;
    }

    @Transactional
    public Invoice markSent(Long id) {
        Invoice invoice = getInvoice(id);
        if ("DRAFT".equals(invoice.getStatus())) {
            issueInvoice(id);
            invoice = getInvoice(id);
        }
        if (List.of("GENERATED", "OVERDUE").contains(invoice.getStatus())) {
            invoice.setStatus("SENT");
        }
        invoice.setSentAt(LocalDateTime.now());
        return invoiceRepository.save(invoice);
    }

    @Transactional
    public Invoice cancelInvoice(Long id, String reason) {
        Invoice invoice = getInvoice(id);
        if ("PAID".equals(invoice.getStatus())) {
            throw new RuntimeException("A fully paid invoice cannot be cancelled; issue a credit note or refund");
        }
        if (invoice.getAmountPaid() != null && invoice.getAmountPaid().signum() > 0) {
            throw new RuntimeException("Invoice has payments recorded against it; issue a credit note instead");
        }
        boolean wasPosted = !"DRAFT".equals(invoice.getStatus());
        invoice.setStatus("CANCELLED");
        invoice.setCancelledReason(reason);
        invoice.setBalanceDue(BigDecimal.ZERO);
        Invoice saved = invoiceRepository.save(invoice);
        if (wasPosted && !ledgerRepository.existsByReferenceTypeAndReferenceIdAndEntryType("INVOICE", id, "REVERSAL")) {
            postLedger(saved.getCustomer(), saved.getProject(), LocalDate.now(), "REVERSAL", "INVOICE", id,
                    saved.getInvoiceNumber(), "Invoice " + saved.getInvoiceNumber() + " cancelled" +
                            (reason == null ? "" : ": " + reason),
                    BigDecimal.ZERO, saved.getTotalAmount());
        }
        if (saved.getPaymentSchedule() != null) {
            scheduleRepository.findById(saved.getPaymentSchedule().getId()).ifPresent(s -> {
                s.setInvoice(null);
                s.setStatus("PENDING");
                scheduleRepository.save(s);
            });
        }
        notifyFinanceUsers("Invoice " + saved.getInvoiceNumber() + " cancelled",
                "Cancelled" + (reason == null ? "" : ": " + reason), "INVOICE_CANCELLED",
                "/finance/invoices/" + saved.getId());
        return saved;
    }

    /**
     * Auto-generates an advance invoice from an approved quotation (idempotent —
     * an existing non-cancelled advance invoice for the quotation is returned as-is).
     */
    /**
     * Entry point for automation that must not fail when billing does. Runs in its own transaction:
     * joining the caller's would mark it rollback-only on failure, so the caller's own work (e.g.
     * approving the quotation) would then die at commit with UnexpectedRollbackException even though
     * it caught the exception. Callers still need their own try/catch for the thrown exception.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Invoice generateFromQuotationIndependently(Long quotationId, BigDecimal advancePercent, boolean draft) {
        return generateFromQuotation(quotationId, advancePercent, draft);
    }

    @Transactional
    public Invoice generateFromQuotation(Long quotationId, BigDecimal advancePercent, boolean draft) {
        Quotation quotation = quotationRepository.findById(quotationId)
                .orElseThrow(() -> new RuntimeException("Quotation not found: " + quotationId));
        for (Invoice existing : invoiceRepository.findByQuotationIdAndInvoiceType(quotationId, "ADVANCE")) {
            if (!"CANCELLED".equals(existing.getStatus())) return existing;
        }
        if (quotation.getGrandTotal() == null || quotation.getGrandTotal().signum() <= 0) {
            throw new RuntimeException("Quotation has no value to invoice");
        }
        BigDecimal pct = advancePercent == null ? BigDecimal.valueOf(20) : advancePercent;
        BigDecimal amount = quotation.getGrandTotal().multiply(pct).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);

        Invoice invoice = new Invoice();
        invoice.setCustomer(quotation.getCustomer());
        invoice.setProject(quotation.getProject());
        invoice.setQuotation(quotation);
        invoice.setBoq(quotation.getBoq());
        invoice.setInvoiceType("ADVANCE");
        invoice.setPaymentStage("QUOTATION_ADVANCE");
        invoice.setDate(LocalDate.now());
        invoice.setDueDate(LocalDate.now().plusDays(7));
        invoice.setStatus(draft ? "DRAFT" : "GENERATED");
        invoice.setTerms(quotation.getTermsAndConditions());

        InvoiceItem item = new InvoiceItem();
        item.setDescription("Advance (" + pct.stripTrailingZeros().toPlainString() + "%) against quotation "
                + quotation.getQuotationNumber());
        item.setQuantity(1);
        item.setUnitPrice(amount);
        item.setGstRate(BigDecimal.ZERO); // advance billed as lump sum; tax settles on progress/final invoices
        return createInvoice(invoice, new ArrayList<>(List.of(item)));
    }

    /** Generates the invoice for one payment-schedule stage. */
    @Transactional
    public Invoice generateStageInvoice(Long scheduleId) {
        PaymentSchedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new RuntimeException("Payment schedule not found: " + scheduleId));
        if (schedule.getInvoice() != null && !"CANCELLED".equals(schedule.getInvoice().getStatus())) {
            return schedule.getInvoice();
        }
        Project project = schedule.getProject();
        if (project.getCustomer() == null) {
            throw new RuntimeException("Project has no customer to invoice");
        }
        Invoice invoice = new Invoice();
        invoice.setCustomer(project.getCustomer());
        invoice.setProject(project);
        invoice.setQuotation(project.getQuotation());
        invoice.setInvoiceType("PROGRESS");
        invoice.setPaymentStage(schedule.getStage());
        invoice.setPaymentSchedule(schedule);
        invoice.setDate(LocalDate.now());
        invoice.setDueDate(schedule.getDueDate() != null ? schedule.getDueDate() : LocalDate.now().plusDays(7));
        invoice.setStatus("GENERATED");

        InvoiceItem item = new InvoiceItem();
        item.setDescription(schedule.getStage() + (schedule.getDescription() == null ? "" : " — " + schedule.getDescription()));
        item.setQuantity(1);
        item.setUnitPrice(schedule.getAmount());
        item.setGstRate(BigDecimal.valueOf(18));
        return createInvoice(invoice, new ArrayList<>(List.of(item)));
    }

    /**
     * Re-derives amountPaid/balanceDue/status from confirmed payments and active notes.
     * The single source of truth for invoice payment state.
     */
    @Transactional
    public Invoice recalculateInvoice(Long invoiceId) {
        Invoice invoice = getInvoice(invoiceId);
        if ("CANCELLED".equals(invoice.getStatus())) return invoice;

        BigDecimal paid = BigDecimal.ZERO;
        for (CustomerPayment p : paymentRepository.findByInvoiceId(invoiceId)) {
            if ("CONFIRMED".equals(p.getStatus()) && !Boolean.TRUE.equals(p.getIsDeleted())) {
                paid = paid.add(p.getAmount());
            }
        }
        BigDecimal noteAdjustment = BigDecimal.ZERO; // credit notes reduce receivable, debit notes increase it
        for (CreditDebitNote n : noteRepository.findByInvoiceId(invoiceId)) {
            if (!"ACTIVE".equals(n.getStatus()) || Boolean.TRUE.equals(n.getIsDeleted())) continue;
            if ("CREDIT".equals(n.getType())) noteAdjustment = noteAdjustment.add(n.getAmount());
            else if ("DEBIT".equals(n.getType())) noteAdjustment = noteAdjustment.subtract(n.getAmount());
        }

        BigDecimal balance = invoice.getTotalAmount().subtract(paid).subtract(noteAdjustment);
        if (balance.signum() < 0) balance = BigDecimal.ZERO;
        invoice.setAmountPaid(paid);
        invoice.setBalanceDue(balance);

        if (!"DRAFT".equals(invoice.getStatus())) {
            if (balance.signum() == 0) {
                invoice.setStatus("PAID");
            } else if (paid.signum() > 0 || noteAdjustment.signum() > 0) {
                invoice.setStatus("PARTIAL");
            } else if (invoice.getDueDate() != null && invoice.getDueDate().isBefore(LocalDate.now())) {
                invoice.setStatus("OVERDUE");
            } else if ("PAID".equals(invoice.getStatus()) || "PARTIAL".equals(invoice.getStatus())) {
                invoice.setStatus("SENT");
            }
        }
        Invoice saved = invoiceRepository.save(invoice);
        syncScheduleFromInvoice(saved);
        return saved;
    }

    private void syncScheduleFromInvoice(Invoice invoice) {
        if (invoice.getPaymentSchedule() == null) return;
        scheduleRepository.findById(invoice.getPaymentSchedule().getId()).ifPresent(s -> {
            switch (invoice.getStatus()) {
                case "PAID" -> s.setStatus("PAID");
                case "PARTIAL" -> s.setStatus("PARTIAL");
                case "OVERDUE" -> s.setStatus("OVERDUE");
                default -> s.setStatus("INVOICED");
            }
            scheduleRepository.save(s);
        });
    }

    // =====================================================================
    // Payments
    // =====================================================================

    public Page<CustomerPayment> searchPayments(String status, Long customerId, Long projectId, String method,
                                                LocalDate from, LocalDate to, String search, int page, int size) {
        String q = (search == null || search.isBlank()) ? null : search.trim();
        return paymentRepository.search(emptyToNull(status), customerId, projectId, emptyToNull(method),
                from, to, q, PageRequest.of(page, size));
    }

    public List<CustomerPayment> getPaymentsForInvoice(Long invoiceId) {
        return paymentRepository.findByInvoiceId(invoiceId);
    }

    public List<CustomerPayment> getPendingApprovalPayments() {
        return paymentRepository.findByStatusAndIsDeletedFalseOrderByIdDesc("PENDING_APPROVAL");
    }

    /**
     * Records a customer payment. Confirmed payments immediately update the invoice
     * balance and post to the ledger; field collections can arrive PENDING_APPROVAL.
     */
    @Transactional
    public CustomerPayment recordPayment(CustomerPayment payment, User actingUser) {
        if (payment.getCustomer() == null || payment.getCustomer().getId() == null) {
            // derive the customer from the invoice when only the invoice is given
            if (payment.getInvoice() != null && payment.getInvoice().getId() != null) {
                payment.setCustomer(getInvoice(payment.getInvoice().getId()).getCustomer());
            } else {
                throw new RuntimeException("Payment needs a customer or an invoice");
            }
        }
        if (payment.getAmount() == null || payment.getAmount().signum() <= 0) {
            throw new RuntimeException("Payment amount must be positive");
        }
        payment.setId(null);
        payment.setPaymentNumber(nextPaymentNumber());
        if (payment.getPaymentDate() == null) payment.setPaymentDate(LocalDate.now());
        if (payment.getStatus() == null || payment.getStatus().isBlank()) payment.setStatus("CONFIRMED");
        if (payment.getCollectedBy() == null) payment.setCollectedBy(actingUser);
        if (payment.getProject() == null && payment.getInvoice() != null && payment.getInvoice().getId() != null) {
            payment.setProject(getInvoice(payment.getInvoice().getId()).getProject());
        }

        CustomerPayment saved = paymentRepository.save(payment);
        if ("CONFIRMED".equals(saved.getStatus())) {
            applyConfirmedPayment(saved);
        }
        return saved;
    }

    @Transactional
    public CustomerPayment approvePayment(Long id) {
        CustomerPayment payment = paymentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Payment not found: " + id));
        if (!"PENDING_APPROVAL".equals(payment.getStatus())) return payment;
        payment.setStatus("CONFIRMED");
        CustomerPayment saved = paymentRepository.save(payment);
        applyConfirmedPayment(saved);
        return saved;
    }

    @Transactional
    public CustomerPayment rejectPayment(Long id, String reason) {
        CustomerPayment payment = paymentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Payment not found: " + id));
        if (!"PENDING_APPROVAL".equals(payment.getStatus())) {
            throw new RuntimeException("Only pending payments can be rejected");
        }
        payment.setStatus("REJECTED");
        payment.setRemarks((payment.getRemarks() == null ? "" : payment.getRemarks() + " | ") + "Rejected: " + reason);
        return paymentRepository.save(payment);
    }

    private void applyConfirmedPayment(CustomerPayment payment) {
        if (!ledgerRepository.existsByReferenceTypeAndReferenceIdAndEntryType("PAYMENT", payment.getId(), "PAYMENT")) {
            postLedger(payment.getCustomer(), payment.getProject(), payment.getPaymentDate(), "PAYMENT",
                    "PAYMENT", payment.getId(), payment.getPaymentNumber(),
                    "Payment received" + (payment.getPaymentMethod() == null ? "" : " via " + payment.getPaymentMethod()),
                    BigDecimal.ZERO, payment.getAmount());
        }
        if (payment.getInvoice() != null && payment.getInvoice().getId() != null) {
            recalculateInvoice(payment.getInvoice().getId());
        }
        notifyFinanceUsers("Payment " + payment.getPaymentNumber() + " received",
                "₹" + payment.getAmount() + " from " + payment.getCustomer().getName(),
                "PAYMENT_RECEIVED", "/finance/payments");
    }

    // =====================================================================
    // Credit / Debit notes
    // =====================================================================

    public Page<CreditDebitNote> getNotes(int page, int size) {
        return noteRepository.findAllByOrderByDateDesc(PageRequest.of(page, size));
    }

    @Transactional
    public CreditDebitNote addNote(CreditDebitNote note) {
        if (note.getCustomer() == null || note.getCustomer().getId() == null) {
            throw new RuntimeException("Note needs a customer");
        }
        if (!"CREDIT".equals(note.getType()) && !"DEBIT".equals(note.getType())) {
            throw new RuntimeException("Note type must be CREDIT or DEBIT");
        }
        note.setId(null);
        if (note.getDate() == null) note.setDate(LocalDate.now());
        note.setStatus("ACTIVE");
        if (note.getNoteNumber() == null || note.getNoteNumber().isBlank()) {
            String prefix = "CREDIT".equals(note.getType()) ? "CN-" : "DN-";
            note.setNoteNumber(nextNumber(prefix, noteRepository.findTopByOrderByIdDesc().map(CreditDebitNote::getId)));
        }
        CreditDebitNote saved = noteRepository.save(note);
        boolean isCredit = "CREDIT".equals(saved.getType());
        postLedger(saved.getCustomer(), saved.getProject(), saved.getDate(),
                isCredit ? "CREDIT_NOTE" : "DEBIT_NOTE", "NOTE", saved.getId(), saved.getNoteNumber(),
                (saved.getReason() == null ? (isCredit ? "Credit note" : "Debit note") : saved.getReason()),
                isCredit ? BigDecimal.ZERO : saved.getAmount(),
                isCredit ? saved.getAmount() : BigDecimal.ZERO);
        if (saved.getInvoice() != null && saved.getInvoice().getId() != null) {
            recalculateInvoice(saved.getInvoice().getId());
        }
        return saved;
    }

    @Transactional
    public CreditDebitNote cancelNote(Long id) {
        CreditDebitNote note = noteRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Note not found: " + id));
        if (!"ACTIVE".equals(note.getStatus())) return note;
        note.setStatus("CANCELLED");
        CreditDebitNote saved = noteRepository.save(note);
        boolean isCredit = "CREDIT".equals(saved.getType());
        if (!ledgerRepository.existsByReferenceTypeAndReferenceIdAndEntryType("NOTE", id, "REVERSAL")) {
            postLedger(saved.getCustomer(), saved.getProject(), LocalDate.now(), "REVERSAL", "NOTE", id,
                    saved.getNoteNumber(), "Note " + saved.getNoteNumber() + " cancelled",
                    isCredit ? saved.getAmount() : BigDecimal.ZERO,
                    isCredit ? BigDecimal.ZERO : saved.getAmount());
        }
        if (saved.getInvoice() != null && saved.getInvoice().getId() != null) {
            recalculateInvoice(saved.getInvoice().getId());
        }
        return saved;
    }

    // =====================================================================
    // Refunds
    // =====================================================================

    public Page<Refund> getRefunds(int page, int size) {
        return refundRepository.findByIsDeletedFalseOrderByIdDesc(PageRequest.of(page, size));
    }

    @Transactional
    public Refund requestRefund(Refund refund, User actingUser) {
        if (refund.getCustomer() == null || refund.getCustomer().getId() == null) {
            throw new RuntimeException("Refund needs a customer");
        }
        if (refund.getAmount() == null || refund.getAmount().signum() <= 0) {
            throw new RuntimeException("Refund amount must be positive");
        }
        refund.setId(null);
        refund.setStatus("PENDING");
        refund.setRequestedBy(actingUser);
        refund.setRefundNumber(nextNumber("REF-", refundRepository.findTopByOrderByIdDesc().map(Refund::getId)));
        return refundRepository.save(refund);
    }

    @Transactional
    public Refund decideRefund(Long id, boolean approve, User actingUser) {
        Refund refund = refundRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Refund not found: " + id));
        if (!"PENDING".equals(refund.getStatus())) {
            throw new RuntimeException("Refund already decided");
        }
        refund.setStatus(approve ? "APPROVED" : "REJECTED");
        refund.setApprovedBy(actingUser);
        refund.setDecidedAt(LocalDateTime.now());
        Refund saved = refundRepository.save(refund);
        if (approve) {
            notifyFinanceUsers("Refund " + saved.getRefundNumber() + " approved",
                    "₹" + saved.getAmount() + " to " + saved.getCustomer().getName(),
                    "REFUND_APPROVED", "/finance/payments");
        }
        return saved;
    }

    @Transactional
    public Refund markRefundPaid(Long id, String paymentMethod, String referenceNumber) {
        Refund refund = refundRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Refund not found: " + id));
        if (!"APPROVED".equals(refund.getStatus())) {
            throw new RuntimeException("Refund must be approved before payout");
        }
        refund.setStatus("PAID");
        refund.setRefundDate(LocalDate.now());
        refund.setPaymentMethod(paymentMethod);
        refund.setReferenceNumber(referenceNumber);
        Refund saved = refundRepository.save(refund);
        if (!ledgerRepository.existsByReferenceTypeAndReferenceIdAndEntryType("REFUND", id, "REFUND")) {
            postLedger(saved.getCustomer(), saved.getProject(), saved.getRefundDate(), "REFUND", "REFUND", id,
                    saved.getRefundNumber(), "Refund paid" + (saved.getReason() == null ? "" : ": " + saved.getReason()),
                    saved.getAmount(), BigDecimal.ZERO);
        }
        return saved;
    }

    // =====================================================================
    // Payment schedules
    // =====================================================================

    public List<PaymentSchedule> getSchedulesForProject(Long projectId) {
        return scheduleRepository.findByProjectIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(projectId);
    }

    @Transactional
    public PaymentSchedule saveSchedule(PaymentSchedule schedule) {
        if (schedule.getProject() == null || schedule.getProject().getId() == null) {
            throw new RuntimeException("Schedule needs a project");
        }
        return scheduleRepository.save(schedule);
    }

    @Transactional
    public void deleteSchedule(Long id) {
        scheduleRepository.findById(id).ifPresent(s -> {
            if (s.getInvoice() != null) {
                throw new RuntimeException("Stage already invoiced; cancel the invoice first");
            }
            s.setIsDeleted(true);
            s.setDeletedAt(LocalDateTime.now());
            scheduleRepository.save(s);
        });
    }

    /** Seeds the standard 8-stage plan proportioned over the project's quotation value (or budget). */
    @Transactional
    public List<PaymentSchedule> generateDefaultSchedule(Long projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found: " + projectId));
        List<PaymentSchedule> existing = getSchedulesForProject(projectId);
        if (!existing.isEmpty()) return existing;

        BigDecimal base = project.getQuotation() != null && project.getQuotation().getGrandTotal() != null
                ? project.getQuotation().getGrandTotal()
                : project.getBudget();
        if (base == null || base.signum() <= 0) {
            throw new RuntimeException("Project has no quotation value or budget to build a schedule from");
        }
        String[][] stages = {
                {"QUOTATION_ADVANCE", "20"}, {"DESIGN_APPROVAL", "10"}, {"MATERIAL_PURCHASE", "25"},
                {"WORK_STARTED", "15"}, {"COMPLETION_50", "10"}, {"COMPLETION_75", "10"},
                {"PROJECT_COMPLETION", "8"}, {"FINAL_SETTLEMENT", "2"}
        };
        List<PaymentSchedule> created = new ArrayList<>();
        int order = 0;
        for (String[] s : stages) {
            PaymentSchedule ps = new PaymentSchedule();
            ps.setProject(project);
            ps.setStage(s[0]);
            ps.setPercentage(new BigDecimal(s[1]));
            ps.setAmount(base.multiply(new BigDecimal(s[1])).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP));
            ps.setSortOrder(order++);
            created.add(scheduleRepository.save(ps));
        }
        return created;
    }

    // =====================================================================
    // Ledger & outstanding
    // =====================================================================

    private void postLedger(Customer customer, Project project, LocalDate date, String entryType,
                            String referenceType, Long referenceId, String referenceNumber,
                            String description, BigDecimal debit, BigDecimal credit) {
        CustomerLedgerEntry entry = new CustomerLedgerEntry();
        entry.setCustomer(customer);
        entry.setProject(project);
        entry.setEntryDate(date != null ? date : LocalDate.now());
        entry.setEntryType(entryType);
        entry.setReferenceType(referenceType);
        entry.setReferenceId(referenceId);
        entry.setReferenceNumber(referenceNumber);
        entry.setDescription(description);
        entry.setDebit(debit);
        entry.setCredit(credit);
        ledgerRepository.save(entry);
    }

    private void postInvoiceToLedger(Invoice invoice) {
        if (ledgerRepository.existsByReferenceTypeAndReferenceIdAndEntryType("INVOICE", invoice.getId(), "INVOICE")) {
            return;
        }
        postLedger(invoice.getCustomer(), invoice.getProject(), invoice.getDate(), "INVOICE", "INVOICE",
                invoice.getId(), invoice.getInvoiceNumber(),
                invoice.getInvoiceType() + " invoice " + invoice.getInvoiceNumber(),
                invoice.getTotalAmount(), BigDecimal.ZERO);
    }

    /** Full statement: opening balance, dated entries with running balance, closing balance. */
    public Map<String, Object> getCustomerLedger(Long customerId, LocalDate from, LocalDate to) {
        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new RuntimeException("Customer not found: " + customerId));
        BigDecimal opening = customer.getOpeningBalance() == null ? BigDecimal.ZERO : customer.getOpeningBalance();

        List<CustomerLedgerEntry> entries;
        if (from != null) {
            opening = opening.add(ledgerRepository.netBalanceBefore(customerId, from));
            entries = ledgerRepository.findByCustomerIdAndEntryDateBetweenAndIsDeletedFalseOrderByEntryDateAscIdAsc(
                    customerId, from, to != null ? to : LocalDate.now().plusYears(100));
        } else {
            entries = ledgerRepository.findByCustomerIdAndIsDeletedFalseOrderByEntryDateAscIdAsc(customerId);
            if (to != null) {
                entries = entries.stream().filter(e -> !e.getEntryDate().isAfter(to)).toList();
            }
        }

        BigDecimal running = opening;
        List<Map<String, Object>> rows = new ArrayList<>();
        BigDecimal totalDebit = BigDecimal.ZERO, totalCredit = BigDecimal.ZERO;
        for (CustomerLedgerEntry e : entries) {
            running = running.add(e.getDebit()).subtract(e.getCredit());
            totalDebit = totalDebit.add(e.getDebit());
            totalCredit = totalCredit.add(e.getCredit());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", e.getId());
            row.put("date", e.getEntryDate());
            row.put("type", e.getEntryType());
            row.put("referenceType", e.getReferenceType());
            row.put("referenceId", e.getReferenceId());
            row.put("referenceNumber", e.getReferenceNumber());
            row.put("description", e.getDescription());
            row.put("debit", e.getDebit());
            row.put("credit", e.getCredit());
            row.put("balance", running);
            rows.add(row);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("customerId", customerId);
        result.put("customerName", customer.getName());
        result.put("openingBalance", opening);
        result.put("entries", rows);
        result.put("totalDebit", totalDebit);
        result.put("totalCredit", totalCredit);
        result.put("closingBalance", running);
        return result;
    }

    /** Outstanding position for one customer: total due, overdue, upcoming, last payment. */
    public Map<String, Object> getCustomerOutstanding(Long customerId) {
        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new RuntimeException("Customer not found: " + customerId));
        BigDecimal opening = customer.getOpeningBalance() == null ? BigDecimal.ZERO : customer.getOpeningBalance();
        BigDecimal outstanding = opening.add(ledgerRepository.netBalance(customerId));

        LocalDate today = LocalDate.now();
        BigDecimal overdue = BigDecimal.ZERO, upcoming = BigDecimal.ZERO;
        for (Invoice i : invoiceRepository.findByCustomerId(customerId)) {
            if (Boolean.TRUE.equals(i.getIsDeleted()) || !OPEN_INVOICE_STATUSES.contains(i.getStatus())) continue;
            BigDecimal due = i.getBalanceDue() == null ? BigDecimal.ZERO : i.getBalanceDue();
            if (i.getDueDate() != null && i.getDueDate().isBefore(today)) overdue = overdue.add(due);
            else upcoming = upcoming.add(due);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("customerId", customerId);
        result.put("customerName", customer.getName());
        result.put("totalOutstanding", outstanding);
        result.put("overdueAmount", overdue);
        result.put("upcomingDue", upcoming);
        result.put("lastPaymentDate", paymentRepository.lastPaymentDateForCustomer(customerId));
        result.put("creditLimit", customer.getCreditLimit());
        result.put("openingBalance", opening);
        return result;
    }

    /** Outstanding list across customers with anything open (for the outstanding screen). */
    public List<Map<String, Object>> getAllOutstanding() {
        Map<Long, Map<String, Object>> byCustomer = new LinkedHashMap<>();
        LocalDate today = LocalDate.now();
        for (Invoice i : invoiceRepository.findByStatusInAndIsDeletedFalse(OPEN_INVOICE_STATUSES)) {
            Customer c = i.getCustomer();
            Map<String, Object> row = byCustomer.computeIfAbsent(c.getId(), k -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("customerId", c.getId());
                m.put("customerName", c.getName());
                m.put("phone", c.getPhone());
                m.put("totalOutstanding", BigDecimal.ZERO);
                m.put("overdueAmount", BigDecimal.ZERO);
                m.put("openInvoices", 0);
                m.put("creditLimit", c.getCreditLimit());
                m.put("lastPaymentDate", paymentRepository.lastPaymentDateForCustomer(c.getId()));
                return m;
            });
            BigDecimal due = i.getBalanceDue() == null ? BigDecimal.ZERO : i.getBalanceDue();
            row.put("totalOutstanding", ((BigDecimal) row.get("totalOutstanding")).add(due));
            if (i.getDueDate() != null && i.getDueDate().isBefore(today)) {
                row.put("overdueAmount", ((BigDecimal) row.get("overdueAmount")).add(due));
            }
            row.put("openInvoices", ((Integer) row.get("openInvoices")) + 1);
        }
        return new ArrayList<>(byCustomer.values());
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    private String emptyToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }

    void notifyFinanceUsers(String title, String message, String type, String actionUrl) {
        notifyFinanceUsers(title, message, type, actionUrl, false);
    }

    /** Deduped variant for the daily reminder sweep — skips a recipient who already has this unread. */
    void notifyFinanceUsersDeduped(String title, String message, String type, String actionUrl) {
        notifyFinanceUsers(title, message, type, actionUrl, true);
    }

    private void notifyFinanceUsers(String title, String message, String type, String actionUrl, boolean deduped) {
        try {
            List<User> recipients = userRepository.findByRoleNames(
                    List.of("ROLE_ADMIN", "ROLE_MANAGER", "ROLE_ACCOUNTS", "ROLE_FINANCE_MANAGER"));
            for (User u : recipients) {
                if (deduped) {
                    notificationService.dispatchIfAbsent(title, message, type, u.getId(), actionUrl);
                } else {
                    notificationService.dispatch(title, message, type, u.getId(), actionUrl);
                }
            }
        } catch (Exception ignored) {
            // notifications must never break a financial transaction
        }
    }
}
