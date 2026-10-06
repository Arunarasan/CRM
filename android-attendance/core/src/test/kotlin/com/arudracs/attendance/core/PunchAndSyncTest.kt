package com.arudracs.attendance.core

import com.arudracs.attendance.core.api.PunchResult
import com.arudracs.attendance.core.punch.PunchService
import com.arudracs.attendance.core.sync.OfflineSyncer
import com.arudracs.attendance.core.time.TrustedClock
import kotlinx.coroutines.test.runTest
import java.time.ZoneId
import kotlin.test.*

class PunchAndSyncTest {
    private val zone = ZoneId.of("Asia/Kolkata")
    private val api = FakeApi()
    private val queue = MemoryQueue()
    private val ledger = MemoryLedger()
    private val src = FakeClockSource(elapsed = 0)
    private val clock = TrustedClock(src, MemoryAnchorStore()).also {
        // 2026-10-06T09:00:00+05:30
        it.anchor(java.time.ZonedDateTime.of(2026, 10, 6, 9, 0, 0, 0, zone).toInstant().toEpochMilli(), 0, 0)
    }
    private var keys = 0
    private val service = PunchService(api, queue, ledger, clock, isOnline = { api.online }, zone = { zone },
        minCheckoutGapMinutes = { 15 }, newKey = { "key-${++keys}" })
    private val who = PunchService.Identified(1, "E1", "Arun A", 4200, "FINGERPRINT")

    @Test
    fun onlinePunchGoesStraightToTheServer() = runTest {
        val o = assertIs<PunchService.Outcome.Recorded>(service.record(who))
        assertEquals(PunchResult.CHECK_IN, o.response.result)
        assertEquals(1, api.punches.size)
        assertFalse(api.punches[0].offline)
        assertEquals(0, queue.count())
        assertNotNull(ledger.days.values.single().checkInAt) // ledger learns from the server
    }

    @Test
    fun offlineFlowQueuesDedupesAndSyncsChronologicallyWithIdempotencyKeys() = runTest {
        api.online = false
        assertEquals(PunchResult.CHECK_IN, assertIs<PunchService.Outcome.Queued>(service.record(who)).result)

        src.elapsed = 5 * 60_000 // 5 minutes later: within the gap → answered locally, not queued
        assertEquals(PunchResult.ALREADY_CHECKED_IN, assertIs<PunchService.Outcome.Queued>(service.record(who)).result)
        assertEquals(1, queue.count())

        src.elapsed = 9 * 3_600_000L // 18:00
        val out = assertIs<PunchService.Outcome.Queued>(service.record(who))
        assertEquals(PunchResult.CHECK_OUT, out.result)
        assertEquals(2, out.pending)

        src.elapsed += 60_000
        assertEquals(PunchResult.ALREADY_CHECKED_OUT, assertIs<PunchService.Outcome.Queued>(service.record(who)).result)
        assertEquals(2, queue.count())
        assertTrue(queue.items.all { it.timeSource == "SERVER_ANCHORED" })

        // Network back.
        api.online = true
        api.syncResult = { if (it.idempotencyKey == "key-1") PunchResult.CHECK_IN else PunchResult.CHECK_OUT }
        val report = OfflineSyncer(queue, api).syncOnce()
        assertEquals(2, report.settled)
        assertEquals(0, report.remaining)
        assertEquals(listOf("key-1", "key-3"), api.synced.map { it.idempotencyKey })
        assertTrue(api.synced.all { it.offline })
    }

    @Test
    fun transportFailureMidPunchQueuesWithTheSameKey() = runTest {
        val flaky = object : FakeApi() {
            override suspend fun punch(req: com.arudracs.attendance.core.api.PunchRequest) =
                throw com.arudracs.attendance.core.api.TransportException("timeout")
        }
        val s = PunchService(flaky, queue, ledger, clock, isOnline = { true }, zone = { zone }, newKey = { "same-key" })
        assertIs<PunchService.Outcome.Queued>(s.record(who))
        assertEquals("same-key", queue.items.single().idempotencyKey)
    }

    @Test
    fun syncKeepsRetryAndUnansweredRecordsAndStopsWhenOffline() = runTest {
        api.online = false
        service.record(who)
        val r1 = OfflineSyncer(queue, api).syncOnce()
        assertEquals(1, r1.remaining)
        assertNotNull(r1.error)
        assertEquals(1, queue.items.single().attempts)

        api.online = true
        api.syncResult = { PunchResult.RETRY }
        assertEquals(1, OfflineSyncer(queue, api).syncOnce().remaining)

        api.syncResult = { PunchResult.REJECTED }
        val r3 = OfflineSyncer(queue, api).syncOnce()
        assertEquals(1, r3.rejected)
        assertEquals(0, r3.remaining)
    }

    @Test
    fun checkOutWithoutCheckInIsRefusedOffline() = runTest {
        api.online = false
        assertIs<PunchService.Outcome.Refused>(service.record(who, action = "CHECK_OUT"))
        assertEquals(0, queue.count())
    }
}
