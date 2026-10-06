package com.arudracs.attendance.core.biometric

import com.arudracs.attendance.core.api.EnrollmentCompleteRequest
import com.arudracs.attendance.core.api.EnrollmentFailRequest
import com.arudracs.attendance.core.api.PendingEnrollment
import com.arudracs.attendance.core.api.TerminalApi
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Keeps the terminal's templates in step with the server's enrollment references and runs
 * admin-initiated enrollments.
 *
 *  - [reconcile]: the server's list for this device is authoritative; any local template whose reference
 *    is not on it (revoked by HR, employee terminated, device re-registered) is deleted.
 *  - [enroll]: captures through the [BiometricProvider] and reports ONLY the template reference. If the
 *    server does not accept it, the local template is deleted again so the two sides never diverge.
 * Both share one lock so a reconcile can never delete a template that is mid-enrollment.
 */
class BiometricSync(
    private val provider: BiometricProvider,
    private val store: TemplateStore,
    private val api: TerminalApi,
) {
    private val lock = Mutex()

    suspend fun reconcile(): Int = lock.withLock {
        val wanted = api.enrollments().map { it.templateRef }.toSet()
        var removed = 0
        for (t in store.all()) {
            if (t.templateRef !in wanted && store.delete(t.templateRef)) removed++
        }
        removed
    }

    sealed interface Outcome {
        data class Enrolled(val employeeName: String, val quality: Int) : Outcome
        data class Failed(val message: String) : Outcome
    }

    suspend fun enroll(pending: PendingEnrollment, onProgress: (EnrollmentProgress) -> Unit): Outcome = lock.withLock {
        api.startEnrollment(pending.sessionId)
        val finger = FingerPosition.parse(pending.fingerPosition)
        val request = EnrollmentRequest(pending.employeeId, pending.employeeCode, pending.employeeName, finger)
        when (val r = provider.enrollEmployee(request, onProgress)) {
            is EnrollmentResult.Failure -> {
                runCatching { api.failEnrollment(pending.sessionId, EnrollmentFailRequest(r.message)) }
                Outcome.Failed(r.message)
            }
            is EnrollmentResult.Success -> {
                val e = r.enrollment
                try {
                    api.completeEnrollment(pending.sessionId,
                        EnrollmentCompleteRequest(e.templateRef, e.providerId, e.finger.name, e.quality))
                    Outcome.Enrolled(pending.employeeName, e.quality)
                } catch (ex: Exception) {
                    provider.deleteTemplate(e.templateRef) // server didn't take it: don't keep an orphan template
                    Outcome.Failed("Could not save the enrollment: ${ex.message ?: "server unavailable"}")
                }
            }
        }
    }
}
