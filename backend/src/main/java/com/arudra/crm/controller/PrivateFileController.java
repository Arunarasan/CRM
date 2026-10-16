package com.arudra.crm.controller;

import com.arudra.crm.entity.User;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.storage.PrivateFileStore;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.file.NoSuchFileException;
import java.util.Map;
import java.util.Set;

/**
 * Serves sensitive uploads ({@link PrivateFileStore}) to signed-in staff only. Authentication is the
 * normal Bearer token or the HttpOnly {@code crm_ft} cookie (so plain {@code <img>}/{@code <audio>}
 * tags work). Who may read: the uploader, admins, and holders of the module's read permission.
 */
@RestController
public class PrivateFileController {

    /** module → authorities that may read any file of that module (besides admin and the uploader). */
    private static final Map<String, Set<String>> READERS = Map.of(
            "CALL_RECORDING", Set.of("LEAD_READ", "EMPLOYEE_TASK_READ"),
            "KIOSK", Set.of("WORKFORCE_READ", "PAYROLL_READ"),
            "EMPLOYEE_DOC", Set.of("WORKFORCE_READ"),
            "HR_DOCUMENT", Set.of("WORKFORCE_READ"),
            "PAYMENT", Set.of("FINANCE_READ", "PROJECT_READ", "ROLE_ACCOUNTS"),
            "FINANCE", Set.of("FINANCE_READ", "ROLE_ACCOUNTS"),
            "CUSTOMER", Set.of("CUSTOMER_READ"));

    private final PrivateFileStore store;
    private final CurrentUserService currentUserService;

    public PrivateFileController(PrivateFileStore store, CurrentUserService currentUserService) {
        this.store = store;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/api/files/private/**")
    public void serve(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String key = PrivateFileStore.keyFromUrl(request.getRequestURI());
        if (key.contains("..") || !mayRead(key)) {
            response.sendError(HttpServletResponse.SC_NOT_FOUND); // don't reveal that the file exists
            return;
        }
        byte[] bytes;
        try {
            bytes = store.read(key);
        } catch (NoSuchFileException e) {
            response.sendError(HttpServletResponse.SC_NOT_FOUND);
            return;
        }
        String type = MediaTypeFactory.getMediaType(key).orElse(MediaType.APPLICATION_OCTET_STREAM).toString();
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
        response.setHeader("Cache-Control", "private, max-age=300");
        response.setHeader("Accept-Ranges", "bytes");
        response.setContentType(type);

        // Single byte range, so <audio>/<video> can seek.
        String range = request.getHeader("Range");
        int start = 0, end = bytes.length - 1;
        if (range != null && range.startsWith("bytes=") && !range.contains(",")) {
            try {
                String[] p = range.substring(6).split("-", -1);
                if (!p[0].isEmpty()) {
                    start = Integer.parseInt(p[0]);
                    if (!p[1].isEmpty()) end = Math.min(end, Integer.parseInt(p[1]));
                } else if (!p[1].isEmpty()) {
                    start = Math.max(0, bytes.length - Integer.parseInt(p[1]));
                }
                if (start > end || start >= bytes.length) {
                    response.setHeader("Content-Range", "bytes */" + bytes.length);
                    response.sendError(416);
                    return;
                }
                response.setStatus(206);
                response.setHeader("Content-Range", "bytes " + start + "-" + end + "/" + bytes.length);
            } catch (NumberFormatException ignored) {
                start = 0;
                end = bytes.length - 1;
            }
        }
        response.setContentLength(end - start + 1);
        response.getOutputStream().write(bytes, start, end - start + 1);
    }

    private boolean mayRead(String key) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return false;
        Set<String> held = new java.util.HashSet<>();
        for (GrantedAuthority a : auth.getAuthorities()) held.add(a.getAuthority());
        if (held.contains("ROLE_ADMIN")) return true;

        Set<String> readers = READERS.get(PrivateFileStore.moduleOf(key));
        if (readers != null && readers.stream().anyMatch(held::contains)) return true;

        Long owner = PrivateFileStore.ownerOf(key);
        if (owner != null && owner != 0) {
            User me = currentUserService.getCurrentUser();
            return me != null && owner.equals(me.getId());
        }
        return false;
    }
}
