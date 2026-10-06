package com.arudracs.attendance.core.sync

import com.arudracs.attendance.core.api.DeviceRejectedException
import com.arudracs.attendance.core.api.PunchRequest
import com.arudracs.attendance.core.api.PunchResult
import com.arudracs.attendance.core.api.SyncRequest
import com.arudracs.attendance.core.api.TerminalApi
import com.arudracs.attendance.core.api.TransportException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Uploads the offline queue in chronological batches.
 *  - accepted (CHECK_IN / CHECK_OUT / ALREADY_*) or REJECTED → removed (the server has a final answer and
 *    logged it; a rejected punch is visible to HR in the device activity trail);
 *  - RETRY or no result for a key → kept for the next run;
 *  - network failure → stop, keep everything; DeviceRejectedException → propagate (device blocked).
 */
class OfflineSyncer(
    private val queue: PunchQueue,
    private val api: TerminalApi,
    private val batchSize: Int = 50,
    private val onResult: (PendingPunch, com.arudracs.attendance.core.api.PunchResponse) -> Unit = { _, _ -> },
) {
    private val running = Mutex()

    data class Report(val sent: Int, val settled: Int, val rejected: Int, val remaining: Int, val error: String?)

    @Throws(DeviceRejectedException::class)
    suspend fun syncOnce(): Report = running.withLock {
        var sent = 0
        var settled = 0
        var rejected = 0
        var error: String? = null
        while (true) {
            val batch = queue.pending(batchSize)
            if (batch.isEmpty()) break
            val response = try {
                api.sync(SyncRequest(batch.map { it.toRequest() }))
            } catch (e: TransportException) {
                error = e.message
                queue.markAttempt(batch.map { it.idempotencyKey }, e.message)
                break
            }
            sent += batch.size
            val byKey = response.results.associateBy { it.idempotencyKey }
            val done = mutableListOf<String>()
            val retry = mutableListOf<String>()
            for (p in batch) {
                val r = byKey[p.idempotencyKey]
                if (r == null || r.result == PunchResult.RETRY) {
                    retry += p.idempotencyKey
                } else {
                    done += p.idempotencyKey
                    if (r.result == PunchResult.REJECTED) rejected++
                    onResult(p, r)
                }
            }
            queue.remove(done)
            settled += done.size
            if (retry.isNotEmpty()) {
                queue.markAttempt(retry, "Server asked to retry")
                break // don't spin on a record the server can't take right now
            }
        }
        Report(sent, settled, rejected, queue.count(), error)
    }

    private fun PendingPunch.toRequest() = PunchRequest(
        employeeId = employeeId, employeeCode = employeeCode, idempotencyKey = idempotencyKey,
        capturedAt = capturedAt, timeSource = timeSource, offline = true, matchScore = matchScore,
        identification = identification, action = action,
    )
}
