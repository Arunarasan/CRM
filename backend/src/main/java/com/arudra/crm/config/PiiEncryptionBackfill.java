package com.arudra.crm.config;

import com.arudra.crm.security.PiiCryptoConverter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * On start-up, encrypts any Aadhaar/PAN/bank value still stored in plain text (rows written before
 * {@link PiiCryptoConverter} existed). Idempotent: encrypted values carry the "enc:v1:" prefix and
 * are skipped. Plain JDBC, so it doesn't bump @Version or fire entity listeners.
 */
@Component
public class PiiEncryptionBackfill {

    private static final Logger log = LoggerFactory.getLogger(PiiEncryptionBackfill.class);

    /** table → encrypted columns. Keep in step with the @Convert(PiiCryptoConverter) fields. */
    static final Map<String, List<String>> COLUMNS = Map.of(
            "workforce", List.of("aadhaar_number", "pan_number"),
            "employees", List.of("bank_account", "ifsc"),
            "contractors", List.of("pan", "bank_account_number", "bank_ifsc"),
            "suppliers", List.of("pan", "bank_account_number", "bank_ifsc"),
            "profile_change_requests", List.of("proposed_bank_account", "proposed_ifsc"),
            "customers", List.of("pan_number"));

    private final JdbcTemplate jdbc;
    private final PiiCryptoConverter converter;

    public PiiEncryptionBackfill(JdbcTemplate jdbc, PiiCryptoConverter converter) {
        this.jdbc = jdbc;
        this.converter = converter;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void encryptPlaintext() {
        if (!PiiCryptoConverter.enabled()) return;
        int total = 0;
        for (var entry : COLUMNS.entrySet()) {
            for (String col : entry.getValue()) {
                String table = entry.getKey();
                List<Map<String, Object>> rows = jdbc.queryForList(
                        "SELECT id, " + col + " AS v FROM " + table
                                + " WHERE " + col + " IS NOT NULL AND " + col + " <> '' AND " + col + " NOT LIKE 'enc:v1:%'");
                for (Map<String, Object> row : rows) {
                    jdbc.update("UPDATE " + table + " SET " + col + " = ? WHERE id = ?",
                            converter.convertToDatabaseColumn((String) row.get("v")), row.get("id"));
                    total++;
                }
            }
        }
        if (total > 0) log.warn("Encrypted {} plain-text Aadhaar/PAN/bank value(s) at rest.", total);
    }
}
