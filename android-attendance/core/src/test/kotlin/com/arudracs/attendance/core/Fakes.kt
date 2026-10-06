package com.arudracs.attendance.core

import com.arudracs.attendance.core.api.*
import com.arudracs.attendance.core.biometric.*
import com.arudracs.attendance.core.punch.LedgerDay
import com.arudracs.attendance.core.punch.LocalLedger
import com.arudracs.attendance.core.sync.PendingPunch
import com.arudracs.attendance.core.sync.PunchQueue
import com.arudracs.attendance.core.time.AnchorStore
import com.arudracs.attendance.core.time.ClockAnchor
import com.arudracs.attendance.core.time.ClockSource
import java.time.LocalDate

/** Templates are 1-byte "finger ids"; match = 100 when equal, 10 otherwise. */
class FakeDriver(var queue: ArrayDeque<CaptureResult> = ArrayDeque()) : ScannerDriver {
    override val vendorId = "FAKE"
    override val matchThreshold = 60
    var status = ScannerStatus.CONNECTED
    override fun open() = status
    override fun close() {}
    override fun status() = status
    override fun info() = ScannerInfo("Fake", "F1", "SN1")
    override fun capture(timeoutMs: Int): CaptureResult = queue.removeFirstOrNull() ?: CaptureResult.Error(CaptureFailure.TIMEOUT, "timeout")
    override fun match(probe: ByteArray, gallery: ByteArray) = if (probe.contentEquals(gallery)) 100 else 10
    override fun cancel() {}
    fun finger(id: Int, quality: Int = 80) = CaptureResult.Ok(byteArrayOf(id.toByte()), quality)
}

class MemoryTemplateStore : TemplateStore {
    val items = linkedMapOf<String, StoredTemplate>()
    override suspend fun save(template: StoredTemplate) { items[template.templateRef] = template }
    override suspend fun all() = items.values.toList()
    override suspend fun forEmployee(employeeId: Long) = items.values.filter { it.employeeId == employeeId }
    override suspend fun delete(templateRef: String) = items.remove(templateRef) != null
    override suspend fun deleteEmployee(employeeId: Long): Int {
        val refs = items.values.filter { it.employeeId == employeeId }.map { it.templateRef }
        refs.forEach(items::remove)
        return refs.size
    }
}

class MemoryQueue : PunchQueue {
    val items = mutableListOf<PendingPunch>()
    override suspend fun enqueue(punch: PendingPunch) { items += punch }
    override suspend fun pending(limit: Int) = items.sortedBy { it.capturedAt }.take(limit)
    override suspend fun remove(keys: Collection<String>) { items.removeAll { it.idempotencyKey in keys } }
    override suspend fun markAttempt(keys: Collection<String>, error: String?) {
        items.replaceAll { if (it.idempotencyKey in keys) it.copy(attempts = it.attempts + 1, lastError = error) else it }
    }
    override suspend fun count() = items.size
}

class MemoryLedger : LocalLedger {
    val days = mutableMapOf<Pair<Long, LocalDate>, LedgerDay>()
    override suspend fun get(employeeId: Long, date: LocalDate) = days[employeeId to date]
    override suspend fun put(day: LedgerDay) { days[day.employeeId to day.date] = day }
    override suspend fun purgeBefore(date: LocalDate) { days.keys.removeAll { it.second.isBefore(date) } }
}

class FakeClockSource(var elapsed: Long = 1_000, var boot: Int = 1, var wall: Long = 0) : ClockSource {
    override fun elapsedRealtimeMs() = elapsed
    override fun bootCount() = boot
    override fun wallClockMs() = wall
}

class MemoryAnchorStore(var anchor: ClockAnchor? = null) : AnchorStore {
    override fun load() = anchor
    override fun save(anchor: ClockAnchor) { this.anchor = anchor }
}

/** Configurable fake server. */
open class FakeApi : TerminalApi {
    var online = true
    val punches = mutableListOf<PunchRequest>()
    val synced = mutableListOf<PunchRequest>()
    var syncResult: (PunchRequest) -> String = { PunchResult.CHECK_IN }
    var serverEnrollments = mutableListOf<TerminalEnrollment>()
    var completeFails = false
    val completed = mutableListOf<EnrollmentCompleteRequest>()
    val failed = mutableListOf<String>()

    private fun net() { if (!online) throw TransportException("offline") }
    override suspend fun registrationOptions() = RegistrationOptions(emptyList(), emptyList())
    override suspend fun register(req: RegisterRequest) = TODO()
    override suspend fun registrationStatus(req: RegistrationStatusRequest) = TODO()
    override suspend fun token(req: TokenRequest) = TODO()
    override suspend fun heartbeat(req: HeartbeatRequest) = TODO()
    override suspend fun lookupEmployee(code: String) = TODO()
    override suspend fun roster() = emptyList<TerminalEmployee>()
    override suspend fun punch(req: PunchRequest): PunchResponse {
        net(); punches += req
        return resp(req, PunchResult.CHECK_IN, "2026-10-06", "09:05:00", null)
    }
    override suspend fun sync(req: SyncRequest): SyncResponse {
        net(); synced += req.punches
        return SyncResponse(req.punches.map { resp(it, syncResult(it), null, null, null) }, 0)
    }
    override suspend fun enrollments() = serverEnrollments.toList()
    override suspend fun startEnrollment(sessionId: Long) = PendingEnrollment(sessionId, 1, "E1", "Arun", "RIGHT_INDEX", "IN_PROGRESS", null)
    override suspend fun completeEnrollment(sessionId: Long, req: EnrollmentCompleteRequest): TerminalEnrollment {
        if (completeFails) throw TransportException("down")
        completed += req
        return TerminalEnrollment(1, 1, "E1", "Arun", req.templateRef, req.fingerPosition)
    }
    override suspend fun failEnrollment(sessionId: Long, req: EnrollmentFailRequest) { failed += req.reason }

    fun resp(r: PunchRequest, result: String, date: String?, inT: String?, outT: String?) = PunchResponse(
        result, result, result != PunchResult.REJECTED, false, false, r.employeeId, r.employeeCode, "Arun A",
        date, inT, outT, null, null, null, "PRESENT", null, r.idempotencyKey)
}
