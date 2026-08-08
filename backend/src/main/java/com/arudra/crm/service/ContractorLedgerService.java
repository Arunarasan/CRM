package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.ContractorLedgerEntryRepository;
import com.arudra.crm.repository.ContractorRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Immutable contractor ledger. Every posting is idempotent on
 * (referenceType, referenceId, entryType), so replays and retries can't double-count;
 * corrections are posted as REVERSAL rows rather than edits.
 *
 * <p>Sign convention (a contractor is a payable): CREDIT increases what we owe
 * (bills, retention held), DEBIT reduces it (payments, recoveries, penalties).
 */
@Service
public class ContractorLedgerService {

    @Autowired private ContractorLedgerEntryRepository ledgerRepository;
    @Autowired private ContractorRepository contractorRepository;

    // =====================================================================
    // Reads
    // =====================================================================

    /** Ledger with a running balance computed on read, plus opening/closing summary. */
    public Map<String, Object> getLedger(Long contractorId, LocalDate from, LocalDate to) {
        Contractor contractor = contractorRepository.findById(contractorId)
                .orElseThrow(() -> new IllegalArgumentException("Contractor not found: " + contractorId));

        List<ContractorLedgerEntry> all = ledgerRepository.findByContractorIdOrderByEntryDateAscIdAsc(contractorId);
        BigDecimal opening = nz(contractor.getOpeningBalance());
        BigDecimal running = opening;
        List<Map<String, Object>> rows = new ArrayList<>();

        for (ContractorLedgerEntry entry : all) {
            running = running.add(nz(entry.getCredit())).subtract(nz(entry.getDebit()));
            if (from != null && entry.getEntryDate().isBefore(from)) continue;
            if (to != null && entry.getEntryDate().isAfter(to)) continue;

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", entry.getId());
            row.put("entryDate", entry.getEntryDate());
            row.put("entryType", entry.getEntryType());
            row.put("referenceType", entry.getReferenceType());
            row.put("referenceId", entry.getReferenceId());
            row.put("referenceNumber", entry.getReferenceNumber());
            row.put("description", entry.getDescription());
            row.put("debit", entry.getDebit());
            row.put("credit", entry.getCredit());
            row.put("balance", running);
            row.put("projectName", entry.getProject() == null ? null : entry.getProject().getProjectName());
            rows.add(row);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("contractorId", contractorId);
        result.put("contractorName", contractor.getName());
        result.put("openingBalance", opening);
        result.put("entries", rows);
        result.put("totalCredit", all.stream().map(ContractorLedgerEntry::getCredit).reduce(BigDecimal.ZERO, BigDecimal::add));
        result.put("totalDebit", all.stream().map(ContractorLedgerEntry::getDebit).reduce(BigDecimal.ZERO, BigDecimal::add));
        result.put("closingBalance", running);
        return result;
    }

    /** Net payable to the contractor: opening + credits − debits. */
    public BigDecimal getBalance(Long contractorId) {
        Contractor contractor = contractorRepository.findById(contractorId).orElse(null);
        BigDecimal opening = contractor == null ? BigDecimal.ZERO : nz(contractor.getOpeningBalance());
        return opening.add(nz(ledgerRepository.balanceForContractor(contractorId)));
    }

    // =====================================================================
    // Postings
    // =====================================================================

    @Transactional
    public void postBill(ContractorBill bill) {
        // Payable rises by the net certified amount; retention is posted separately
        // so held money is visible as its own line rather than netted away silently.
        post(bill.getContractor(), bill.getProject(), bill.getWorkPackage(), bill.getBillDate(),
                "BILL", "CONTRACTOR_BILL", bill.getId(), bill.getBillNumber(),
                bill.getBillType() + " bill " + bill.getBillNumber(),
                BigDecimal.ZERO, nz(bill.getNetAmount()));

        if (nz(bill.getRetentionAmount()).signum() > 0) {
            post(bill.getContractor(), bill.getProject(), bill.getWorkPackage(), bill.getBillDate(),
                    "RETENTION_HELD", "CONTRACTOR_BILL", bill.getId(), bill.getBillNumber(),
                    "Retention held on " + bill.getBillNumber(),
                    nz(bill.getRetentionAmount()), BigDecimal.ZERO);
        }
        if (nz(bill.getMaterialDeduction()).signum() > 0) {
            post(bill.getContractor(), bill.getProject(), bill.getWorkPackage(), bill.getBillDate(),
                    "MATERIAL_RECOVERY", "CONTRACTOR_BILL", bill.getId(), bill.getBillNumber(),
                    "Material recovery on " + bill.getBillNumber(),
                    nz(bill.getMaterialDeduction()), BigDecimal.ZERO);
        }
    }

    @Transactional
    public void postPayment(ContractorPayment payment) {
        String entryType = "ADVANCE".equals(payment.getPaymentType()) ? "ADVANCE"
                : "RETENTION_RELEASE".equals(payment.getPaymentType()) ? "RETENTION_RELEASED" : "PAYMENT";
        String description = "RETENTION_RELEASE".equals(payment.getPaymentType())
                ? "Retention released" + refSuffix(payment)
                : ("ADVANCE".equals(payment.getPaymentType()) ? "Advance paid" : "Payment") + refSuffix(payment);

        // A retention release converts held money into cash paid: credit back what was held,
        // then debit the payout, so the two RETENTION lines cancel and the ledger nets to the cash.
        if ("RETENTION_RELEASE".equals(payment.getPaymentType())) {
            post(payment.getContractor(), payment.getProject(), payment.getWorkPackage(),
                    payment.getPaymentDate(), "RETENTION_RELEASED", "CONTRACTOR_PAYMENT", payment.getId(),
                    payment.getReferenceNumber(), description, BigDecimal.ZERO, nz(payment.getAmount()));
        }
        post(payment.getContractor(), payment.getProject(), payment.getWorkPackage(),
                payment.getPaymentDate(), entryType.equals("RETENTION_RELEASED") ? "PAYMENT" : entryType,
                "CONTRACTOR_PAYMENT", payment.getId(), payment.getReferenceNumber(),
                description, nz(payment.getAmount()), BigDecimal.ZERO);
    }

    @Transactional
    public void postPenalty(ContractorSafetyRecord record) {
        post(record.getContractor(), record.getProject(), record.getWorkPackage(), record.getRecordDate(),
                "PENALTY", "SAFETY_RECORD", record.getId(), null,
                "Safety penalty: " + (record.getDescription() == null ? record.getRecordType() : record.getDescription()),
                nz(record.getPenaltyAmount()), BigDecimal.ZERO);
    }

    /** Corrections never edit history — they post an opposite REVERSAL row. */
    @Transactional
    public ContractorLedgerEntry postReversal(Contractor contractor, String referenceType, Long referenceId,
                                              BigDecimal debit, BigDecimal credit, String description) {
        ContractorLedgerEntry entry = new ContractorLedgerEntry();
        entry.setContractor(contractor);
        entry.setEntryDate(LocalDate.now());
        entry.setEntryType("REVERSAL");
        entry.setReferenceType(referenceType);
        entry.setReferenceId(referenceId);
        entry.setDescription(description);
        entry.setDebit(nz(debit));
        entry.setCredit(nz(credit));
        return ledgerRepository.save(entry);
    }

    private void post(Contractor contractor, Project project, ContractorWorkPackage workPackage,
                      LocalDate date, String entryType, String referenceType, Long referenceId,
                      String referenceNumber, String description, BigDecimal debit, BigDecimal credit) {
        if (contractor == null) return;
        if (ledgerRepository.existsByReferenceTypeAndReferenceIdAndEntryType(referenceType, referenceId, entryType)) {
            return; // already posted — keeps retries and replays safe
        }
        ContractorLedgerEntry entry = new ContractorLedgerEntry();
        entry.setContractor(contractor);
        entry.setProject(project);
        entry.setWorkPackage(workPackage);
        entry.setEntryDate(date != null ? date : LocalDate.now());
        entry.setEntryType(entryType);
        entry.setReferenceType(referenceType);
        entry.setReferenceId(referenceId);
        entry.setReferenceNumber(referenceNumber);
        entry.setDescription(description);
        entry.setDebit(nz(debit));
        entry.setCredit(nz(credit));
        ledgerRepository.save(entry);
    }

    private static String refSuffix(ContractorPayment payment) {
        return payment.getBill() != null ? " against " + payment.getBill().getBillNumber() : "";
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
