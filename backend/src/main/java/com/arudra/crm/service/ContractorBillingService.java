package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Contractor billing and payment.
 *
 * <p>Bill math: gross (measured work) − material recovery − advance adjustment − penalty
 * − other deductions = taxable; taxable + GST − TDS − retention = net payable.
 *
 * <p>Approval ladder: Site Engineer → Project Manager → Finance. No payment may be recorded
 * before the Finance rung clears, and issued bills are immutable once submitted.
 */
@Service
public class ContractorBillingService {

    /** The approval ladder, in order. */
    private static final List<String> APPROVAL_STAGES = List.of("SITE_ENGINEER", "PROJECT_MANAGER", "FINANCE");

    /** Bill status reached after each stage clears. */
    private static final Map<String, String> STAGE_RESULT = Map.of(
            "SITE_ENGINEER", "ENGINEER_APPROVED",
            "PROJECT_MANAGER", "PM_APPROVED",
            "FINANCE", "FINANCE_APPROVED");

    static final List<String> FINANCE_ALERT_ROLES =
            List.of("ROLE_ADMIN", "ROLE_MANAGER", "ROLE_ACCOUNTS", "ROLE_FINANCE_MANAGER");

    @Autowired private ContractorBillRepository billRepository;
    @Autowired private ContractorBillItemRepository billItemRepository;
    @Autowired private ContractorBillApprovalRepository approvalRepository;
    @Autowired private ContractorPaymentRepository paymentRepository;
    @Autowired private ContractorRepository contractorRepository;
    @Autowired private ContractorWorkPackageRepository packageRepository;
    @Autowired private WorkPackageItemRepository workPackageItemRepository;
    @Autowired private ContractorMaterialIssueRepository materialIssueRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private NotificationService notificationService;
    @Autowired private ContractorLedgerService ledgerService;
    @Autowired private WorkPackageService workPackageService;
    @Autowired private ProjectFinanceService projectFinanceService;

    // =====================================================================
    // Queries
    // =====================================================================

    public Page<ContractorBill> searchBills(Long contractorId, Long projectId, Long workPackageId,
                                            String status, String billType, LocalDate from, LocalDate to,
                                            int page, int size) {
        return billRepository.search(contractorId, projectId, workPackageId,
                blankToNull(status), blankToNull(billType), from, to,
                PageRequest.of(page, size, Sort.by("id").descending()));
    }

    public ContractorBill getBill(Long id) {
        return billRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Contractor bill not found: " + id));
    }

    public Map<String, Object> getBillDetail(Long id) {
        ContractorBill bill = getBill(id);
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("bill", bill);
        detail.put("items", billItemRepository.findByBillIdOrderByIdAsc(id));
        detail.put("approvals", approvalRepository.findByBillIdOrderBySequenceAsc(id));
        detail.put("payments", paymentRepository.findByBillIdOrderByIdAsc(id));
        return detail;
    }

    public List<ContractorBill> getPendingApproval() {
        return billRepository.findPendingApproval();
    }

    public List<ContractorBill> getPayable() {
        return billRepository.findPayable();
    }

    // =====================================================================
    // Draft a bill from measured work
    // =====================================================================

