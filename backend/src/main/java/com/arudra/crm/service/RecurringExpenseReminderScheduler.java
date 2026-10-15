package com.arudra.crm.service;

import com.arudra.crm.entity.RecurringExpense;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/**
 * Daily reminder for recurring company overheads (rent, electricity…). Notify-only — it never records
 * a payment. Stateless de-duplication: it fires only on specific day offsets (3 days before, on the
 * due day, then 1, 7, 14… days overdue), so each stage alerts the admins once per day it is hit.
 */
@Component
public class RecurringExpenseReminderScheduler {

    private static final Logger log = LoggerFactory.getLogger(RecurringExpenseReminderScheduler.class);

    @Autowired private CompanyTransactionService companyTransactionService;
    @Autowired private NotificationService notificationService;

    @Scheduled(cron = "0 0 9 * * *")
    public void remindDueExpenses() {
        List<RecurringExpense> heads = companyTransactionService.listRecurring(true);
        int sent = 0;
        for (RecurringExpense h : heads) {
            Integer d = h.getDaysUntilDue();
            if (d == null || !shouldRemind(d)) continue;
            String amount = h.getDefaultAmount() != null ? " (about ₹" + h.getDefaultAmount().stripTrailingZeros().toPlainString() + ")" : "";
            String title; String msg;
            if (d > 0) {
                title = "Bill due soon: " + h.getName();
                msg = h.getName() + amount + " is due in " + d + " day(s) on " + h.getNextDueDate() + ".";
            } else if (d == 0) {
                title = "Bill due today: " + h.getName();
                msg = h.getName() + amount + " is due today. Record the payment once it is paid.";
            } else {
                title = "Bill overdue: " + h.getName();
                msg = h.getName() + amount + " was due on " + h.getNextDueDate() + " (" + (-d) + " day(s) ago) and has not been recorded.";
            }
            notificationService.dispatchToAdmins(title, msg, "FINANCE", "/finance/expenses", null);
            sent++;
        }
        if (sent > 0) log.info("Recurring expense reminders: notified admins about {} bill(s).", sent);
    }

    static boolean shouldRemind(int daysUntilDue) {
        if (daysUntilDue == 3 || daysUntilDue == 0) return true;
        if (daysUntilDue < 0) {
            int overdue = -daysUntilDue;
            return overdue == 1 || overdue % 7 == 0;
        }
        return false;
    }
}
