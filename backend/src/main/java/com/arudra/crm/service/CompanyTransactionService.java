package com.arudra.crm.service;

import com.arudra.crm.entity.CompanyTransaction;
import com.arudra.crm.entity.RecurringExpense;
import com.arudra.crm.entity.User;
import com.arudra.crm.repository.CompanyTransactionRepository;
import com.arudra.crm.repository.RecurringExpenseRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Records and lists company-level cash transactions — "other income" and overhead / "other charges"
 * that no other module owns. These are combined with customer / supplier / contractor / payroll
 * payments by {@link FinanceReportService} to produce the consolidated Cash Book and reports.
 */
@Service
public class CompanyTransactionService {

    public static final List<String> DIRECTIONS = List.of("INCOME", "EXPENSE");

    /** Suggested categories the UI offers; free text is still accepted. */
    public static final List<String> INCOME_CATEGORIES =
            List.of("INTEREST", "SCRAP_SALE", "ASSET_SALE", "COMMISSION", "RENTAL_INCOME", "REFUND_RECEIVED", "OTHER_INCOME");
    public static final List<String> EXPENSE_CATEGORIES =
            List.of("HOSPITALITY", "ELECTRICITY", "RENT", "UTILITIES", "SALARY", "MARKETING", "OFFICE",
                    "TRAVEL", "PROFESSIONAL_FEES", "REPAIRS", "BANK_CHARGES", "TAXES", "INSURANCE", "MISC");

    @Autowired private CompanyTransactionRepository repository;
    @Autowired private RecurringExpenseRepository recurringExpenseRepository;
    @Autowired private DocumentNumberService documentNumberService;

    public Page<CompanyTransaction> search(String direction, String category, LocalDate from, LocalDate to,
                                           String search, int page, int size) {
        String q = (search == null || search.isBlank()) ? null : search.trim();
        return repository.search(emptyToNull(direction), emptyToNull(category), from, to, q,
                PageRequest.of(page, size));
    }

    @Transactional
    public CompanyTransaction record(CompanyTransaction txn, User actingUser) {
        if (txn.getDirection() == null || !DIRECTIONS.contains(txn.getDirection())) {
            throw new RuntimeException("Transaction direction must be INCOME or EXPENSE");
        }
        if (txn.getAmount() == null || txn.getAmount().signum() <= 0) {
            throw new RuntimeException("Transaction amount must be positive");
        }
        txn.setId(null);
        txn.setTxnNumber(nextTxnNumber(txn.getDirection()));
        if (txn.getTxnDate() == null) txn.setTxnDate(LocalDate.now());
        if (txn.getCategory() == null || txn.getCategory().isBlank()) {
            txn.setCategory("INCOME".equals(txn.getDirection()) ? "OTHER_INCOME" : "MISC");
        }
        txn.setRecordedBy(actingUser);
        return repository.save(txn);
    }

    @Transactional
    public void delete(Long id) {
        repository.findById(id).ifPresent(t -> {
            t.setIsDeleted(true);
            t.setDeletedAt(LocalDateTime.now());
            repository.save(t);
        });
    }

    // =====================================================================
    // Recurring expense heads (rent, electricity, internet…)
    // =====================================================================

    public List<RecurringExpense> listRecurring(boolean activeOnly) {
        return activeOnly
                ? recurringExpenseRepository.findByActiveTrueAndIsDeletedFalseOrderByNameAsc()
                : recurringExpenseRepository.findByIsDeletedFalseOrderByActiveDescNameAsc();
    }

    public List<CompanyTransaction> recurringHistory(Long recurringExpenseId) {
        return repository.findByRecurringExpenseIdAndIsDeletedFalseOrderByTxnDateDescIdDesc(recurringExpenseId);
    }

    @Transactional
    public RecurringExpense saveRecurring(RecurringExpense head, User actingUser) {
        if (head.getName() == null || head.getName().isBlank()) {
            throw new RuntimeException("Recurring expense needs a name");
        }
        if (head.getCategory() == null || head.getCategory().isBlank()) head.setCategory("MISC");
        if (head.getFrequency() == null || head.getFrequency().isBlank()) head.setFrequency("MONTHLY");
        if (head.getActive() == null) head.setActive(true);
        if (head.getId() == null) {
            head.setRecordedBy(actingUser);
            return recurringExpenseRepository.save(head);
        }
        // Update in place so audit/created fields survive.
        RecurringExpense existing = recurringExpenseRepository.findById(head.getId())
                .orElseThrow(() -> new RuntimeException("Recurring expense not found: " + head.getId()));
        existing.setName(head.getName());
        existing.setCategory(head.getCategory());
        existing.setDefaultAmount(head.getDefaultAmount());
        existing.setPartyName(head.getPartyName());
        existing.setPaymentMethod(head.getPaymentMethod());
        existing.setFrequency(head.getFrequency());
        existing.setDayOfMonth(head.getDayOfMonth());
        existing.setActive(head.getActive());
        existing.setNotes(head.getNotes());
        return recurringExpenseRepository.save(existing);
    }

    @Transactional
    public void deleteRecurring(Long id) {
        recurringExpenseRepository.findById(id).ifPresent(h -> {
            h.setIsDeleted(true);
            h.setActive(false);
            h.setDeletedAt(LocalDateTime.now());
            recurringExpenseRepository.save(h);
        });
    }

    private String nextTxnNumber(String direction) {
        String prefix = "INCOME".equals(direction) ? "INC-" : "EXP-";
        return prefix + String.format("%06d", documentNumberService.nextValue("COMPANY_TXN"));
    }

    private String emptyToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }
}
