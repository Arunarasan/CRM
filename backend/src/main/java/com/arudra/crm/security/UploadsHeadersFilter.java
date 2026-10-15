package com.arudra.crm.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Uploaded files share the app's origin, so a hostile file (HTML/SVG) opened directly could run script
 * with access to the session. Force no content sniffing and a script-less sandbox on everything served
 * from /uploads (PDFs excepted: a sandbox CSP breaks the browser's built-in PDF viewer).
 */
@Component
public class UploadsHeadersFilter extends OncePerRequestFilter {

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/uploads/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        response.setHeader("X-Content-Type-Options", "nosniff");
        if (!request.getRequestURI().toLowerCase().endsWith(".pdf")) {
            response.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
        }
        chain.doFilter(request, response);
    }
}
