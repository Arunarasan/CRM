package com.arudra.crm.util;

import jakarta.servlet.http.HttpServletRequest;

/** Client IP behind the nginx reverse proxy: first X-Forwarded-For hop, else the socket address. */
public final class RequestIp {

    private RequestIp() {}

    public static String of(HttpServletRequest request) {
        if (request == null) return null;
        String fwd = request.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) {
            return fwd.split(",")[0].trim();
        }
        String real = request.getHeader("X-Real-IP");
        return real != null && !real.isBlank() ? real.trim() : request.getRemoteAddr();
    }
}
