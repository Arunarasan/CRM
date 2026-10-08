package com.arudra.crm.config;

import com.arudra.crm.entity.Employee;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Set;

/**
 * app.attendance.device-binding.* — attendance phone-binding policy, plus the effective
 * enforcement mode for an employee (their override, else the app default).
 */
@Component
public class DeviceBindingSettings {

    public static final String OFF = "OFF";
    public static final String SOFT = "SOFT";
    public static final String HARD = "HARD";
    private static final Set<String> MODES = Set.of(OFF, SOFT, HARD);

    private final String defaultMode;
    private final int maxDevicesPerUser;
    private final boolean autoApproveFirstDevice;
    private final int challengeTtlSeconds;

    public DeviceBindingSettings(
            @Value("${app.attendance.device-binding.default-mode:SOFT}") String defaultMode,
            @Value("${app.attendance.device-binding.max-devices-per-user:1}") int maxDevicesPerUser,
            @Value("${app.attendance.device-binding.auto-approve-first-device:true}") boolean autoApproveFirstDevice,
            @Value("${app.attendance.device-binding.challenge-ttl-seconds:120}") int challengeTtlSeconds) {
        this.defaultMode = normalize(defaultMode, SOFT);
        this.maxDevicesPerUser = Math.max(1, maxDevicesPerUser);
        this.autoApproveFirstDevice = autoApproveFirstDevice;
        this.challengeTtlSeconds = Math.max(30, challengeTtlSeconds);
    }

    /**
     * Employee override when set and valid, else the app default; non-employees use the default.
     * OFFICE_DEVICE employees punch on a shared office device (biometric-checked), which can't be
     * bound to each of them, so binding is OFF for them unless explicitly overridden.
     */
    public String effectiveMode(Employee employee) {
        if (employee == null) return defaultMode;
        if (isValidMode(employee.getDeviceBindingMode())) return normalize(employee.getDeviceBindingMode(), defaultMode);
        return "OFFICE_DEVICE".equals(employee.getAttendanceMethod()) ? OFF : defaultMode;
    }

    public static boolean isValidMode(String mode) {
        return mode != null && MODES.contains(mode.trim().toUpperCase(Locale.ROOT));
    }

    private static String normalize(String mode, String fallback) {
        return isValidMode(mode) ? mode.trim().toUpperCase(Locale.ROOT) : fallback;
    }

    public String getDefaultMode() { return defaultMode; }
    public int getMaxDevicesPerUser() { return maxDevicesPerUser; }
    public boolean isAutoApproveFirstDevice() { return autoApproveFirstDevice; }
    public int getChallengeTtlSeconds() { return challengeTtlSeconds; }
}
