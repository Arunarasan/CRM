package com.arudra.crm.service;

import com.arudra.crm.entity.Project;
import com.arudra.crm.repository.ProjectRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Keeps AUTO-mode projects staffed: tasks created after the switch get picked up within minutes. */
@Component
public class ProjectAutoAssignScheduler {

    private static final Logger log = LoggerFactory.getLogger(ProjectAutoAssignScheduler.class);

    @Autowired private ProjectRepository projectRepository;
    @Autowired private SmartAssignmentService smartAssignmentService;

    @Scheduled(fixedDelay = 5 * 60_000, initialDelay = 3 * 60_000)
    public void sweep() {
        for (Project p : projectRepository.findByTaskAssignmentMode("AUTO")) {
            try {
                int n = smartAssignmentService.autoAssignProject(p.getId(), null);
                if (n > 0) log.info("Auto-assigned {} task(s) on project {}", n, p.getId());
            } catch (Exception e) {
                log.warn("Auto-assign sweep failed for project {}: {}", p.getId(), e.getMessage());
            }
        }
    }
}
