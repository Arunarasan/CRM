package com.arudra.crm.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private CustomUserDetailsService customUserDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");
        String token = null;
        String username = null;

        if ((authHeader == null || !authHeader.startsWith("Bearer ")) && request.getRequestURI().contains("/api/files/")) {
            // <img>/<audio>/download links can't send a header: private files accept the HttpOnly
            // access-token cookie that is scoped to /api/files (AuthCookies.FILES).
            String cookieToken = AuthCookies.read(request, AuthCookies.FILES);
            if (cookieToken != null) authHeader = "Bearer " + cookieToken;
        }
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
            if (token != null && !token.equals("null") && !token.trim().isEmpty()) {
                try {
                    username = jwtUtil.extractUsername(token);
                } catch (Exception e) {
                    logger.warn("Failed to parse JWT token: " + e.getMessage());
                }
            }
        }

        if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            UserDetails userDetails = null;
            try {
                userDetails = customUserDetailsService.loadUserByUsername(username);
            } catch (UsernameNotFoundException e) {
                // Account deleted since the token was issued — treat the request as anonymous.
            }

            try {
                // A disabled (deactivated / deleted employee) or locked account loses access on
                // its very next request, not when its token happens to expire.
                if (userDetails != null && userDetails.isEnabled() && userDetails.isAccountNonLocked()
                        && jwtUtil.validateToken(token, userDetails)) {
                    if (mustChangePasswordFirst(userDetails, request)) {
                        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                        response.setContentType("application/json");
                        response.getWriter().write("{\"success\":false,\"code\":\"PASSWORD_CHANGE_REQUIRED\","
                                + "\"message\":\"Please set a new password before continuing.\"}");
                        return;
                    }
                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            userDetails, null, userDetails.getAuthorities());
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            } catch (Exception e) {
                logger.warn("Failed to validate JWT token: " + e.getMessage());
            }
        }
        filterChain.doFilter(request, response);
    }

    /**
     * Staff given a temporary password may only call the auth endpoints (change password, logout)
     * until they set their own. Website customers are exempt: the public site has no change screen.
     */
    private boolean mustChangePasswordFirst(UserDetails userDetails, HttpServletRequest request) {
        if (!(userDetails instanceof AppUserDetails app) || !app.isMustChangePassword()) return false;
        boolean customer = userDetails.getAuthorities().stream()
                .anyMatch(a -> "ROLE_CUSTOMER".equals(a.getAuthority()));
        if (customer) return false;
        String path = request.getRequestURI();
        return !(path.contains("/api/auth/") || path.endsWith("/api/employee-portal/change-password"));
    }
}
