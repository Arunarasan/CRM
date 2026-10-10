package com.arudra.crm.config;

import com.arudra.crm.event.LeadRequirementCollectedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;

/**
 * Backfill (idempotent): leads whose requirement stage is already over — a site visit, measurement or
 * quotation exists — but whose "Collect Requirement" task is still open. Each is closed as done by the
 * office and the next task generated, exactly as when the office does that work today
 * (EmployeeTaskService.onLeadRequirementCollected). No notifications for this cleanup. Each lead runs in
 * its own transaction; failures are logged and never block startup.
 */
@Component
public class RequirementTaskBackfill implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(RequirementTaskBackfill.class);

    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private TransactionTemplate transactionTemplate;
    @Autowired private ApplicationEventPublisher eventPublisher;

    @Override
    public void run(String... args) {
        try {
            backfill();
        } catch (Exception e) {
            logger.warn("Collect Requirement backfill skipped: {}", e.getMessage());
        }
    }

    private void backfill() {
        List<Long> leadIds = jdbcTemplate.queryForList("""
                SELECT DISTINCT t.lead_id
                FROM tasks t
                JOIN task_templates tt ON tt.id = t.task_template_id
                WHERE tt.code = 'TT_COLLECT_REQUIREMENT'
                  AND t.lead_id IS NOT NULL
                  AND (t.is_deleted = 0 OR t.is_deleted IS NULL)
                  AND t.status NOT IN ('COMPLETED', 'CANCELLED')
                  AND (EXISTS (SELECT 1 FROM site_visits sv WHERE sv.lead_id = t.lead_id AND sv.is_deleted = 0)
                    OR EXISTS (SELECT 1 FROM measurements m WHERE m.lead_id = t.lead_id AND m.is_deleted = 0)
                    OR EXISTS (SELECT 1 FROM quotations q WHERE q.lead_id = t.lead_id AND q.is_deleted = 0))
                """, Long.class);
        if (leadIds.isEmpty()) return;
        int done = 0;
        for (Long leadId : leadIds) {
            try {
                transactionTemplate.executeWithoutResult(tx -> eventPublisher.publishEvent(
                        new LeadRequirementCollectedEvent(leadId, null, "site visit / measurement already on the lead", false)));
                done++;
            } catch (Exception e) {
                logger.warn("Collect Requirement not closed for lead {}: {}", leadId, e.getMessage());
            }
        }
        logger.info("Collect Requirement closed by office for {} of {} lead(s) already past that stage", done, leadIds.size());
    }
}
