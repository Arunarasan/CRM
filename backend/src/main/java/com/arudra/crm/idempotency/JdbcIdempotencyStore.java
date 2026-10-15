package com.arudra.crm.idempotency;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;

@Repository
public class JdbcIdempotencyStore implements IdempotencyStore {

    private final JdbcTemplate jdbc;

    public JdbcIdempotencyStore(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public boolean tryBegin(String owner, String key, String method, String path) {
        try {
            jdbc.update("INSERT INTO idempotency_keys (owner, idem_key, http_method, path, state, created_at) VALUES (?,?,?,?, 'IN_PROGRESS', ?)",
                    owner, key, method, path, Timestamp.from(Instant.now()));
            return true;
        } catch (DuplicateKeyException e) {
            return false;
        }
    }

    @Override
    public Optional<Entry> find(String owner, String key) {
        return jdbc.query("SELECT state, response_status, content_type, response_body, created_at FROM idempotency_keys WHERE owner = ? AND idem_key = ?",
                rs -> {
                    if (!rs.next()) return Optional.<Entry>empty();
                    long age = Math.max(0, Instant.now().getEpochSecond() - rs.getTimestamp("created_at").toInstant().getEpochSecond());
                    int st = rs.getInt("response_status");
                    Integer status = rs.wasNull() ? null : st;
                    return Optional.of(new Entry(rs.getString("state"), status,
                            rs.getString("content_type"), rs.getString("response_body"), age));
                }, owner, key);
    }

    @Override
    public void complete(String owner, String key, int status, String contentType, String body) {
        jdbc.update("UPDATE idempotency_keys SET state = 'DONE', response_status = ?, content_type = ?, response_body = ? WHERE owner = ? AND idem_key = ?",
                status, contentType, body, owner, key);
    }

    @Override
    public void release(String owner, String key) {
        jdbc.update("DELETE FROM idempotency_keys WHERE owner = ? AND idem_key = ?", owner, key);
    }

    @Override
    public int purgeOlderThanDays(int days) {
        return jdbc.update("DELETE FROM idempotency_keys WHERE created_at < ?", Timestamp.from(Instant.now().minusSeconds(days * 86400L)));
    }
}
