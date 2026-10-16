package com.arudra.crm.security;

import com.arudra.crm.util.RequestIp;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Per-client-IP fixed-window rate limiter for the unauthenticated / abuse-prone POST endpoints
 * (login, password-reset OTP, public forms, kiosk pairing, uploads). In-memory: fine for the single
 * backend instance; move to a shared store if the backend is ever scaled out.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class RateLimitFilter extends OncePerRequestFilter {

    private record Rule(String name, int max, long windowMs) {}

    private static final class Window {
        long start;
        int count;
    }

    private static final Rule LOGIN = new Rule("login", 10, 30_000);
    private static final Rule REFRESH = new Rule("refresh", 30, 60_000);
    private static final Rule FORGOT = new Rule("forgot", 5, 15 * 60_000);
    private static final Rule OTP = new Rule("otp", 10, 15 * 60_000);
    private static final Rule PAIR = new Rule("pair", 10, 10 * 60_000);
    private static final Rule PUBLIC = new Rule("public", 30, 60_000);
    private static final Rule UPLOAD = new Rule("upload", 60, 60_000);

    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private long lastSweep = System.currentTimeMillis();

    private static Rule ruleFor(HttpServletRequest req) {
        if (!"POST".equalsIgnoreCase(req.getMethod())) return null;
        String p = req.getRequestURI();
        switch (p) {
            case "/api/auth/login": return LOGIN;
            case "/api/auth/refresh": return REFRESH;
            case "/api/auth/forgot-password": return FORGOT;
            case "/api/auth/verify-otp":
            case "/api/auth/reset-password": return OTP;
            case "/api/public/kiosk/pair": return PAIR;
            default: break;
        }
        if (p.startsWith("/api/public/kiosk/")) return null; // kiosk punches are token-authenticated and frequent
        if (p.startsWith("/api/public/")) return PUBLIC;
        if (p.equals("/api/uploads")) return UPLOAD;
        return null;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Rule rule = ruleFor(request);
        if (rule != null) {
            long now = System.currentTimeMillis();
            sweep(now);
            Window w = windows.computeIfAbsent(rule.name() + "|" + RequestIp.of(request), k -> new Window());
            long retryAfterSec = 0;
            synchronized (w) {
                if (now - w.start >= rule.windowMs()) {
                    w.start = now;
                    w.count = 0;
                }
                if (++w.count > rule.max()) {
                    retryAfterSec = Math.max(1, (w.start + rule.windowMs() - now) / 1000);
                }
            }
            if (retryAfterSec > 0) {
                response.setStatus(429);
                response.setHeader("Retry-After", String.valueOf(retryAfterSec));
                response.setContentType("application/json");
                response.getWriter().write("{\"success\":false,\"message\":\"Too many requests. Please try again later.\"}");
                return;
            }
        }
        chain.doFilter(request, response);
    }

    /** Drops expired windows at most once a minute so the map can't grow without bound. */
    private void sweep(long now) {
        if (now - lastSweep < 60_000) return;
        lastSweep = now;
        windows.entrySet().removeIf(e -> now - e.getValue().start > 30 * 60_000);
    }
}
