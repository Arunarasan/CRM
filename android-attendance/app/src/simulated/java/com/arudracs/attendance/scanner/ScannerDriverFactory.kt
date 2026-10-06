package com.arudracs.attendance.scanner

import android.content.Context
import com.arudracs.attendance.core.biometric.CaptureFailure
import com.arudracs.attendance.core.biometric.CaptureResult
import com.arudracs.attendance.core.biometric.ScannerDriver
import com.arudracs.attendance.core.biometric.ScannerInfo
import com.arudracs.attendance.core.biometric.ScannerStatus
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit

/**
 * Flavour "simulated": a software scanner for testing the kiosk flow on any phone/emulator without
 * hardware. The UI shows "Simulate finger 1–5" buttons that feed [SimulatedScanner.press].
 * The build refuses to produce a release APK of this flavour (see app/build.gradle.kts).
 */
object ScannerDriverFactory {
    fun create(@Suppress("UNUSED_PARAMETER") context: Context): ScannerDriver = SimulatedScanner

    /** "Place finger n" buttons on the kiosk in this flavour. */
    val debugPress: ((Int) -> Unit)? = SimulatedScanner::press
}

object SimulatedScanner : ScannerDriver {
    override val vendorId = "SIMULATED"
    override val matchThreshold = 50
    private val presses = LinkedBlockingQueue<Int>()

    fun press(finger: Int) { presses.offer(finger) }

    override fun open() = ScannerStatus.CONNECTED
    override fun close() {}
    override fun status() = ScannerStatus.CONNECTED
    override fun info() = ScannerInfo("Simulated", "SIM-1", "SIM-0001")
    override fun capture(timeoutMs: Int): CaptureResult {
        val f = presses.poll(timeoutMs.toLong(), TimeUnit.MILLISECONDS)
            ?: return CaptureResult.Error(CaptureFailure.TIMEOUT, "No finger")
        if (f < 0) return CaptureResult.Error(CaptureFailure.CANCELLED, "Cancelled")
        return CaptureResult.Ok(byteArrayOf(0x46, 0x4D, 0x52, f.toByte()), 85)
    }
    override fun match(probe: ByteArray, gallery: ByteArray) = if (probe.contentEquals(gallery)) 100 else 5
    override fun cancel() { presses.offer(-1) }
}
