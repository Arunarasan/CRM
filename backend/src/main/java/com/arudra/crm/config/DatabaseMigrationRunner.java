package com.arudra.crm.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class DatabaseMigrationRunner implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(DatabaseMigrationRunner.class);

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) {
        logger.info("Executing database schema migrations to relax customer_id constraints...");
        try {
            // Drop NOT NULL constraints from customer_id to support lead-first workflows
            jdbcTemplate.execute("ALTER TABLE boqs MODIFY customer_id BIGINT NULL;");
            logger.info("Successfully altered boqs table.");
        } catch (Exception e) {
            logger.warn("Failed to alter boqs table: {}", e.getMessage());
        }

        try {
            jdbcTemplate.execute("ALTER TABLE quotations MODIFY customer_id BIGINT NULL;");
            logger.info("Successfully altered quotations table.");
        } catch (Exception e) {
            logger.warn("Failed to alter quotations table: {}", e.getMessage());
        }

        try {
            jdbcTemplate.execute("ALTER TABLE projects MODIFY customer_id BIGINT NULL;");
            logger.info("Successfully altered projects table.");
        } catch (Exception e) {
            logger.warn("Failed to alter projects table: {}", e.getMessage());
        }
        
        logger.info("Database schema migrations completed.");
    }
}
