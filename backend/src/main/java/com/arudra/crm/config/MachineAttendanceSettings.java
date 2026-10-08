package com.arudra.crm.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** app.attendance.machine.* — fingerprint-machine punch rules. */
@Component
public class MachineAttendanceSettings {

    private final int duplicateTapSeconds;
    private final int maxShiftHours;
    private final int offlineAlertMinutes;

    public MachineAttendanceSettings(
            @Value("${app.attendance.machine.duplicate-tap-seconds:120}") int duplicateTapSeconds,
            @Value("${app.attendance.machine.max-shift-hours:12}") int maxShiftHours,
            @Value("${app.attendance.machine.offline-alert-minutes:30}") int offlineAlertMinutes) {
        this.duplicateTapSeconds = Math.max(0, duplicateTapSeconds);
        this.maxShiftHours = Math.max(1, maxShiftHours);
        this.offlineAlertMinutes = Math.max(5, offlineAlertMinutes);
    }

    /** A second touch by the same person within this many seconds is ignored. */
    public int getDuplicateTapSeconds() { return duplicateTapSeconds; }

    /** A punch after midnight closes the previous day's open session if within this many hours. */
    public int getMaxShiftHours() { return maxShiftHours; }

    /** Admins are alerted when a machine hasn't reported for this long. */
    public int getOfflineAlertMinutes() { return offlineAlertMinutes; }
}
