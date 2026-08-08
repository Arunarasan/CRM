package com.arudra.crm.service;

import com.arudra.crm.entity.SiteVisit;
import com.arudra.crm.entity.SiteVisitAssignment;
import com.arudra.crm.repository.SiteVisitAssignmentRepository;
import com.arudra.crm.repository.SiteVisitRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * Daily reminder job for scheduled site visits: notifies assigned employees
 * (and the visit creator) about today's visits, once per visit. Runs every
 * day at 07:30 server time, ahead of the Lead reminder job.
 */
@Component
public class SiteVisitReminderScheduler {

    private static final Logger log = LoggerFactory.getLogger(SiteVisitReminderScheduler.class);

    @Autowired private SiteVisitRepository siteVisitRepository;
    @Autowired private SiteVisitAssignmentRepository assignmentRepository;
    @Autowired private NotificationService notificationService;

    @Scheduled(cron = "0 30 7 * * *")
    @Transactional
    public void sendDailyVisitReminders() {
        LocalDate today = LocalDate.now();
        List<SiteVisit> visitsToday = siteVisitRepository
                .findByReminderEnabledTrueAndReminderSentFalseAndScheduledDateAndIsDeletedFalse(today);

        for (SiteVisit visit : visitsToday) {
            String message = "Visit " + visit.getVisitNumber() + " is scheduled today"
                    + (visit.getScheduledTime() != null ? " at " + visit.getScheduledTime().toLocalTime() : "") + ".";
            List<SiteVisitAssignment> assignments = assignmentRepository.findBySiteVisitId(visit.getId());
            for (SiteVisitAssignment a : assignments) {
                if (a.getAssignedUser() != null) {
                    notificationService.dispatch("Visit Reminder", message, "SITE_VISIT",
                            a.getAssignedUser().getId(), "/site-visits/" + visit.getId());
                }
            }
            visit.setReminderSent(true);
            siteVisitRepository.save(visit);
        }

        log.info("Site visit reminder job: {} visits notified", visitsToday.size());
    }
}
