package com.arudra.crm.service;

import com.arudra.crm.entity.ActivityLog;
import com.arudra.crm.entity.AttendanceDeviceEvent;
import com.arudra.crm.repository.AttendanceDeviceEventRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDateTime;

/**
 * Audit trail for the biometric attendance module. Writes to the shared {@code activity_logs} table
 * (module ATTENDANCE_DEVICE / BIOMETRIC — same table the @LogActivity aspect uses) and, for anything a
 * terminal did or had done to it, to the per-device {@code attendance_device_events} trail.
 */
@Service
public class AttendanceAuditService {

    public static final String MODULE_DEVICE = "ATTENDANCE_DEVICE";
    public static final String MODULE_BIOMETRIC = "BIOMETRIC";

    private final ActivityLogService activityLogService;
    private final AttendanceDeviceEventRepository eventRepository;

    public AttendanceAuditService(ActivityLogService activityLogService, AttendanceDeviceEventRepository eventRepository) {
        this.activityLogService = activityLogService;
        this.eventRepository = eventRepository;
    }

    /** Durable audit entry (own transaction, so it survives even if the caller later rolls back). */
    public void audit(String module, String action, Long entityId, String entityName, String description) {
        ActivityLog log = new ActivityLog();
        log.setModule(module);
        log.setAction(action);
        log.setEntityId(entityId == null ? 0L : entityId);
        log.setEntityName(entityName);
        log.setDescription(description);
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        log.setPerformedBy(actor());
        log.setPerformedRole(auth != null && !auth.getAuthorities().isEmpty()
                ? auth.getAuthorities().iterator().next().getAuthority() : "SYSTEM");
        log.setPerformedAt(LocalDateTime.now());
        HttpServletRequest req = currentRequest();
        if (req != null) {
            log.setIpAddress(clientIp(req));
            log.setBrowser(truncate(req.getHeader("User-Agent"), 255));
        }
        activityLogService.saveLog(log);
    }

    /** Appends to a device's activity trail (joins the caller's transaction). */
    public AttendanceDeviceEvent deviceEvent(Long deviceId, String type, String message, Long employeeId) {
        AttendanceDeviceEvent e = new AttendanceDeviceEvent();
        e.setDeviceId(deviceId);
        e.setEventType(type);
        e.setMessage(truncate(message, 500));
        e.setEmployeeId(employeeId);
        e.setActor(actor());
        HttpServletRequest req = currentRequest();
        e.setIpAddress(req == null ? null : clientIp(req));
        e.setOccurredAt(LocalDateTime.now());
        return eventRepository.save(e);
    }

    public String actor() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) return "anonymous";
        return auth.getName();
    }

    public static String clientIp(HttpServletRequest req) {
        // Behind the reverse proxy the real client is the first X-Forwarded-For hop.
        String xff = req.getHeader("X-Forwarded-For");
        String ip = xff != null && !xff.isBlank() ? xff.split(",")[0].trim() : req.getRemoteAddr();
        return truncate(ip, 64);
    }

    public static HttpServletRequest currentRequest() {
        var attrs = RequestContextHolder.getRequestAttributes();
        return attrs instanceof ServletRequestAttributes sra ? sra.getRequest() : null;
    }

    static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
