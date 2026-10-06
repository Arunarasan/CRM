package com.arudracs.attendance.time

import android.content.ContentResolver
import android.os.SystemClock
import android.provider.Settings
import com.arudracs.attendance.core.time.ClockSource

/** Monotonic elapsed-realtime + boot counter — neither can be changed from the Settings app. */
class AndroidClockSource(private val resolver: ContentResolver) : ClockSource {
    override fun elapsedRealtimeMs(): Long = SystemClock.elapsedRealtime()
    override fun bootCount(): Int = Settings.Global.getInt(resolver, Settings.Global.BOOT_COUNT, -1)
    override fun wallClockMs(): Long = System.currentTimeMillis()
}
