package com.arudra.crm.idempotency;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class IdempotencyFilterTest {

    /** In-memory stand-in for the JDBC store. */
    static class MemStore implements IdempotencyStore {
        final Map<String, Entry> rows = new HashMap<>();
        long ageSeconds = 0;

        @Override public boolean tryBegin(String o, String k, String m, String p) {
            return rows.putIfAbsent(o + "|" + k, new Entry("IN_PROGRESS", null, null, null, ageSeconds)) == null;
        }
        @Override public Optional<Entry> find(String o, String k) { return Optional.ofNullable(rows.get(o + "|" + k)); }
        @Override public void complete(String o, String k, int s, String ct, String b) { rows.put(o + "|" + k, new Entry("DONE", s, ct, b, 0)); }
        @Override public void release(String o, String k) { rows.remove(o + "|" + k); }
        @Override public int purgeOlderThanDays(int d) { return 0; }
    }

    private MemStore store;
    private IdempotencyFilter filter;
    private AtomicInteger runs;

    @BeforeEach
    void setUp() {
        store = new MemStore();
        filter = new IdempotencyFilter(store);
        runs = new AtomicInteger();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("emp@x.com", "n/a", List.of()));
    }

    @AfterEach
    void tearDown() { SecurityContextHolder.clearContext(); }

    private MockHttpServletRequest post(String path, String key) {
        MockHttpServletRequest r = new MockHttpServletRequest("POST", path);
        r.setRequestURI(path);
        if (key != null) r.addHeader("Idempotency-Key", key);
        return r;
    }

    private FilterChain creates(int status) {
        return (req, res) -> {
            int n = runs.incrementAndGet();
            var out = (jakarta.servlet.http.HttpServletResponse) res;
            out.setStatus(status);
            out.setContentType("application/json");
            out.getWriter().write("{\"id\":" + n + "}");
        };
    }

    @Test
    void secondRequestWithSameKeyIsReplayedNotRerun() throws Exception {
        MockHttpServletResponse first = new MockHttpServletResponse();
        filter.doFilter(post("/api/employee-portal/leads", "k1"), first, creates(201));
        MockHttpServletResponse second = new MockHttpServletResponse();
        filter.doFilter(post("/api/employee-portal/leads", "k1"), second, creates(201));

        assertEquals(1, runs.get(), "handler must run once");
        assertEquals("{\"id\":1}", first.getContentAsString());
        assertEquals("{\"id\":1}", second.getContentAsString());
        assertEquals(201, second.getStatus());
        assertEquals("true", second.getHeader("Idempotent-Replay"));
    }

    @Test
    void differentKeysBothRun() throws Exception {
        filter.doFilter(post("/api/employee-portal/leads", "a"), new MockHttpServletResponse(), creates(200));
        filter.doFilter(post("/api/employee-portal/leads", "b"), new MockHttpServletResponse(), creates(200));
        assertEquals(2, runs.get());
    }

    @Test
    void failedRequestIsNotRemembered() throws Exception {
        filter.doFilter(post("/api/employee-portal/leads", "k"), new MockHttpServletResponse(), creates(400));
        MockHttpServletResponse retry = new MockHttpServletResponse();
        filter.doFilter(post("/api/employee-portal/leads", "k"), retry, creates(200));
        assertEquals(2, runs.get(), "a rejected request can be retried");
        assertEquals(200, retry.getStatus());
    }

    @Test
    void exceptionReleasesTheKey() throws Exception {
        FilterChain boom = (req, res) -> { runs.incrementAndGet(); throw new jakarta.servlet.ServletException("boom"); };
        assertThrows(jakarta.servlet.ServletException.class,
                () -> filter.doFilter(post("/api/employee-portal/leads", "k"), new MockHttpServletResponse(), boom));
        assertTrue(store.rows.isEmpty());
    }

    @Test
    void inProgressDuplicateGets409() throws Exception {
        store.tryBegin("emp@x.com", "k", "POST", "/x"); // first attempt still running
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(post("/api/employee-portal/leads", "k"), res, creates(200));
        assertEquals(0, runs.get());
        assertEquals(409, res.getStatus());
        assertEquals("true", res.getHeader("X-Idempotency-In-Progress"));
    }

    @Test
    void staleInProgressIsTakenOver() throws Exception {
        store.ageSeconds = 600;
        store.tryBegin("emp@x.com", "k", "POST", "/x");
        store.ageSeconds = 0;
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(post("/api/employee-portal/leads", "k"), res, creates(200));
        assertEquals(1, runs.get());
        assertEquals(200, res.getStatus());
    }

    @Test
    void ignoredWithoutKeyOrOutsideScopeOrForGet() throws Exception {
        filter.doFilter(post("/api/employee-portal/leads", null), new MockHttpServletResponse(), creates(200));
        filter.doFilter(post("/api/finance/payments", "k"), new MockHttpServletResponse(), creates(200));
        MockHttpServletRequest get = new MockHttpServletRequest("GET", "/api/employee-portal/leads");
        get.setRequestURI("/api/employee-portal/leads");
        get.addHeader("Idempotency-Key", "k");
        filter.doFilter(get, new MockHttpServletResponse(), creates(200));
        assertEquals(3, runs.get());
        assertTrue(store.rows.isEmpty());
    }

    @Test
    void keysAreScopedPerUser() throws Exception {
        filter.doFilter(post("/api/employee-portal/leads", "same"), new MockHttpServletResponse(), creates(200));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("other@x.com", "n/a", List.of()));
        filter.doFilter(post("/api/employee-portal/leads", "same"), new MockHttpServletResponse(), creates(200));
        assertEquals(2, runs.get());
    }
}
