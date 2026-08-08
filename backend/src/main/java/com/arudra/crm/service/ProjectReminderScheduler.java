package com.arudra.crm.service;

import com.arudra.crm.entity.Project;
import com.arudra.crm.entity.User;
import com.arudra.crm.repository.ProjectRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/**
 * Daily reminder job for the Project module: flags projects that have slipped past their
 * expected end date. Runs every day at 08:00 server time, alongside LeadReminderScheduler.
 */
@Component
public class ProjectReminderScheduler {

    private static final Logger log = LoggerFactory.getLogger(ProjectReminderScheduler.class);

    @Autowired private ProjectRepository projectRepository;
    @Autowired private NotificationService notificationService;

    @Scheduled(cron = "0 0 8 * * *")
    public void notifyDelayedProjects() {
        LocalDate today = LocalDate.now();
        List<Project> allProjects = projectRepository.findAll();
        int notified = 0;

        for (Project project : allProjects) {
            if (project.getEndDate() == null || !project.getEndDate().isBefore(today)) {
                continue;
            }
            if ("COMPLETED".equalsIgnoreCase(project.getStatus()) || "CANCELLED".equalsIgnoreCase(project.getStatus())) {
                continue;
            }
            User pm = project.getProjectManager();
            if (pm != null) {
                // dispatchIfAbsent so a project that stays delayed doesn't add a fresh alert every morning.
                notificationService.dispatchIfAbsent(
                        "Project Delayed",
                        project.getProjectName() + " was expected to finish on " + project.getEndDate()
                                + " and is still " + project.getStatus() + ".",
                        "PROJECT",
                        pm.getId(),
                        "/projects/" + project.getId());
                notified++;
            }
        }

        log.info("Project reminder job: {} delayed projects notified", notified);
    }
}
