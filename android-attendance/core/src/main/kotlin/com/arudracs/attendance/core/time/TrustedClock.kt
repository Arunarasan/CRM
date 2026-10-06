package com.arudracs.attendance.core.time

/**
 * Tamper-resistant time for punches.
 *
 * Whenever the terminal talks to the server it stores an anchor: (server epoch time, monotonic
 * elapsed-since-boot, boot count). Later — even offline — "now" is computed as
 *     server time at anchor + (elapsed now − elapsed at anchor)
 * The monotonic clock (Android SystemClock.elapsedRealtime) cannot be changed from Settings, so
 * moving the wall clock does not move attendance times. If the terminal rebooted since the anchor
 * (boot count changed / elapsed went backwards) the anchor is void and the device wall clock is used,
 * marked DEVICE_CLOCK so the server flags the punch for HR review.
 */
class TrustedClock(
    private val source: ClockSource,
    private val store: AnchorStore,
) {
    @Volatile private var anchor: ClockAnchor? = store.load()

    /**
     * Records a server time. [requestStartElapsedMs]/[responseElapsedMs] bracket the HTTP call; the
     * server stamped its time somewhere in between, so the midpoint halves the round-trip error.
     */
    fun anchor(serverEpochMs: Long, requestStartElapsedMs: Long, responseElapsedMs: Long) {
        val mid = requestStartElapsedMs + (responseElapsedMs - requestStartElapsedMs).coerceAtLeast(0) / 2
        val a = ClockAnchor(serverEpochMs, mid, source.bootCount())
        anchor = a
        store.save(a)
    }

    fun now(): TrustedTime {
        val a = anchor
        val elapsed = source.elapsedRealtimeMs()
        return if (a != null && a.bootCount == source.bootCount() && elapsed >= a.elapsedMs) {
            TrustedTime(a.serverEpochMs + (elapsed - a.elapsedMs), TimeSource.SERVER_ANCHORED)
        } else {
            TrustedTime(source.wallClockMs(), TimeSource.DEVICE_CLOCK)
        }
    }

    fun isAnchored(): Boolean = now().source == TimeSource.SERVER_ANCHORED

    /** Wall clock minus trusted time; a large value means someone changed the device clock. */
    fun wallClockSkewMs(): Long? = now().takeIf { it.source == TimeSource.SERVER_ANCHORED }?.let { source.wallClockMs() - it.epochMs }
}

interface ClockSource {
    /** Monotonic, includes deep sleep, resets only on reboot (SystemClock.elapsedRealtime). */
    fun elapsedRealtimeMs(): Long
    /** Increments on every boot (Settings.Global.BOOT_COUNT). */
    fun bootCount(): Int
    /** User-changeable wall clock — only a last resort. */
    fun wallClockMs(): Long
}

interface AnchorStore {
    fun load(): ClockAnchor?
    fun save(anchor: ClockAnchor)
}

data class ClockAnchor(val serverEpochMs: Long, val elapsedMs: Long, val bootCount: Int)

enum class TimeSource { SERVER_ANCHORED, DEVICE_CLOCK }

data class TrustedTime(val epochMs: Long, val source: TimeSource)
