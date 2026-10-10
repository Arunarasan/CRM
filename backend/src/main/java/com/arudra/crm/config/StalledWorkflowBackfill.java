package com.arudra.crm.config;

import com.arudra.crm.repository.WorkflowPhaseInstanceRepository;
import com.arudra.crm.service.WorkflowService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;

/**
 * Backfill (idempotent): workflows stuck in an ACTIVE phase that has no tasks — older leads whose
 * Site Visit / Measurement / BOQ phases were later removed from the template. Each such phase is skipped
 * (WorkflowService.skipIfEmpty) so the workflow moves on and generates its next real task. Each phase
 * runs in its own transaction; failures are logged and never block startup.
 */
@Component
public class StalledWorkflowBackfill implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(StalledWorkflowBackfill.class);

    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private TransactionTemplate transactionTemplate;
    @Autowired private WorkflowPhaseInstanceRepository phaseInstanceRepository;
    @Autowired private WorkflowService workflowService;

    @Override
    public void run(String... args) {
        try {
            backfill();
        } catch (Exception e) {
            logger.warn("Stalled workflow backfill skipped: {}", e.getMessage());
        }
    }

    private void backfill() {
        List<Long> stalled = jdbcTemplate.queryForList("""
                SELECT pi.id
                FROM workflow_phase_instances pi
                JOIN workflow_instances wi ON wi.id = pi.workflow_instance_id
                WHERE wi.status = 'ACTIVE' AND pi.status = 'ACTIVE'
                  AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.workflow_phase_instance_id = pi.id)
                """, Long.class);
        if (stalled.isEmpty()) return;
        int moved = 0;
        for (Long id : stalled) {
            try {
                Boolean skipped = transactionTemplate.execute(tx -> phaseInstanceRepository.findById(id)
                        .map(workflowService::skipIfEmpty).orElse(false));
                if (Boolean.TRUE.equals(skipped)) moved++;
            } catch (Exception e) {
                logger.warn("Stalled workflow phase {} not advanced: {}", id, e.getMessage());
            }
        }
        logger.info("Advanced {} of {} workflow(s) stuck in an empty phase", moved, stalled.size());
    }
}
