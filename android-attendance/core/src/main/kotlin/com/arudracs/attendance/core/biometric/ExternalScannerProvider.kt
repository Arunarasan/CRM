package com.arudracs.attendance.core.biometric

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.security.SecureRandom

/**
 * [BiometricProvider] for an external USB fingerprint scanner. Vendor specifics live in [driver];
 * this class implements the parts every scanner shares:
 *
 *  enrol    — N captures; each must reach [EnrollmentPolicy.minQuality]; every later sample must match
 *             the first (same finger, placed consistently); the finger must not already belong to another
 *             employee; the best-quality template is stored under a fresh random reference.
 *  identify — one capture, matched against every stored template (1:N). The highest score wins only if
 *             it reaches the driver threshold and clearly beats every other employee's best score.
 *  verify   — one capture, matched only against the claimed employee's templates (1:N with N = their fingers).
 *
 * The scanner is single-user hardware, so every capture is serialised with a mutex.
 */
class ExternalScannerProvider(
    private val driver: ScannerDriver,
    private val store: TemplateStore,
    private val policy: EnrollmentPolicy = EnrollmentPolicy(),
    private val io: CoroutineDispatcher = Dispatchers.IO,
    private val random: SecureRandom = SecureRandom(),
) : BiometricProvider {

    private val scanner = Mutex()

    override val providerId: String get() = "EXTERNAL_SCANNER:${driver.vendorId}"

    override fun getScannerStatus(): ScannerStatus = runCatching { driver.status() }.getOrDefault(ScannerStatus.ERROR)

    override fun cancelCapture() = driver.cancel()

    override suspend fun enrollEmployee(
        request: EnrollmentRequest,
        onProgress: (EnrollmentProgress) -> Unit,
    ): EnrollmentResult = scanner.withLock {
        withContext(io) {
            if (!ensureOpen()) return@withContext EnrollmentResult.Failure(EnrollmentFailure.SCANNER_UNAVAILABLE, "Fingerprint scanner is not connected.")

            val samples = mutableListOf<CaptureResult.Ok>()
            for (n in 1..policy.captures) {
                var accepted: CaptureResult.Ok? = null
                var attempts = 0
                while (accepted == null) {
                    onProgress(EnrollmentProgress.PlaceFinger(n, policy.captures))
                    when (val c = driver.capture(policy.captureTimeoutMs)) {
                        is CaptureResult.Error -> return@withContext EnrollmentResult.Failure(
                            when (c.reason) {
                                CaptureFailure.TIMEOUT -> EnrollmentFailure.TIMEOUT
                                CaptureFailure.CANCELLED -> EnrollmentFailure.CANCELLED
                                CaptureFailure.SCANNER_UNAVAILABLE -> EnrollmentFailure.SCANNER_UNAVAILABLE
                                else -> EnrollmentFailure.ERROR
                            }, c.message)
                        is CaptureResult.Ok -> {
                            val reason = when {
                                c.quality < policy.minQuality -> "Low quality (${c.quality}). Press the finger flat and still."
                                samples.isNotEmpty() && driver.match(c.template, samples.first().template) < driver.matchThreshold ->
                                    "That did not match the first scan — use the same finger."
                                else -> null
                            }
                            if (reason == null) {
                                accepted = c
                                onProgress(EnrollmentProgress.SampleAccepted(n, c.quality))
                            } else {
                                onProgress(EnrollmentProgress.SampleRejected(n, reason))
                                if (++attempts > policy.retriesPerSample) {
                                    val failure = if (c.quality < policy.minQuality) EnrollmentFailure.LOW_QUALITY else EnrollmentFailure.INCONSISTENT_SAMPLES
                                    return@withContext EnrollmentResult.Failure(failure, reason)
                                }
                            }
                        }
                    }
                }
                samples += accepted
                if (n < policy.captures) onProgress(EnrollmentProgress.LiftFinger)
            }

            val best = samples.maxBy { it.quality }

            // The same finger must not be enrolled for someone else (prevents buddy-punching by enrolment).
            val gallery = store.all()
            val clash = gallery.filter { it.employeeId != request.employeeId }
                .maxByOrNull { driver.match(best.template, it.template) }
            if (clash != null && driver.match(best.template, clash.template) >= driver.matchThreshold) {
                return@withContext EnrollmentResult.Failure(EnrollmentFailure.ALREADY_ENROLLED_OTHER,
                    "This fingerprint is already enrolled for ${clash.employeeName} (${clash.employeeCode}).")
            }

            val ref = newTemplateRef()
            store.save(StoredTemplate(ref, request.employeeId, request.employeeCode, request.employeeName,
                request.finger, best.quality, providerId, best.template))
            EnrollmentResult.Success(Enrollment(ref, request.employeeId, request.finger, best.quality, providerId))
        }
    }

    override suspend fun identifyEmployee(timeoutMs: Int): IdentifyResult = scanner.withLock {
        withContext(io) {
            if (!ensureOpen()) return@withContext IdentifyResult.Failed(CaptureFailure.SCANNER_UNAVAILABLE, "Fingerprint scanner is not connected.")
            val gallery = store.all()
            when (val c = driver.capture(timeoutMs)) {
                is CaptureResult.Error -> IdentifyResult.Failed(c.reason, c.message)
                is CaptureResult.Ok -> bestMatch(c.template, gallery)
            }
        }
    }

    override suspend fun verifyEmployee(employeeId: Long, timeoutMs: Int): VerifyResult = scanner.withLock {
        withContext(io) {
            val own = store.forEmployee(employeeId)
            if (own.isEmpty()) return@withContext VerifyResult.NotEnrolled
            if (!ensureOpen()) return@withContext VerifyResult.Failed(CaptureFailure.SCANNER_UNAVAILABLE, "Fingerprint scanner is not connected.")
            when (val c = driver.capture(timeoutMs)) {
                is CaptureResult.Error -> VerifyResult.Failed(c.reason, c.message)
                is CaptureResult.Ok -> {
                    val (tpl, score) = own.map { it to driver.match(c.template, it.template) }.maxBy { it.second }
                    if (score >= driver.matchThreshold) VerifyResult.Verified(score, tpl.templateRef) else VerifyResult.Rejected
                }
            }
        }
    }

    override suspend fun deleteEmployee(employeeId: Long): Int = withContext(io) { store.deleteEmployee(employeeId) }

    override suspend fun deleteTemplate(templateRef: String): Boolean = withContext(io) { store.delete(templateRef) }

    /** 1:N decision; exposed for tests. */
    internal fun bestMatch(probe: ByteArray, gallery: List<StoredTemplate>): IdentifyResult {
        if (gallery.isEmpty()) return IdentifyResult.NoMatch
        // Best score per employee (an employee may have several fingers enrolled).
        val perEmployee = gallery.map { it to driver.match(probe, it.template) }
            .filter { it.second >= 0 }
            .groupBy { it.first.employeeId }
            .mapValues { (_, list) -> list.maxBy { it.second } }
            .values.sortedByDescending { it.second }
        val top = perEmployee.firstOrNull() ?: return IdentifyResult.NoMatch
        if (top.second < driver.matchThreshold) return IdentifyResult.NoMatch
        val runnerUp = perEmployee.getOrNull(1)
        val margin = policy.ambiguityMargin
        if (runnerUp != null && runnerUp.second >= driver.matchThreshold
            && (margin == null || top.second - runnerUp.second < margin)) {
            return IdentifyResult.NoMatch // two different people both match: refuse rather than guess
        }
        val t = top.first
        return IdentifyResult.Match(t.employeeId, t.employeeCode, t.employeeName, top.second, t.templateRef)
    }

    private fun ensureOpen(): Boolean {
        val s = runCatching { driver.status() }.getOrDefault(ScannerStatus.ERROR)
        if (s == ScannerStatus.CONNECTED) return true
        return runCatching { driver.open() }.getOrDefault(ScannerStatus.ERROR) == ScannerStatus.CONNECTED
    }

    private fun newTemplateRef(): String {
        val b = ByteArray(16).also(random::nextBytes)
        return "tpl_" + b.joinToString("") { "%02x".format(it) }
    }
}
