package com.arudra.crm.idempotency;

import java.util.Optional;

/** Persistence for {@link IdempotencyFilter}. */
public interface IdempotencyStore {

    record Entry(String state, Integer responseStatus, String contentType, String body, long ageSeconds) {
        public boolean done() { return "DONE".equals(state); }
    }

    /** Claims the key for this request. False when another request already holds it. */
    boolean tryBegin(String owner, String key, String method, String path);

    Optional<Entry> find(String owner, String key);

    /** Stores the successful response so a retry replays it. */
    void complete(String owner, String key, int status, String contentType, String body);

    /** Forgets the key (the request failed, so a retry must be allowed to run again). */
    void release(String owner, String key);

    int purgeOlderThanDays(int days);
}
