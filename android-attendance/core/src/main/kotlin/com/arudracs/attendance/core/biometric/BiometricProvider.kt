package com.arudracs.attendance.core.biometric

/**
 * Vendor-neutral biometric contract used by the whole terminal. The attendance flow, enrollment UI and
 * sync code only ever talk to this interface, so the scanner manufacturer can be swapped by providing a
 * different implementation (or, for USB scanners, just a different [ScannerDriver]).
 *
 * Privacy contract for every implementation:
 *  - never persist or transmit fingerprint IMAGES;
 *  - templates stay on the terminal (encrypted at rest) and matching happens on the terminal;
 *  - only the opaque [Enrollment.templateRef] and an employee id ever leave the device.
 */
interface BiometricProvider {

    /** Stable id reported to the server with each enrollment, e.g. "EXTERNAL_SCANNER:MANTRA_MFS100". */
    val providerId: String

    /** Captures [EnrollmentPolicy.captures] samples, checks quality/consistency/duplicates and stores the template. */
    suspend fun enrollEmployee(request: EnrollmentRequest, onProgress: (EnrollmentProgress) -> Unit = {}): EnrollmentResult

    /** 1:N — "who is this?" against every template on the terminal. */
    suspend fun identifyEmployee(timeoutMs: Int = 10_000): IdentifyResult

    /** 1:1 — "is this employee X?" (employee typed their ID / was selected first). */
    suspend fun verifyEmployee(employeeId: Long, timeoutMs: Int = 10_000): VerifyResult

    /** Deletes every local template of the employee. Returns how many were removed. */
    suspend fun deleteEmployee(employeeId: Long): Int

    /** Deletes one template by reference (server revoked it). */
    suspend fun deleteTemplate(templateRef: String): Boolean

    fun getScannerStatus(): ScannerStatus

    /** Aborts a capture in progress (screen left, timeout). */
    fun cancelCapture()
}

enum class ScannerStatus { CONNECTED, DISCONNECTED, PERMISSION_DENIED, ERROR, UNKNOWN }

enum class FingerPosition {
    RIGHT_THUMB, RIGHT_INDEX, RIGHT_MIDDLE, RIGHT_RING, RIGHT_LITTLE,
    LEFT_THUMB, LEFT_INDEX, LEFT_MIDDLE, LEFT_RING, LEFT_LITTLE;

    companion object {
        fun parse(value: String?): FingerPosition = entries.firstOrNull { it.name == value } ?: RIGHT_INDEX
    }
}

data class EnrollmentRequest(
    val employeeId: Long,
    val employeeCode: String,
    val employeeName: String,
    val finger: FingerPosition,
)

sealed interface EnrollmentProgress {
    data class PlaceFinger(val sample: Int, val of: Int) : EnrollmentProgress
    data object LiftFinger : EnrollmentProgress
    data class SampleAccepted(val sample: Int, val quality: Int) : EnrollmentProgress
    data class SampleRejected(val sample: Int, val reason: String) : EnrollmentProgress
}

sealed interface EnrollmentResult {
    data class Success(val enrollment: Enrollment) : EnrollmentResult
    data class Failure(val reason: EnrollmentFailure, val message: String) : EnrollmentResult
}

enum class EnrollmentFailure { SCANNER_UNAVAILABLE, TIMEOUT, LOW_QUALITY, INCONSISTENT_SAMPLES, ALREADY_ENROLLED_OTHER, CANCELLED, ERROR }

/** What leaves the device after enrollment: a reference, never the template. */
data class Enrollment(
    val templateRef: String,
    val employeeId: Long,
    val finger: FingerPosition,
    val quality: Int,
    val providerId: String,
)

sealed interface IdentifyResult {
    data class Match(val employeeId: Long, val employeeCode: String, val employeeName: String, val score: Int, val templateRef: String) : IdentifyResult
    /** A finger was read but matched nobody (or the best match was ambiguous). */
    data object NoMatch : IdentifyResult
    data class Failed(val reason: CaptureFailure, val message: String) : IdentifyResult
}

sealed interface VerifyResult {
    data class Verified(val score: Int, val templateRef: String) : VerifyResult
    data object Rejected : VerifyResult
    data object NotEnrolled : VerifyResult
    data class Failed(val reason: CaptureFailure, val message: String) : VerifyResult
}

enum class CaptureFailure { SCANNER_UNAVAILABLE, TIMEOUT, LOW_QUALITY, CANCELLED, ERROR }
