package com.arudracs.attendance.core.api

/**
 * Terminal side of the ArudraCS device API (/api/device/...). Field names mirror the backend
 * DTOs in com.arudra.crm.dto.attendance.DeviceApi exactly (JSON is mapped by name).
 * The Android app implements this with Retrofit; tests use fakes.
 *
 * Errors: implementations throw [TransportException] when the server could not be reached (the
 * caller should queue offline) and [DeviceRejectedException] when the server refused the device
 * itself (blocked / revoked / bad credential) — the terminal must stop recording immediately.
 */
interface TerminalApi {
    suspend fun registrationOptions(): RegistrationOptions
    suspend fun register(req: RegisterRequest): RegisterResponse
    suspend fun registrationStatus(req: RegistrationStatusRequest): RegistrationStatusResponse
    suspend fun token(req: TokenRequest): TokenResponse
    suspend fun heartbeat(req: HeartbeatRequest): HeartbeatResponse
    suspend fun lookupEmployee(code: String): TerminalEmployee
    suspend fun roster(): List<TerminalEmployee>
    suspend fun punch(req: PunchRequest): PunchResponse
    suspend fun sync(req: SyncRequest): SyncResponse
    suspend fun enrollments(): List<TerminalEnrollment>
    suspend fun startEnrollment(sessionId: Long): PendingEnrollment
    suspend fun completeEnrollment(sessionId: Long, req: EnrollmentCompleteRequest): TerminalEnrollment
    suspend fun failEnrollment(sessionId: Long, req: EnrollmentFailRequest)
}

class TransportException(message: String, cause: Throwable? = null) : Exception(message, cause)

/** [code] e.g. DEVICE_BLOCKED, DEVICE_REVOKED, CREDENTIAL_REVOKED, INVALID_CREDENTIAL, DEVICE_UNASSIGNED. */
class DeviceRejectedException(val code: String, message: String, val httpStatus: Int) : Exception(message)

/** A 4xx business error (validation, not found) with the server's message. */
class ApiErrorException(val code: String?, message: String, val httpStatus: Int) : Exception(message)

data class Option(val id: Long, val name: String)
data class LocationOption(val id: Long, val name: String, val branchId: Long?)
data class RegistrationOptions(val branches: List<Option>, val locations: List<LocationOption>)

data class RegisterRequest(
    val deviceUuid: String, val deviceName: String?, val branchId: Long?, val locationId: Long?, val pairingCode: String?,
    val appVersion: String?, val manufacturer: String?, val model: String?, val osVersion: String?,
    val scannerVendor: String?, val scannerModel: String?,
)
data class RegisterResponse(
    val registrationId: Long, val deviceCode: String?, val deviceName: String?, val status: String,
    val pollToken: String?, val deviceSecret: String?, val message: String?,
)
data class RegistrationStatusRequest(val registrationId: Long, val deviceUuid: String, val pollToken: String)
data class RegistrationStatusResponse(val status: String, val deviceCode: String?, val deviceName: String?, val deviceSecret: String?, val message: String?)

data class TokenRequest(val deviceUuid: String, val deviceSecret: String)
data class DeviceInfo(val id: Long, val code: String, val name: String, val branchId: Long?, val branchName: String?, val locationId: Long?, val locationName: String?)
data class TokenResponse(val accessToken: String, val expiresIn: Long, val serverTime: Long, val device: DeviceInfo)

data class HeartbeatRequest(
    val appVersion: String?, val scannerStatus: String?, val scannerVendor: String?, val scannerModel: String?,
    val scannerSerial: String?, val pendingSyncCount: Int?, val osVersion: String?, val deviceTime: Long?,
)
data class DeviceConfig(val heartbeatIntervalSeconds: Int, val minCheckoutGapMinutes: Int, val maxOfflineHours: Int, val successScreenSeconds: Int, val timeZone: String)
data class PendingEnrollment(
    val sessionId: Long, val employeeId: Long, val employeeCode: String, val employeeName: String,
    val fingerPosition: String?, val status: String, val expiresAt: String?,
)
data class HeartbeatResponse(
    val serverTime: Long, val status: String, val config: DeviceConfig, val pendingEnrollment: PendingEnrollment?,
    val enrollmentsRevision: String, val device: DeviceInfo,
)

data class TerminalEmployee(val id: Long, val code: String, val name: String, val enrolled: Boolean)

data class PunchRequest(
    val employeeId: Long?, val employeeCode: String?, val idempotencyKey: String, val capturedAt: Long?,
    val timeSource: String?, val offline: Boolean, val matchScore: Int?, val identification: String?, val action: String,
)
data class PunchResponse(
    val result: String, val message: String?, val accepted: Boolean, val duplicate: Boolean, val flagged: Boolean,
    val employeeId: Long?, val employeeCode: String?, val employeeName: String?, val date: String?,
    val checkInTime: String?, val checkOutTime: String?, val workingMinutes: Int?, val lateMinutes: Int?,
    val overtimeMinutes: Int?, val status: String?, val punchTime: String?, val idempotencyKey: String?,
)
data class SyncRequest(val punches: List<PunchRequest>)
data class SyncResponse(val results: List<PunchResponse>, val serverTime: Long)

data class TerminalEnrollment(val biometricId: Long, val employeeId: Long, val employeeCode: String, val employeeName: String, val templateRef: String, val fingerPosition: String?)
data class EnrollmentCompleteRequest(val templateRef: String, val provider: String, val fingerPosition: String, val qualityScore: Int)
data class EnrollmentFailRequest(val reason: String)

object PunchResult {
    const val CHECK_IN = "CHECK_IN"
    const val CHECK_OUT = "CHECK_OUT"
    const val ALREADY_CHECKED_IN = "ALREADY_CHECKED_IN"
    const val ALREADY_CHECKED_OUT = "ALREADY_CHECKED_OUT"
    const val REJECTED = "REJECTED"
    /** Sync only: transient server failure, keep the record and retry. */
    const val RETRY = "RETRY"
}
