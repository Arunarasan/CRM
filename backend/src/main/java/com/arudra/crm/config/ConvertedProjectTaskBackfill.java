package com.arudra.crm.config;

import com.arudra.crm.entity.Project;
import com.arudra.crm.repository.ProjectRepository;
import com.arudra.crm.service.ProjectService;
import com.arudra.crm.service.ProjectWorkService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;

/**
 * Backfill (idempotent): every running project converted from a quotation should own its shared
 * "Execution & Installation" task. Projects converted before tasks were generated automatically — or
 * moved to RUNNING by V131 — get it here, with their work lines and checklist. Projects that already
 * have an Execution task, or the older separate Installation task, are left alone. Each project is
 * handled on its own; a failure is logged and retried on the next startup.
 */
@Component
public class ConvertedProjectTaskBackfill implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(ConvertedProjectTaskBackfill.class);

    @Autowired private ProjectRepository projectRepository;
    @Autowired private ProjectWorkService projectWorkService;
    @Autowired private ProjectService projectService;
    @Autowired private TransactionTemplate transactionTemplate;

    @Override
    public void run(String... args) {
        // Never let a backfill stop the app from starting.
        try {
            backfill();
        } catch (Exception e) {
            logger.warn("Converted-project task backfill skipped: {}", e.getMessage());
        }
    }

    private void backfill() {
        List<Long> candidates = transactionTemplate.execute(tx -> projectRepository.findAll().stream()
                .filter(p -> !Boolean.TRUE.equals(p.getIsDeleted()))
                .filter(p -> p.getQuotation() != null && "RUNNING".equalsIgnoreCase(p.getStatus()))
                .map(Project::getId)
                .toList());
        if (candidates == null || candidates.isEmpty()) return;
        int done = 0, needed = 0;
        for (Long id : candidates) {
            try {
                Boolean created = transactionTemplate.execute(tx -> {
                    if (projectWorkService.findExecutionTask(id) != null
                            || projectWorkService.findInstallationTask(id) != null) return false;
                    projectWorkService.ensureTasks(id);
                    projectWorkService.syncFromQuote(id);
                    projectService.seedExecutionChecklist(id);
                    return true;
                });
                if (Boolean.TRUE.equals(created)) { needed++; done++; }
            } catch (Exception e) {
                needed++;
                logger.warn("Execution task not created for converted project {}: {}", id, e.getMessage());
            }
        }
        if (needed > 0) {
            logger.info("Execution & Installation task backfilled for {} of {} converted project(s)", done, needed);
        }
    }
}
