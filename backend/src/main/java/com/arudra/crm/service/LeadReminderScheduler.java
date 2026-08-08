package com.arudra.crm.service;

import com.arudra.crm.entity.Lead;
import com.arudra.crm.entity.LeadReminder;
import com.arudra.crm.entity.SiteVisit;
import com.arudra.crm.entity.User;
import com.arudra.crm.repository.LeadReminderRepository;
import com.arudra.crm.repository.LeadRepository;
import com.arudra.crm.repository.SiteVisitRepository;
import com.arudra.crm.util.LeadWorkflow;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/**
 * Daily reminder job for the Lead module: notifies assigned users about
 * follow-ups due today, overdue follow-ups, today's site visits and open
 * lead tasks. Runs every day at 08:00 server time.
 */
@Component
public class LeadReminderScheduler {

    private static final Logger log = LoggerFactory.getLogger(LeadReminderScheduler.class);

    @Autowired private LeadRepository leadRepository;
    @Autowired private LeadReminderRepository leadReminderRepository;
    @Autowired private SiteVisitRepository siteVisitRepository;
    @Autowired private NotificationService notificationService;

    @Scheduled(cron = "0 0 8 * * *")
    public void sendDailyLeadReminders() {
        LocalDate today = LocalDate.now();

        List<Lead> dueToday = leadRepository.findByIsDeletedFalseAndNextFollowUpDateAndIsConvertedFalse(today);
        for (Lead lead : dueToday) {
            notifyExecutive(lead, "Follow-up due today",
                    "Follow-up for " + lead.getLeadNumber() + " (" + lead.getName() + ") is due today"
                            + (lead.getNextFollowUpTime() != null ? " at " + lead.getNextFollowUpTime() : "") + ".");
        }

        List<Lead> overdue = leadRepository
                .findByIsDeletedFalseAndNextFollowUpDateBeforeAndIsConvertedFalseAndStatusNotIn(
                        today, LeadWorkflow.CLOSED_STATUSES);
        for (Lead lead : overdue) {
            notifyExecutive(lead, "Follow-up overdue",
                    "Follow-up for " + lead.getLeadNumber() + " (" + lead.getName()
                            + ") was due on " + lead.getNextFollowUpDate() + " and is overdue.");
        }

        List<SiteVisit> visitsToday = siteVisitRepository.findLeadVisitsScheduledOn(today);
        for (SiteVisit visit : visitsToday) {
            Lead lead = visit.getLead();
            String message = "Site visit " + visit.getVisitNumber() + " for " + lead.getLeadNumber()
                    + " (" + lead.getName() + ") is scheduled today.";
            notifyExecutive(lead, "Site visit today", message);
            if (lead.getAssignedEngineer() != null) {
                notificationService.dispatch("Site visit today", message, "LEAD",
                        lead.getAssignedEngineer().getId(), "/leads/" + lead.getId());
            }
        }

        List<LeadReminder> tasksDue = leadReminderRepository
                .findByIsCompletedFalseAndReminderTimeBetween(today.atStartOfDay(),
                        today.plusDays(1).atStartOfDay());
        for (LeadReminder task : tasksDue) {
            User assignee = task.getAssignedTo();
            if (assignee != null) {
                notificationService.dispatch("Lead task due today",
                        "Task \"" + (task.getTitle() != null ? task.getTitle() : task.getTaskType())
                                + "\" on " + task.getLead().getLeadNumber() + " is due today.",
                        "LEAD", assignee.getId(), "/leads/" + task.getLead().getId());
            }
        }

        log.info("Lead reminder job: {} due follow-ups, {} overdue, {} site visits, {} tasks notified",
                dueToday.size(), overdue.size(), visitsToday.size(), tasksDue.size());
    }

    private void notifyExecutive(Lead lead, String title, String message) {
        if (lead.getAssignedSalesExecutive() != null) {
            notificationService.dispatch(title, message, "LEAD",
                    lead.getAssignedSalesExecutive().getId(), "/leads/" + lead.getId());
        }
    }
}
