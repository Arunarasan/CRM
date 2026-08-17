package com.arudra.crm.service;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Atomic allocator for sequential financial document numbers (invoices, payments,
 * credit/debit notes, refunds). Backed by the {@code document_counters} table.
 *
 * <p>Each allocation runs in its OWN transaction ({@link Propagation#REQUIRES_NEW}) and takes
 * an exclusive row lock via the {@code UPDATE ... SET next_value = next_value + 1} until commit,
 * so concurrent callers serialize and can never mint the same number. Because the increment
 * commits independently of the caller's transaction, a number is durably reserved before the
 * document row is written — the trade-off is that a caller whose own transaction later rolls
 * back leaves a gap in the sequence, which is acceptable (and far preferable to duplicates).
 */
@Service
public class DocumentNumberService {

    private final JdbcTemplate jdbc;

    public DocumentNumberService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Returns the next value for the given counter key, creating the counter on first use.
     * Serialized across concurrent callers by the row lock the UPDATE holds until this
     * (independent) transaction commits.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public long nextValue(String key) {
        int rows = jdbc.update(
                "UPDATE document_counters SET next_value = next_value + 1 WHERE counter_key = ?", key);
        if (rows == 0) {
            // Counter not seeded (a key the migration didn't know about). Create it starting at 1.
            // If a concurrent caller wins the insert race, fall through and re-increment.
            try {
                jdbc.update("INSERT INTO document_counters (counter_key, next_value) VALUES (?, 1)", key);
                return 1L;
            } catch (DataIntegrityViolationException raced) {
                jdbc.update("UPDATE document_counters SET next_value = next_value + 1 WHERE counter_key = ?", key);
            }
        }
        return jdbc.queryForObject(
                "SELECT next_value FROM document_counters WHERE counter_key = ?", Long.class, key);
    }
}
