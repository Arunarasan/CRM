package com.arudra.crm.security;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;

/**
 * The browser-held session cookies. Both are HttpOnly (page scripts can't read them, so an XSS
 * can't steal them), SameSite=Strict (never sent on cross-site requests) and Secure in prod.
 * <ul>
 *   <li>{@value #REFRESH} — the refresh token, sent only to /api/auth (refresh, logout).</li>
 *   <li>{@value #FILES} — a copy of the short-lived access token, sent only to /api/files, so
 *       {@code <img src>} / download links to private files work without a header.</li>
 * </ul>
 */
@Component
public class AuthCookies {

    public static final String REFRESH = "crm_rt";
    public static final String FILES = "crm_ft";
    private static final String REFRESH_PATH = "/api/auth";
    private static final String FILES_PATH = "/api/files";

    private final boolean secure;
    private final long accessTokenMillis;

    public AuthCookies(Environment environment,
                       @org.springframework.beans.factory.annotation.Value("${jwt.expiration}") long accessTokenMillis) {
        this.secure = environment.acceptsProfiles(Profiles.of("prod"));
        this.accessTokenMillis = accessTokenMillis;
    }

    public void setRefresh(HttpServletResponse response, String rawToken, Instant expiry) {
        long seconds = Math.max(0, Duration.between(Instant.now(), expiry).getSeconds());
        add(response, REFRESH, rawToken, REFRESH_PATH, seconds);
    }

    public void setFiles(HttpServletResponse response, String accessToken) {
        add(response, FILES, accessToken, FILES_PATH, accessTokenMillis / 1000);
    }

    /** Sets both cookies for a freshly issued session. */
    public void setSession(HttpServletResponse response, String rawRefresh, Instant refreshExpiry, String accessToken) {
        setRefresh(response, rawRefresh, refreshExpiry);
        setFiles(response, accessToken);
    }

    public void clear(HttpServletResponse response) {
        add(response, REFRESH, "", REFRESH_PATH, 0);
        add(response, FILES, "", FILES_PATH, 0);
    }

    public static String read(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (name.equals(c.getName()) && c.getValue() != null && !c.getValue().isBlank()) return c.getValue();
        }
        return null;
    }

    private void add(HttpServletResponse response, String name, String value, String path, long maxAgeSeconds) {
        ResponseCookie cookie = ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(secure)
                .sameSite("Strict")
                .path(path)
                .maxAge(maxAgeSeconds)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
