package com.arudracs.attendance.core

import com.arudracs.attendance.core.time.TimeSource
import com.arudracs.attendance.core.time.TrustedClock
import kotlin.test.*

class TrustedClockTest {
    @Test
    fun usesDeviceClockUntilAnchored() {
        val src = FakeClockSource(elapsed = 5_000, wall = 123)
        val clock = TrustedClock(src, MemoryAnchorStore())
        assertEquals(TimeSource.DEVICE_CLOCK, clock.now().source)
        assertEquals(123, clock.now().epochMs)
    }

    @Test
    fun anchoredTimeIgnoresWallClockChanges() {
        val src = FakeClockSource(elapsed = 10_000, wall = 0)
        val clock = TrustedClock(src, MemoryAnchorStore())
        clock.anchor(serverEpochMs = 1_000_000, requestStartElapsedMs = 9_800, responseElapsedMs = 10_000) // mid = 9_900
        src.elapsed = 70_000
        src.wall = 999_999_999 // someone changed the device clock
        val t = clock.now()
        assertEquals(TimeSource.SERVER_ANCHORED, t.source)
        assertEquals(1_000_000 + (70_000 - 9_900), t.epochMs)
    }

    @Test
    fun rebootVoidsTheAnchorButItSurvivesAProcessRestart() {
        val store = MemoryAnchorStore()
        val src = FakeClockSource(elapsed = 1_000)
        TrustedClock(src, store).anchor(5_000_000, 1_000, 1_000)
        src.elapsed = 2_000
        assertTrue(TrustedClock(src, store).isAnchored()) // new process, same boot
        src.boot = 2; src.elapsed = 500; src.wall = 42
        val t = TrustedClock(src, store).now()
        assertEquals(TimeSource.DEVICE_CLOCK, t.source)
        assertEquals(42, t.epochMs)
    }
}
