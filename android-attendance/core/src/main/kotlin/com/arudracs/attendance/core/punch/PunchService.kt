package com.arudracs.attendance.core.punch

import com.arudracs.attendance.core.api.ApiErrorException
import com.arudracs.attendance.core.api.PunchRequest
import com.arudracs.attendance.core.api.PunchResponse
import com.arudracs.attendance.core.api.PunchResult
import com.arudracs.attendance.core.api.TerminalApi
import com.arudracs.attendance.core.api.TransportException
import com.arudracs.attendance.core.sync.PendingPunch
import com.arudracs.attendance.core.sync.PunchQueue
import com.arudracs.attendance.core.time.TimeSource
import com.arudracs.attendance.core.time.TrustedClock
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.util.UUID

/**
 * Records a punch for an identified employee.
 *
 * Online: POST /attendance/punch — the server decides check-in vs check-out and returns the figures.
 * Offline (or the request fails in transit): the punch goes to the durable queue with the SAME
 * idempotency key, so if the lost request did reach the server, the later sync is a harmless replay.
 * While offline the on-screen answer comes from [LocalLedger], mirroring the server's rules.
 */
class PunchService(
    private val api: TerminalApi,
    private val queue: PunchQueue,
    private val ledger: LocalLedger,
    private val clock: TrustedClock,
    private val isOnline: () -> Boolean,
    private val zone: () -> ZoneId = { ZoneId.systemDefault() },
    private val minCheckoutGapMinutes: () -> Int = { 15 },
    private val newKey: () -> String = { UUID.randomUUID().toString() },
) {

    data class Identified(val employeeId: Long, val employeeCode: String, val employeeName: String, val matchScore: Int?, val identification: String)

    sealed interface Outcome {
        val employeeName: String
        data class Recorded(override val employeeName: String, val response: PunchResponse) : Outcome
        /** Stored for later sync. [result] is the local best guess (CHECK_IN / CHECK_OUT / ALREADY_*). */
        data class Queued(override val employeeName: String, val result: String, val at: Long, val checkInAt: Long?, val pending: Int) : Outcome
        data class Refused(override val employeeName: String, val message: String) : Outcome
    }

    suspend fun record(who: Identified, action: String = "AUTO"): Outcome {
        val key = newKey()
        val time = clock.now()
        if (isOnline()) {
            val req = PunchRequest(who.employeeId, who.employeeCode, key, time.epochMs, time.source.name,
                offline = false, matchScore = who.matchScore, identification = who.identification, action = action)
            try {
                val res = api.punch(req)
                remember(who.employeeId, res)
                return if (res.result == PunchResult.REJECTED) Outcome.Refused(who.employeeName, res.message ?: "Not accepted")
                else Outcome.Recorded(res.employeeName ?: who.employeeName, res)
            } catch (e: ApiErrorException) {
                return Outcome.Refused(who.employeeName, e.message ?: "Not accepted")
            } catch (_: TransportException) {
                // fall through to the offline path with the same key
            }
        }
        return queueOffline(who, key, time.epochMs, time.source, action)
    }

    private suspend fun queueOffline(who: Identified, key: String, at: Long, source: TimeSource, action: String): Outcome {
        val date = Instant.ofEpochMilli(at).atZone(zone()).toLocalDate()
        val day = ledger.get(who.employeeId, date)
        val result = when {
            day?.checkOutAt != null -> PunchResult.ALREADY_CHECKED_OUT
            day?.checkInAt != null && (action == "CHECK_IN" || at - day.checkInAt < minCheckoutGapMinutes() * 60_000L) -> PunchResult.ALREADY_CHECKED_IN
            day?.checkInAt != null -> PunchResult.CHECK_OUT
            action == "CHECK_OUT" -> return Outcome.Refused(who.employeeName, "No check-in found for today.")
            else -> PunchResult.CHECK_IN
        }
        // Repeats are answered locally; only real state changes are queued.
        if (result == PunchResult.CHECK_IN || result == PunchResult.CHECK_OUT) {
            queue.enqueue(PendingPunch(key, who.employeeId, who.employeeCode, who.employeeName, at, source.name,
                who.matchScore, who.identification, action))
            ledger.put(
                if (result == PunchResult.CHECK_IN) LedgerDay(who.employeeId, date, at, null)
                else day!!.copy(checkOutAt = at)
            )
        }
        return Outcome.Queued(who.employeeName, result, at, day?.checkInAt ?: at.takeIf { result == PunchResult.CHECK_IN }, queue.count())
    }

    /** Keeps the offline ledger in step with what the server decided. */
    suspend fun remember(employeeId: Long, res: PunchResponse) {
        val date = res.date?.let(LocalDate::parse) ?: return
        val z = zone()
        fun at(t: String?) = t?.let { LocalTime.parse(it).atDate(date).atZone(z).toInstant().toEpochMilli() }
        val inAt = at(res.checkInTime)
        var outAt = at(res.checkOutTime)
        if (inAt != null && outAt != null && outAt < inAt) outAt += 86_400_000L // overnight
        if (inAt != null || outAt != null) ledger.put(LedgerDay(employeeId, date, inAt, outAt))
    }
}