    /**
     * Pre-fills a running bill from the package's executed quantities minus what earlier bills
     * already covered, and pulls in the material recovery and unadjusted advances. Nothing is
     * persisted — the site engineer reviews the numbers before submitting.
     */
    public Map<String, Object> prepareBill(Long workPackageId, Long contractorId, String billType) {
        ContractorWorkPackage wp = workPackageService.getWorkPackage(workPackageId);
        Contractor contractor = contractorRepository.findById(contractorId)
                .orElseThrow(() -> new IllegalArgumentException("Contractor not found: " + contractorId));

        List<Map<String, Object>> lines = new ArrayList<>();
        BigDecimal gross = BigDecimal.ZERO;
        for (WorkPackageItem item : workPackageItemRepository.findByWorkPackageIdOrderByIdAsc(workPackageId)) {
            BigDecimal alreadyBilled = nz(billRepository.sumBilledQuantityForItem(item.getId()));
            BigDecimal billable = nz(item.getCompletedQuantity()).subtract(alreadyBilled);
            if (billable.signum() <= 0) continue;

            BigDecimal amount = billable.multiply(nz(item.getRate())).setScale(2, RoundingMode.HALF_UP);
            gross = gross.add(amount);

            Map<String, Object> line = new LinkedHashMap<>();
            line.put("workPackageItemId", item.getId());
            line.put("description", item.getItemName());
            line.put("unit", item.getUnit());
            line.put("quantity", billable);
            line.put("previouslyBilledQuantity", alreadyBilled);
            line.put("rate", item.getRate());
            line.put("amount", amount);
            lines.add(line);
        }

        // Lump-sum packages have no measurable lines — bill against the completion percentage.
        if (lines.isEmpty() && nz(wp.getApprovedCost()).signum() > 0) {
            BigDecimal earned = nz(wp.getApprovedCost())
                    .multiply(BigDecimal.valueOf(wp.getCompletionPercentage() == null ? 0 : wp.getCompletionPercentage()))
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            BigDecimal billedSoFar = nz(billRepository.sumNetByWorkPackage(workPackageId));
            BigDecimal balance = earned.subtract(billedSoFar);
            if (balance.signum() > 0) {
                gross = balance;
                Map<String, Object> line = new LinkedHashMap<>();
                line.put("description", wp.getPackageName() + " — "
                        + wp.getCompletionPercentage() + "% of contract value");
                line.put("quantity", BigDecimal.ONE);
                line.put("rate", balance);
                line.put("amount", balance);
                lines.add(line);
            }
        }

        BigDecimal materialRecovery = nz(materialIssueRepository.sumRecoverableByWorkPackage(workPackageId));
        BigDecimal advancesPaid = nz(paymentRepository.sumAdvancesByContractor(contractorId));
        BigDecimal advancesAdjusted = billRepository.findByContractorIdOrderByIdDesc(contractorId).stream()
                .filter(b -> !"REJECTED".equals(b.getStatus()) && !"CANCELLED".equals(b.getStatus()))
                .map(b -> nz(b.getAdvanceAdjustment()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal unadjustedAdvance = advancesPaid.subtract(advancesAdjusted).max(BigDecimal.ZERO);

        BigDecimal retentionPct = wp.getRetentionPercentage() != null ? wp.getRetentionPercentage()
                : (contractor.getRetentionPercentage() != null ? contractor.getRetentionPercentage() : BigDecimal.ZERO);

        Map<String, Object> draft = new LinkedHashMap<>();
        draft.put("workPackageId", workPackageId);
        draft.put("workPackageCode", wp.getPackageCode());
        draft.put("contractorId", contractorId);
        draft.put("contractorName", contractor.getName());
        draft.put("projectId", wp.getProject().getId());
        draft.put("billType", billType != null ? billType : "RUNNING");
        draft.put("workCompletedPercentage", wp.getCompletionPercentage());
        draft.put("items", lines);
        draft.put("grossAmount", gross);
        draft.put("materialDeduction", materialRecovery);
        // On a final bill the whole outstanding advance is recovered; running bills leave it to the user.
        draft.put("advanceAdjustment", "FINAL".equals(billType) ? unadjustedAdvance : BigDecimal.ZERO);
        draft.put("unadjustedAdvance", unadjustedAdvance);
        draft.put("retentionPercentage", retentionPct);
        draft.put("gstPercentage", contractor.getGstin() != null ? BigDecimal.valueOf(18) : BigDecimal.ZERO);
        draft.put("tdsPercentage", contractor.getTdsPercentage());
        return draft;
    }

    @Transactional
    public ContractorBill createBill(ContractorBill payload, Long contractorId, Long workPackageId,
                                     List<ContractorBillItem> items, User currentUser) {
        Contractor contractor = contractorRepository.findById(contractorId)
                .orElseThrow(() -> new IllegalArgumentException("Contractor not found: " + contractorId));
        ContractorWorkPackage wp = workPackageId == null ? null : workPackageService.getWorkPackage(workPackageId);
        if (wp == null && payload.getProject() == null) {
            throw new IllegalArgumentException(
                    "A contractor bill must be raised against a work package (or at least a project).");
        }

        ContractorBill bill = new ContractorBill();
        bill.setContractor(contractor);
        bill.setWorkPackage(wp);
        bill.setProject(wp != null ? wp.getProject() : payload.getProject());
        applyBillFields(bill, payload, contractor, wp);
        bill.setStatus("DRAFT");
        bill.setSubmittedBy(currentUser);
        bill = billRepository.save(bill);
        bill.setBillNumber(String.format("CB-%06d", bill.getId()));
        bill = billRepository.save(bill);

        if (items != null) {
            for (ContractorBillItem line : items) {
                saveBillItem(bill, line);
            }
        }
        return recalculate(bill);
    }

    @Transactional
    public ContractorBill updateBill(Long id, ContractorBill payload, List<ContractorBillItem> items) {
        ContractorBill bill = getBill(id);
        if (!"DRAFT".equals(bill.getStatus())) {
            throw new IllegalStateException("Only a DRAFT bill can be edited — bill " + bill.getBillNumber()
                    + " is " + bill.getStatus() + ".");
        }
        applyBillFields(bill, payload, bill.getContractor(), bill.getWorkPackage());
        if (items != null) {
            billItemRepository.deleteAll(billItemRepository.findByBillIdOrderByIdAsc(id));
            for (ContractorBillItem line : items) {
                saveBillItem(bill, line);
            }
        }
        return recalculate(bill);
    }

    private void applyBillFields(ContractorBill bill, ContractorBill payload, Contractor contractor,
                                 ContractorWorkPackage wp) {
        if (payload.getBillType() != null) bill.setBillType(payload.getBillType());
        bill.setBillDate(payload.getBillDate() != null ? payload.getBillDate() : LocalDate.now());
        bill.setPeriodFrom(payload.getPeriodFrom());
        bill.setPeriodTo(payload.getPeriodTo());
        bill.setContractorInvoiceNumber(payload.getContractorInvoiceNumber());
        bill.setWorkCompletedPercentage(payload.getWorkCompletedPercentage() != null
                ? payload.getWorkCompletedPercentage()
                : (wp == null ? null : wp.getCompletionPercentage()));
        bill.setGrossAmount(nz(payload.getGrossAmount()));
        bill.setMaterialDeduction(nz(payload.getMaterialDeduction()));
        bill.setAdvanceAdjustment(nz(payload.getAdvanceAdjustment()));
        bill.setPenaltyAmount(nz(payload.getPenaltyAmount()));
        bill.setOtherDeduction(nz(payload.getOtherDeduction()));
        bill.setRetentionPercentage(payload.getRetentionPercentage() != null ? payload.getRetentionPercentage()
                : (wp != null && wp.getRetentionPercentage() != null ? wp.getRetentionPercentage()
                        : contractor.getRetentionPercentage()));
        bill.setGstPercentage(payload.getGstPercentage());
        bill.setTdsPercentage(payload.getTdsPercentage() != null ? payload.getTdsPercentage()
                : contractor.getTdsPercentage());
        bill.setMeasurementNotes(payload.getMeasurementNotes());
        bill.setRemarks(payload.getRemarks());
        bill.setAttachmentUrl(payload.getAttachmentUrl());
    }

    private void saveBillItem(ContractorBill bill, ContractorBillItem line) {
        ContractorBillItem item = new ContractorBillItem();
        item.setBill(bill);
        if (line.getWorkPackageItem() != null && line.getWorkPackageItem().getId() != null) {
            item.setWorkPackageItem(workPackageItemRepository.findById(line.getWorkPackageItem().getId()).orElse(null));
        }
        item.setDescription(line.getDescription());
        item.setUnit(line.getUnit());
        item.setQuantity(nz(line.getQuantity()));
        item.setPreviouslyBilledQuantity(nz(line.getPreviouslyBilledQuantity()));
        item.setRate(nz(line.getRate()));
        // amount defaults to ZERO on the entity, so an omitted amount arrives as zero, not null —
        // treat zero as "not supplied" and derive it from quantity x rate.
        item.setAmount(nz(line.getAmount()).signum() > 0 ? line.getAmount()
                : item.getQuantity().multiply(item.getRate()).setScale(2, RoundingMode.HALF_UP));
        item.setMeasurementDetails(line.getMeasurementDetails());
        billItemRepository.save(item);
    }

    /**
     * Recomputes the whole money column. Retention is taken on the taxable base (not on GST),
     * and TDS is deducted on the taxable base too — the standard Indian sub-contract treatment.
     */
    @Transactional
    public ContractorBill recalculate(ContractorBill bill) {
        List<ContractorBillItem> items = billItemRepository.findByBillIdOrderByIdAsc(bill.getId());
        if (!items.isEmpty()) {
            BigDecimal gross = items.stream().map(ContractorBillItem::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            bill.setGrossAmount(gross.setScale(2, RoundingMode.HALF_UP));
        }

        BigDecimal deductions = nz(bill.getMaterialDeduction())
                .add(nz(bill.getAdvanceAdjustment()))
                .add(nz(bill.getPenaltyAmount()))
                .add(nz(bill.getOtherDeduction()));
        BigDecimal taxable = nz(bill.getGrossAmount()).subtract(deductions).max(BigDecimal.ZERO);
        bill.setTaxableAmount(taxable.setScale(2, RoundingMode.HALF_UP));

        BigDecimal gst = pct(taxable, bill.getGstPercentage());
        BigDecimal tds = pct(taxable, bill.getTdsPercentage());
        BigDecimal retention = pct(taxable, bill.getRetentionPercentage());
        bill.setGstAmount(gst);
        bill.setTdsAmount(tds);
        bill.setRetentionAmount(retention);

        BigDecimal net = taxable.add(gst).subtract(tds).subtract(retention).max(BigDecimal.ZERO);
        bill.setNetAmount(net.setScale(2, RoundingMode.HALF_UP));
        bill.setBalanceAmount(bill.getNetAmount().subtract(nz(bill.getPaidAmount())).max(BigDecimal.ZERO));
        return billRepository.save(bill);
    }

    // =====================================================================
    // Approval chain
    // =====================================================================

    /** Submits the bill and opens the three approval rungs so the pending desk is queryable. */
    @Transactional
    public ContractorBill submitBill(Long id, User currentUser) {
        ContractorBill bill = getBill(id);
        if (!"DRAFT".equals(bill.getStatus()) && !"REJECTED".equals(bill.getStatus())) {
            throw new IllegalStateException("Bill " + bill.getBillNumber() + " is already " + bill.getStatus() + ".");
        }
        if (nz(bill.getNetAmount()).signum() <= 0) {
            throw new IllegalStateException("Bill " + bill.getBillNumber() + " has no net payable amount.");
        }
        ContractorWorkPackage wp = bill.getWorkPackage();
        if (wp != null && "FINAL".equals(bill.getBillType())
                && !"APPROVED".equals(wp.getQualityStatus()) && !"PASS".equals(wp.getQualityStatus())) {
            throw new IllegalStateException(
                    "A final bill needs a passed quality inspection on " + wp.getPackageCode() + " first.");
        }

        approvalRepository.deleteAll(approvalRepository.findByBillIdOrderBySequenceAsc(id));
        for (int i = 0; i < APPROVAL_STAGES.size(); i++) {
            ContractorBillApproval approval = new ContractorBillApproval();
            approval.setBill(bill);
            approval.setStage(APPROVAL_STAGES.get(i));
            approval.setSequence(i + 1);
            approval.setStatus("PENDING");
            approvalRepository.save(approval);
        }

        bill.setStatus("SUBMITTED");
        bill.setCurrentApprovalStage(APPROVAL_STAGES.get(0));
        bill.setSubmittedBy(currentUser);
        bill.setSubmittedAt(LocalDateTime.now());
        bill = billRepository.save(bill);

        workPackageService.notifyManagers("Contractor bill submitted",
                bill.getBillNumber() + " from " + bill.getContractor().getName()
                        + " for " + bill.getNetAmount() + " awaits site engineer approval.",
                "/contractors/bills/" + bill.getId());
        return bill;
    }

    /**
     * Approves the current rung. When the Finance rung clears, the bill is posted to the
     * contractor ledger and the work package's billed total is refreshed.
     */
    @Transactional
    public ContractorBill approveBill(Long id, String comments, BigDecimal approvedAmount, User currentUser) {
        ContractorBill bill = getBill(id);
        String billNumber = bill.getBillNumber();
        ContractorBillApproval pending = approvalRepository
                .findFirstByBillIdAndStatusOrderBySequenceAsc(id, "PENDING")
                .orElseThrow(() -> new IllegalStateException(
                        "Bill " + billNumber + " has no pending approval stage."));

        pending.setStatus("APPROVED");
        pending.setApprover(currentUser);
        pending.setActedAt(LocalDateTime.now());
        pending.setComments(comments);
        pending.setApprovedAmount(approvedAmount);
        approvalRepository.save(pending);

        // An approver may certify less than claimed; the reduction rides as an "other deduction"
        // so the audit trail keeps the original claim intact.
        if (approvedAmount != null && approvedAmount.compareTo(nz(bill.getNetAmount())) < 0) {
            BigDecimal reduction = nz(bill.getNetAmount()).subtract(approvedAmount);
            bill.setOtherDeduction(nz(bill.getOtherDeduction()).add(reduction));
            bill = recalculate(bill);
        }

        bill.setStatus(STAGE_RESULT.get(pending.getStage()));
        java.util.Optional<ContractorBillApproval> next =
                approvalRepository.findFirstByBillIdAndStatusOrderBySequenceAsc(id, "PENDING");
        bill.setCurrentApprovalStage(next.map(ContractorBillApproval::getStage).orElse(null));
        bill = billRepository.save(bill);

        if (next.isEmpty()) {
            ledgerService.postBill(bill);
            if (bill.getWorkPackage() != null) {
                workPackageService.recomputeFinancials(bill.getWorkPackage().getId());
            }
            syncProjectExpenses(bill);
            notifyFinance("Contractor bill approved for payment",
                    bill.getBillNumber() + " (" + bill.getContractor().getName() + ") is cleared for "
                            + bill.getNetAmount() + ".",
                    "/contractors/bills/" + bill.getId());
        } else {
            workPackageService.notifyManagers("Contractor bill awaiting " + next.get().getStage(),
                    bill.getBillNumber() + " cleared " + pending.getStage() + ".",
                    "/contractors/bills/" + bill.getId());
        }
        return bill;
    }

    @Transactional
    public ContractorBill rejectBill(Long id, String reason, User currentUser) {
        final ContractorBill bill = getBill(id);
        approvalRepository.findFirstByBillIdAndStatusOrderBySequenceAsc(id, "PENDING").ifPresent(pending -> {
            pending.setStatus("REJECTED");
            pending.setApprover(currentUser);
            pending.setActedAt(LocalDateTime.now());
            pending.setComments(reason);
            approvalRepository.save(pending);
        });
        bill.setStatus("REJECTED");
        bill.setCurrentApprovalStage(null);
        bill.setRemarks(reason);
        ContractorBill saved = billRepository.save(bill);
        workPackageService.notifyContractor(saved.getContractor(), "Bill rejected",
                saved.getBillNumber() + " was rejected" + (reason != null ? ": " + reason : "."),
                "/contractor-portal/bills");
        return saved;
    }

    @Transactional
    public ContractorBill cancelBill(Long id, String reason) {
        ContractorBill bill = getBill(id);
        if (nz(bill.getPaidAmount()).signum() > 0) {
            throw new IllegalStateException("Bill " + bill.getBillNumber()
                    + " already carries payments and cannot be cancelled.");
        }
        bill.setStatus("CANCELLED");
        bill.setRemarks(reason);
        return billRepository.save(bill);
    }

    // =====================================================================
    // Payments
    // =====================================================================

    public List<ContractorPayment> getPaymentsForContractor(Long contractorId) {
        return paymentRepository.findByContractorIdOrderByPaymentDateDesc(contractorId);
    }

    /** All bills (payment requests) for a contractor, newest first — surfaced by the HR finance view. */
    public List<ContractorBill> getBillsForContractor(Long contractorId) {
        return billRepository.findByContractorIdOrderByIdDesc(contractorId);
    }

    public List<ContractorPayment> getPaymentsByStatus(String status) {
        return paymentRepository.findByStatusOrderByIdDesc(status);
    }

    /**
     * Records a payment. Advances stand alone; everything else must settle a bill that has
     * cleared Finance approval, and can never exceed that bill's remaining balance.
     */
    @Transactional
    public ContractorPayment recordPayment(Long contractorId, Long billId, ContractorPayment payload, User currentUser) {
        Contractor contractor = contractorRepository.findById(contractorId)
                .orElseThrow(() -> new IllegalArgumentException("Contractor not found: " + contractorId));
        String type = payload.getPaymentType() != null ? payload.getPaymentType() : "RUNNING_BILL";
        BigDecimal amount = nz(payload.getAmount());
        if (amount.signum() <= 0) {
            throw new IllegalArgumentException("Payment amount must be greater than zero.");
        }

        ContractorBill bill = null;
        if (!"ADVANCE".equals(type) && !"RETENTION_RELEASE".equals(type)) {
            if (billId == null) {
                throw new IllegalArgumentException("A " + type + " payment must reference a contractor bill.");
            }
            bill = getBill(billId);
            if (!"FINANCE_APPROVED".equals(bill.getStatus()) && !"PARTIALLY_PAID".equals(bill.getStatus())) {
                throw new IllegalStateException("Bill " + bill.getBillNumber() + " is " + bill.getStatus()
                        + " — it must clear finance approval before payment.");
            }
            if (amount.compareTo(nz(bill.getBalanceAmount())) > 0) {
                throw new IllegalArgumentException("Payment of " + amount + " exceeds the bill's outstanding balance of "
                        + bill.getBalanceAmount() + ".");
            }
        } else if (billId != null) {
            bill = getBill(billId);
        }

        ContractorPayment payment = new ContractorPayment();
        payment.setContractor(contractor);
        payment.setBill(bill);
        payment.setWorkPackage(bill != null ? bill.getWorkPackage()
                : (payload.getWorkPackage() != null && payload.getWorkPackage().getId() != null
                        ? packageRepository.findById(payload.getWorkPackage().getId()).orElse(null) : null));
        payment.setProject(bill != null ? bill.getProject() : payload.getProject());
        payment.setAmount(amount);
        payment.setPaymentDate(payload.getPaymentDate() != null ? payload.getPaymentDate() : LocalDate.now());
        payment.setPaymentType(type);
        payment.setPaymentMode(payload.getPaymentMode());
        payment.setReferenceNumber(payload.getReferenceNumber());
        payment.setTransactionReference(payload.getTransactionReference());
        payment.setTdsAmount(nz(payload.getTdsAmount()));
        payment.setInvoiceUrl(payload.getInvoiceUrl());
        payment.setRemarks(payload.getRemarks());
        payment.setStatus("PAID");
        payment.setApprovedBy(currentUser);
        payment.setApprovedAt(LocalDateTime.now());
        payment.setPaidBy(currentUser);
        payment = paymentRepository.save(payment);

        if (payment.getProject() == null && payment.getWorkPackage() != null) {
            payment.setProject(payment.getWorkPackage().getProject());
            payment = paymentRepository.save(payment);
        }

        ledgerService.postPayment(payment);

        if (bill != null && !"ADVANCE".equals(type)) {
            bill.setPaidAmount(nz(bill.getPaidAmount()).add(amount));
            bill.setBalanceAmount(nz(bill.getNetAmount()).subtract(bill.getPaidAmount()).max(BigDecimal.ZERO));
            bill.setStatus(bill.getBalanceAmount().signum() == 0 ? "PAID" : "PARTIALLY_PAID");
            billRepository.save(bill);
        }
        if (payment.getWorkPackage() != null) {
            workPackageService.recomputeFinancials(payment.getWorkPackage().getId());
        }
        syncProjectExpenses(payment.getProject());

        workPackageService.notifyContractor(contractor, "Payment released",
                "Payment of " + amount + " has been released to you"
                        + (bill != null ? " against " + bill.getBillNumber() : "") + ".",
                "/contractor-portal/payments");
        return payment;
    }

    /** Releases retention held on a package's bills once the defect liability period is over. */
    @Transactional
    public ContractorPayment releaseRetention(Long contractorId, Long workPackageId, BigDecimal amount,
                                              String remarks, User currentUser) {
        ContractorWorkPackage wp = workPackageService.getWorkPackage(workPackageId);
        if (!"COMPLETED".equals(wp.getStatus())) {
            throw new IllegalStateException("Retention can only be released once " + wp.getPackageCode()
                    + " is COMPLETED (currently " + wp.getStatus() + ").");
        }
        BigDecimal held = billRepository.findByWorkPackageIdOrderByIdDesc(workPackageId).stream()
                .filter(b -> b.getContractor().getId().equals(contractorId))
                .filter(b -> !"REJECTED".equals(b.getStatus()) && !"CANCELLED".equals(b.getStatus()))
                .map(b -> nz(b.getRetentionAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal alreadyReleased = paymentRepository.findByWorkPackageIdOrderByIdDesc(workPackageId).stream()
                .filter(p -> "RETENTION_RELEASE".equals(p.getPaymentType()) && "PAID".equals(p.getStatus()))
                .map(p -> nz(p.getAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal available = held.subtract(alreadyReleased);
        BigDecimal toRelease = amount != null ? amount : available;
        if (toRelease.signum() <= 0 || toRelease.compareTo(available) > 0) {
            throw new IllegalArgumentException("Retention available for release is " + available + ".");
        }

        ContractorPayment payload = new ContractorPayment();
        payload.setAmount(toRelease);
        payload.setPaymentType("RETENTION_RELEASE");
        payload.setWorkPackage(wp);
        payload.setProject(wp.getProject());
        payload.setRemarks(remarks);
        return recordPayment(contractorId, null, payload, currentUser);
    }

    /** Outstanding position per contractor — powers the dashboard and the outstanding report. */
    public Map<String, Object> getOutstanding(Long contractorId) {
        Contractor contractor = contractorRepository.findById(contractorId)
                .orElseThrow(() -> new IllegalArgumentException("Contractor not found: " + contractorId));
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("contractorId", contractorId);
        summary.put("contractorName", contractor.getName());
        summary.put("billedOutstanding", nz(billRepository.sumOutstandingByContractor(contractorId)));
        summary.put("retentionHeld", nz(billRepository.sumRetentionByContractor(contractorId)));
        summary.put("totalPaid", nz(paymentRepository.sumPaidByContractor(contractorId)));
        summary.put("advancesPaid", nz(paymentRepository.sumAdvancesByContractor(contractorId)));
        summary.put("ledgerBalance", ledgerService.getBalance(contractorId));
        return summary;
    }

    // =====================================================================
    // Integration
    // =====================================================================

    /** Contractor cost is a project expense — refresh the finance rollup, never fatally. */
    private void syncProjectExpenses(ContractorBill bill) {
        syncProjectExpenses(bill == null ? null : bill.getProject());
    }

    private void syncProjectExpenses(Project project) {
        if (project == null) return;
        try {
            projectFinanceService.syncProjectExpenses(project.getId());
        } catch (Exception ignored) {
            // Expense sync is a reporting convenience; never let it fail a billing transaction.
        }
    }

    void notifyFinance(String title, String message, String actionUrl) {
        for (User recipient : userRepository.findByRoleNames(FINANCE_ALERT_ROLES)) {
            notificationService.dispatch(title, message, "CONTRACTOR_BILL", recipient.getId(), actionUrl);
        }
    }

    private static BigDecimal pct(BigDecimal base, BigDecimal percentage) {
        if (percentage == null || percentage.signum() == 0) return BigDecimal.ZERO;
        return base.multiply(percentage).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }
}
