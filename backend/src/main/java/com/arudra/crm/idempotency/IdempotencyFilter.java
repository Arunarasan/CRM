package com.arudra.crm.idempotency;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.Set;

/**
 * Makes employee-portal writes safe to retry. The mobile app queues writes while offline and re-sends
 * them later; if the first attempt actually reached the server but the reply was lost, the retry would
 * create a duplicate. A request carrying an {@code Idempotency-Key} header is run once: the first success
 * is stored, and any later request with the same key (same user) gets that stored answer back.
 *
 * Runs after Spring Security (lowest precedence) so the caller's identity is known — keys are per user.
 * Failed requests are not remembered, so a corrected retry still goes through.
 */
@Slf4j
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class IdempotencyFilter extends OncePerRequestFilter {

    public static final String HEADER = "Idempotency-Key";
    static final String REPLAY_HEADER = "Idempotent-Replay";
    static final String IN_PROGRESS_HEADER = "X-Idempotency-In-Progress";
    private static final Set<String> METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");
    private static final String[] PREFIXES = {"/api/employee-portal/", "/api/employee-tasks/"};
    private static final long STALE_IN_PROGRESS_SECONDS = 120;

    private final IdempotencyStore store;

    public IdempotencyFilter(IdempotencyStore store) {
        this.store = store;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!METHODS.contains(request.getMethod())) return true;
        String key = request.getHeader(HEADER);
        if (key == null || key.isBlank() || key.length() > 64) return true;
        String path = request.getRequestURI();
        for (String p : PREFIXES) if (path.startsWith(p)) return false;
        return true;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getName())) {
            chain.doFilter(request, response); // security will reject it; nothing to dedupe
            return;
        }
        String owner = auth.getName();
        String key = request.getHeader(HEADER).trim();
        String path = request.getRequestURI();

        if (!store.tryBegin(owner, key, request.getMethod(), path)) {
            Optional<IdempotencyStore.Entry> existing = store.find(owner, key);
            if (existing.isPresent() && !existing.get().done() && existing.get().ageSeconds() > STALE_IN_PROGRESS_SECONDS) {
                // The first attempt died mid-flight (server restart): free the key and run it afresh.
                store.release(owner, key);
                if (store.tryBegin(owner, key, request.getMethod(), path)) {
                    run(request, response, chain, owner, key);
                    return;
                }
                existing = store.find(owner, key);
            }
            if (existing.isPresent() && existing.get().done()) {
                replay(response, existing.get());
            } else {
                response.setStatus(HttpServletResponse.SC_CONFLICT);
                response.setHeader(IN_PROGRESS_HEADER, "true");
                response.setContentType("application/json");
                response.getWriter().write("{\"success\":false,\"message\":\"This request is already being processed\"}");
            }
            return;
        }
        run(request, response, chain, owner, key);
    }

    private void run(HttpServletRequest request, HttpServletResponse response, FilterChain chain, String owner, String key)
            throws ServletException, IOException {
        ContentCachingResponseWrapper wrapped = new ContentCachingResponseWrapper(response);
        boolean stored = false;
        try {
            chain.doFilter(request, wrapped);
            int status = wrapped.getStatus();
            if (status >= 200 && status < 300) {
                String body = new String(wrapped.getContentAsByteArray(), StandardCharsets.UTF_8);
                store.complete(owner, key, status, wrapped.getContentType(), body);
                stored = true;
            }
        } finally {
            if (!stored) {
                try { store.release(owner, key); } catch (RuntimeException e) { log.warn("Could not release idempotency key", e); }
            }
            wrapped.copyBodyToResponse();
        }
    }

    private void replay(HttpServletResponse response, IdempotencyStore.Entry e) throws IOException {
        response.setStatus(e.responseStatus() == null ? 200 : e.responseStatus());
        response.setHeader(REPLAY_HEADER, "true");
        if (e.contentType() != null) response.setContentType(e.contentType());
        if (e.body() != null && !e.body().isEmpty()) {
            byte[] bytes = e.body().getBytes(StandardCharsets.UTF_8);
            response.setContentLength(bytes.length);
            response.getOutputStream().write(bytes);
        }
    }

    /** Keys only need to outlive the longest realistic offline stretch. */
    @Scheduled(cron = "0 30 3 * * *")
    public void purgeOld() {
        try {
            int n = store.purgeOlderThanDays(14);
            if (n > 0) log.info("Purged {} expired idempotency keys", n);
        } catch (RuntimeException e) {
            log.warn("Idempotency purge failed", e);
        }
    }
}
