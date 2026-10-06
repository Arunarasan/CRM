package com.arudra.crm.security;

import com.arudra.crm.exception.DeviceAccessException;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Small in-memory sliding-window limiter for the unauthenticated terminal endpoints (registration,
 * pairing, token exchange) so they cannot be used to brute-force pairing codes or device secrets.
 * Per-instance; behind several replicas each enforces its own window, which is still bounded.
 */
@Component
public class SimpleRateLimiter {

    private final Map<String, Deque<Long>> hits = new ConcurrentHashMap<>();

    /** @throws DeviceAccessException (429 RATE_LIMITED) when {@code key} exceeded {@code max} in the window. */
    public void check(String key, int max, long windowMillis) {
        long now = System.currentTimeMillis();
        Deque<Long> q = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (q) {
            while (!q.isEmpty() && now - q.peekFirst() > windowMillis) q.pollFirst();
            if (q.size() >= max) {
                throw new DeviceAccessException(429, "RATE_LIMITED", "Too many attempts. Please wait and try again.");
            }
            q.addLast(now);
        }
        if (hits.size() > 10_000) prune(now, windowMillis);
    }

    private void prune(long now, long windowMillis) {
        hits.entrySet().removeIf(e -> {
            synchronized (e.getValue()) {
                Long last = e.getValue().peekLast();
                return last == null || now - last > windowMillis;
            }
        });
    }
}
