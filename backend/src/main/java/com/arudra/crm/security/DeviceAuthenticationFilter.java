package com.arudra.crm.security;

import com.arudra.crm.entity.AttendanceDevice;
import com.arudra.crm.entity.AttendanceDeviceStatus;
import com.arudra.crm.repository.AttendanceDeviceRepository;
import com.arudra.crm.service.DeviceCredentialService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Authenticates attendance terminals on {@code /api/device/**} using {@code Authorization: Device <token>}.
 *
 * Every request re-checks the device row (not just the token), so blocking or revoking a device takes
 * effect on its very next call:
 *   device exists ∧ status ACTIVE ∧ token credential-version == device credential-version
 *   ∧ token device-uuid == device uuid ∧ device has a branch and an attendance location.
 *
 * The filter only acts on device paths and only grants {@link DevicePrincipal#AUTHORITY}, so a device
 * token can never reach a user endpoint (and user JWTs never satisfy the device endpoints' authority).
 */
@Component
public class DeviceAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(DeviceAuthenticationFilter.class);
    public static final String DEVICE_PATH = "/api/device/";
    private static final String SCHEME = "Device ";

    private final DeviceCredentialService credentialService;
    private final AttendanceDeviceRepository deviceRepository;
    private final ObjectMapper objectMapper;

    public DeviceAuthenticationFilter(DeviceCredentialService credentialService,
                                      AttendanceDeviceRepository deviceRepository,
                                      ObjectMapper objectMapper) {
        this.credentialService = credentialService;
        this.deviceRepository = deviceRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return !path.startsWith(DEVICE_PATH);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith(SCHEME)) {
            chain.doFilter(request, response); // public device endpoints, or rejected by the authority rule
            return;
        }
        String token = header.substring(SCHEME.length()).trim();

        DeviceCredentialService.DeviceTokenClaims claims;
        try {
            claims = credentialService.parseToken(token);
        } catch (Exception e) {
            reject(request, response, 401, "TOKEN_INVALID", "Device token is invalid or expired.");
            return;
        }

        AttendanceDevice device = deviceRepository.findByIdAndIsDeletedFalse(claims.deviceId()).orElse(null);
        if (device == null || device.getDeviceUuid() == null || !device.getDeviceUuid().equals(claims.deviceUuid())) {
            reject(request, response, 401, "DEVICE_UNKNOWN", "This device is not registered.");
            return;
        }
        if (!AttendanceDeviceStatus.ACTIVE.equals(device.getStatus())) {
            reject(request, response, 403, "DEVICE_" + device.getStatus(),
                    "This attendance device is " + device.getStatus().toLowerCase() + ".");
            return;
        }
        if (device.getCredentialVersion() == null || device.getCredentialVersion() != claims.credentialVersion()) {
            reject(request, response, 401, "CREDENTIAL_REVOKED", "Device credential has been replaced or revoked.");
            return;
        }
        if (device.getBranch() == null || device.getLocation() == null) {
            reject(request, response, 403, "DEVICE_UNASSIGNED", "Device is not assigned to a branch and attendance location.");
            return;
        }

        DevicePrincipal principal = new DevicePrincipal(device.getId(), device.getDeviceCode());
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority(DevicePrincipal.AUTHORITY)));
        SecurityContextHolder.getContext().setAuthentication(auth);
        chain.doFilter(request, response);
    }

    private void reject(HttpServletRequest request, HttpServletResponse response, int status, String code, String message)
            throws IOException {
        log.warn("Device auth rejected {} {} from {}: {}", request.getMethod(), request.getRequestURI(),
                request.getRemoteAddr(), code);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", LocalDateTime.now().toString());
        body.put("status", status);
        body.put("error", code);
        body.put("message", message);
        body.put("path", request.getRequestURI());
        response.setStatus(status);
        response.setContentType("application/json");
        objectMapper.writeValue(response.getOutputStream(), body);
    }
}
