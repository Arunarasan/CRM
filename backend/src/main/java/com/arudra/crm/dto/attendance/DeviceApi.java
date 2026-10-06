package com.arudra.crm.dto.attendance;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

/**
 * Request/response shapes of the attendance-terminal API ({@code /api/device/**}) and the device
 * admin API ({@code /api/hr/attendance-devices/**}). Grouped in one holder to keep the contract
 * readable in one place; the Android app mirrors these in its network layer.
 */
public final class DeviceApi {
    private DeviceApi() {}

    // --- registration (public, approval-gated) -----------------------------------------------

    public record RegisterRequest(String deviceUuid, String deviceName, Long branchId, Long locationId,
                                  String pairingCode, String appVersion, String manufacturer, String model,
                                  String osVersion, String scannerVendor, String scannerModel) {}

    /** {@code pollToken} is returned once and lets the device ask for its own status. {@code deviceSecret}
     *  is only present when the device was paired with an admin-issued code (pre-approved). */
    public record RegisterResponse(Long registrationId, String deviceCode, String deviceName, String status,
                                   String pollToken, String deviceSecret, String message) {}

    public record RegistrationStatusRequest(Long registrationId, String deviceUuid, String pollToken) {}

    /** {@code deviceSecret} is present once the device is ACTIVE and until it first exchanges it for a token. */
    public record RegistrationStatusResponse(String status, String deviceCode, String deviceName,
                                             String deviceSecret, String message) {}

    public record Option(Long id, String name) {}

    public record LocationOption(Long id, String name, Long branchId) {}

    public record RegistrationOptions(List<Option> branches, List<LocationOption> locations) {}

    // --- authentication -------------------------------------------------------------------

    public record TokenRequest(String deviceUuid, String deviceSecret) {}

    public record TokenResponse(String accessToken, long expiresIn, long serverTime, DeviceInfo device) {}

    public record DeviceInfo(Long id, String code, String name, Long branchId, String branchName,
                             Long locationId, String locationName) {}

    // --- heartbeat ------------------------------------------------------------------------

    public record HeartbeatRequest(String appVersion, String scannerStatus, String scannerVendor,
                                   String scannerModel, String scannerSerial, Integer pendingSyncCount,
                                   String osVersion, Long deviceTime) {}

    public record DeviceConfig(int heartbeatIntervalSeconds, int minCheckoutGapMinutes, int maxOfflineHours,
                               int successScreenSeconds, String timeZone) {}

    public record PendingEnrollment(Long sessionId, Long employeeId, String employeeCode, String employeeName,
                                    String fingerPosition, String status, LocalDateTime expiresAt) {}

    public record HeartbeatResponse(long serverTime, String status, DeviceConfig config,
                                    PendingEnrollment pendingEnrollment, String enrollmentsRevision, DeviceInfo device) {}

    // --- employees on the terminal ------------------------------------------------------------

    public record TerminalEmployee(Long id, String code, String name, boolean enrolled) {}

    // --- punches --------------------------------------------------------------------------

    /**
     * One punch from the terminal.
     * @param idempotencyKey unique per punch (UUID); a replay returns the original outcome
     * @param capturedAt     epoch millis from the terminal's trusted clock (ignored for online punches:
     *                       server time is used whenever the terminal is online)
     * @param timeSource     SERVER_ANCHORED (monotonic clock anchored to server time) or DEVICE_CLOCK
     * @param action         AUTO (decide check-in / check-out), CHECK_IN or CHECK_OUT
     * @param identification FINGERPRINT (1:N match) or EMPLOYEE_ID_FINGERPRINT (ID entered, 1:1 verify)
     */
    public record PunchRequest(Long employeeId, String employeeCode, String idempotencyKey, Long capturedAt,
                               String timeSource, Boolean offline, Integer matchScore, String identification,
                               String action) {}

    public record PunchResponse(String result, String message, boolean accepted, boolean duplicate, boolean flagged,
                                Long employeeId, String employeeCode, String employeeName, LocalDate date,
                                LocalTime checkInTime, LocalTime checkOutTime, Integer workingMinutes,
                                Integer lateMinutes, Integer overtimeMinutes, String status,
                                LocalDateTime punchTime, String idempotencyKey) {}

    public record SyncRequest(List<PunchRequest> punches) {}

    public record SyncResponse(List<PunchResponse> results, long serverTime) {}

    public record TodayStatus(Long employeeId, String employeeName, String state, LocalTime checkInTime,
                              LocalTime checkOutTime, Integer workingMinutes, String status) {}

    // --- biometric enrollment (terminal side) ---------------------------------------------------

    /** @param templateRef opaque handle of the template stored on the terminal — never the template. */
    public record EnrollmentCompleteRequest(String templateRef, String provider, String fingerPosition,
                                            Integer qualityScore) {}

    public record EnrollmentFailRequest(String reason) {}

    public record TerminalEnrollment(Long biometricId, Long employeeId, String employeeCode, String employeeName,
                                     String templateRef, String fingerPosition) {}

    // --- admin ------------------------------------------------------------------------------

    public record DeviceView(Long id, String deviceName, String deviceCode, String deviceUuid, String status,
                             String effectiveStatus, boolean online, Long branchId, String branchName,
                             Long locationId, String locationName, LocalDateTime lastSeenAt, String appVersion,
                             String scannerStatus, String scannerVendor, String scannerModel, String scannerSerial,
                             LocalDateTime registeredAt, String approvedBy, LocalDateTime approvedAt,
                             LocalDateTime lastSyncAt, Integer pendingSyncCount, String manufacturer, String model,
                             String osVersion, String lastIp, String statusReason, String statusChangedBy,
                             LocalDateTime statusChangedAt, long enrolledCount, boolean awaitingPairing,
                             LocalDateTime pairingExpiresAt, LocalDateTime credentialIssuedAt) {}

    public record AdminCreateRequest(String deviceName, Long branchId, Long locationId) {}

    public record AdminCreateResponse(DeviceView device, String pairingCode, LocalDateTime pairingExpiresAt) {}

    public record DeviceUpdateRequest(String deviceName, Long branchId, Long locationId) {}

    public record DeviceActionRequest(String reason, String deviceName, Long branchId, Long locationId) {}

    public record DeviceEventView(Long id, String eventType, String message, Long employeeId, String employeeName,
                                  String actor, String ipAddress, LocalDateTime occurredAt) {}
}
