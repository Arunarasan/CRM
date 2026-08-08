package com.arudra.crm.service;

import com.arudra.crm.entity.Invoice;
import com.arudra.crm.entity.PaymentSchedule;
import com.arudra.crm.repository.InvoiceRepository;
import com.arudra.crm.repository.PaymentScheduleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * Daily finance sweep: flags overdue invoices/stages and notifies finance users
 * about overdue and upcoming dues. Mirrors the lead reminder scheduler pattern.
 */
@Service
public class FinanceReminderService {

    @Autowired private InvoiceRepository invoiceRepository;
    @Autowired private PaymentScheduleRepository scheduleRepository;
    @Autowired private FinanceService financeService;

    @Scheduled(cron = "0 0 8 * * *")
    @Transactional
    public void dailyFinanceSweep() {
        LocalDate today = LocalDate.now();

        // Invoices past due -> OVERDUE + notification
        List<Invoice> overdue = invoiceRepository.findByStatusInAndDueDateBefore(
                List.of("GENERATED", "SENT", "PARTIAL"), today);
        for (Invoice invoice : overdue) {
            if (Boolean.TRUE.equals(invoice.getIsDeleted())) continue;
            invoice.setStatus("OVERDUE");
            invoiceRepository.save(invoice);
            financeService.notifyFinanceUsersDeduped(
                    "Invoice " + invoice.getInvoiceNumber() + " is overdue",
                    "₹" + invoice.getBalanceDue() + " pending from " + invoice.getCustomer().getName()
                            + " (due " + invoice.getDueDate() + ")",
                    "INVOICE_OVERDUE", "/finance/invoices/" + invoice.getId());
        }

        // Invoices due in the next 3 days -> reminder
        List<Invoice> dueSoon = invoiceRepository.findByStatusInAndDueDateBetween(
                List.of("GENERATED", "SENT", "PARTIAL"), today, today.plusDays(3));
        for (Invoice invoice : dueSoon) {
            if (Boolean.TRUE.equals(invoice.getIsDeleted())) continue;
            financeService.notifyFinanceUsersDeduped(
                    "Invoice " + invoice.getInvoiceNumber() + " due " + invoice.getDueDate(),
                    "₹" + invoice.getBalanceDue() + " expected from " + invoice.getCustomer().getName(),
                    "PAYMENT_DUE", "/finance/invoices/" + invoice.getId());
        }

        // Payment plan stages past due and never invoiced -> pending advance/stage reminder
        List<PaymentSchedule> lateStages = scheduleRepository.findByStatusInAndDueDateBeforeAndIsDeletedFalse(
                List.of("PENDING"), today);
        for (PaymentSchedule stage : lateStages) {
            stage.setStatus("OVERDUE");
            scheduleRepository.save(stage);
            financeService.notifyFinanceUsersDeduped(
                    "Payment stage " + stage.getStage() + " overdue",
                    "Project " + stage.getProject().getProjectName() + ": ₹" + stage.getAmount()
                            + " stage was due " + stage.getDueDate() + " and has no invoice yet",
                    "PAYMENT_DUE", "/finance/projects/" + stage.getProject().getId());
        }
    }
}
