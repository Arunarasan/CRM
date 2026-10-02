package com.arudra.crm.config;

import com.arudra.crm.entity.ProjectPayment;
import com.arudra.crm.repository.ProjectPaymentRepository;
import com.arudra.crm.service.FinanceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * One-time backfill (idempotent, re-runs only for rows not yet moved): copies payments stranded in the
 * legacy project_payments table — chiefly advances taken when a quotation was converted — into the
 * finance module so they appear on the project's Payments tab, customer ledger and outstanding. Each
 * row moves in its own transaction; a failure (e.g. project without a customer) is logged and retried
 * on the next startup without blocking the others.
 */
@Component
public class LegacyProjectPaymentBackfill implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(LegacyProjectPaymentBackfill.class);

    @Autowired private ProjectPaymentRepository projectPaymentRepository;
    @Autowired private FinanceService financeService;

    @Override
    public void run(String... args) {
        List<Long> pending = projectPaymentRepository.findByMigratedPaymentIdIsNullAndStatus("COMPLETED")
                .stream().map(ProjectPayment::getId).toList();
        if (pending.isEmpty()) return;
        int moved = 0;
        for (Long id : pending) {
            try {
                financeService.migrateLegacyProjectPayment(id);
                moved++;
            } catch (Exception e) {
                logger.warn("Legacy project payment {} not migrated: {}", id, e.getMessage());
            }
        }
        logger.info("Legacy project payments migrated to finance: {} of {}", moved, pending.size());
    }
}
