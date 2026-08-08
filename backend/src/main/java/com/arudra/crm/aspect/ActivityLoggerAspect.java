package com.arudra.crm.aspect;

import com.arudra.crm.annotation.LogActivity;
import com.arudra.crm.entity.ActivityLog;
import com.arudra.crm.service.ActivityLogService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

@Aspect
@Component
@RequiredArgsConstructor
public class ActivityLoggerAspect {

    private final ActivityLogService activityLogService;

    @Around("@annotation(logActivity)")
    public Object logExecutionTime(ProceedingJoinPoint joinPoint, LogActivity logActivity) throws Throwable {
        
        // Capture context before proceeding (as it might be lost in async threads)
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = (auth != null) ? auth.getName() : "system";
        String role = (auth != null && !auth.getAuthorities().isEmpty()) ? auth.getAuthorities().iterator().next().getAuthority() : "UNKNOWN";
        
        String tempIp = "unknown";
        String tempBrowser = "unknown";
        String requestId = UUID.randomUUID().toString();
        
        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attributes != null) {
            HttpServletRequest request = attributes.getRequest();
            tempIp = request.getRemoteAddr();
            tempBrowser = request.getHeader("User-Agent");
        }
        
        final String ipAddress = tempIp;
        final String browser = tempBrowser;

        // Execute the method
        Object result = joinPoint.proceed();
        
        // Find Entity ID from the result (if possible) or arguments
        Long entityId = extractEntityId(result, joinPoint.getArgs());

        // Asynchronously save log
        CompletableFuture.runAsync(() -> {
            ActivityLog log = new ActivityLog();
            log.setModule(logActivity.module());
            log.setAction(logActivity.action());
            log.setEntityName(logActivity.module()); // Simplified for now
            log.setEntityId(entityId);
            log.setPerformedBy(username);
            log.setPerformedRole(role);
            log.setPerformedAt(LocalDateTime.now());
            log.setIpAddress(ipAddress);
            log.setBrowser(browser);
            log.setRequestId(requestId);
            
            activityLogService.saveLog(log);
        });

        return result;
    }
    
    private Long extractEntityId(Object result, Object[] args) {
        // Very basic extraction strategy.
        // In reality, this would use reflection to find getId() on the result or args.
        try {
            if (result != null) {
                return (Long) result.getClass().getMethod("getId").invoke(result);
            }
        } catch (Exception e) {
            // Ignore
        }
        return 0L;
    }
}
