package com.arudracs.attendance.scanner

import android.content.Context
import android.os.SystemClock
import android.util.Log
import com.arudracs.attendance.core.biometric.CaptureFailure
import com.arudracs.attendance.core.biometric.CaptureResult
import com.arudracs.attendance.core.biometric.ScannerDriver
import com.arudracs.attendance.core.biometric.ScannerInfo
import com.arudracs.attendance.core.biometric.ScannerStatus
import com.mantra.mfs100.FingerData
import com.mantra.mfs100.MFS100
import com.mantra.mfs100.MFS100Event

/**
 * Mantra MFS100 (USB/OTG) driver over the Mantra "MFS100 Android SDK" (mantra.mfs100.jar +
 * libMFS100V9032.so per ABI). Uses the SDK's NON-RD template API — UIDAI RD Service only produces
 * encrypted PID blocks for Aadhaar authentication and cannot be used for local identification.
 *
 * SDK calls used (signatures verified against mantra.mfs100.jar):
 *   MFS100(MFS100Event), SetApplicationContext(Context), LoadFirmware(), Init(), UnInit(), Dispose(),
 *   IsConnected(), GetDeviceInfo(): DeviceInfo{SerialNo(), Make(), Model()},
 *   AutoCapture(FingerData, timeoutMs, detectFinger): Int (0 = OK),
 *   FingerData.ISOTemplate(): ByteArray (ISO/IEC 19794-2), FingerData.Quality(): Int,
 *   MatchISO(probe, gallery): Int score (< 0 = error), StopAutoCapture(), GetErrorMsg(code).
 * Mantra's reference integration treats a MatchISO score ≥ 96 as the same finger; it is the default
 * [matchThreshold] and can be raised for a stricter false-accept rate.
 *
 * Only the ISO template is read from FingerData — FingerImage()/RawData() are never touched or stored.
 */
class MantraMfs100Driver(context: Context, override val matchThreshold: Int = 96) : ScannerDriver {

    override val vendorId = "MANTRA_MFS100"

    @Volatile private var status = ScannerStatus.UNKNOWN
    @Volatile private var lastAttach = 0L
    private val sdk: MFS100

    private val events = object : MFS100Event {
        override fun OnDeviceAttached(vid: Int, pid: Int, hasPermission: Boolean) {
            if (SystemClock.elapsedRealtime() - lastAttach < 1500) return // the SDK fires attach twice
            lastAttach = SystemClock.elapsedRealtime()
            if (!hasPermission) { status = ScannerStatus.PERMISSION_DENIED; return }
            status = try {
                when {
                    // Unprogrammed (Cypress id): the SDK loads firmware, the device re-enumerates as 2C0F:1005.
                    (vid == VID_CYPRESS || vid == VID_MANTRA) && pid == PID_NEEDS_FIRMWARE ->
                        if (sdk.LoadFirmware() == 0) ScannerStatus.DISCONNECTED else ScannerStatus.ERROR
                    (vid == VID_CYPRESS || vid == VID_MANTRA) && pid == PID_READY ->
                        if (sdk.Init() == 0) ScannerStatus.CONNECTED else ScannerStatus.ERROR
                    else -> ScannerStatus.DISCONNECTED
                }
            } catch (t: Throwable) {
                Log.e(TAG, "MFS100 attach failed", t)
                ScannerStatus.ERROR
            }
        }

        override fun OnDeviceDetached() {
            runCatching { sdk.UnInit() }
            status = ScannerStatus.DISCONNECTED
        }

        override fun OnHostCheckFailed(err: String?) {
            Log.w(TAG, "MFS100 host check failed: $err")
            status = ScannerStatus.ERROR
        }
    }

    init {
        sdk = MFS100(events)
        sdk.SetApplicationContext(context.applicationContext) // registers the SDK's USB permission receiver
    }

    override fun open(): ScannerStatus {
        if (status == ScannerStatus.CONNECTED && sdk.IsConnected()) return status
        status = try {
            when {
                !sdk.IsConnected() -> ScannerStatus.DISCONNECTED
                sdk.Init() == 0 -> ScannerStatus.CONNECTED
                else -> ScannerStatus.ERROR
            }
        } catch (t: Throwable) {
            Log.e(TAG, "MFS100 init failed", t); ScannerStatus.ERROR
        }
        return status
    }

    override fun close() {
        runCatching { sdk.UnInit() }
        status = ScannerStatus.DISCONNECTED
    }

    override fun status(): ScannerStatus =
        if (status == ScannerStatus.CONNECTED && !runCatching { sdk.IsConnected() }.getOrDefault(false)) ScannerStatus.DISCONNECTED else status

    override fun info(): ScannerInfo? = runCatching { sdk.GetDeviceInfo() }.getOrNull()?.let { ScannerInfo(it.Make(), it.Model(), it.SerialNo()) }

    override fun capture(timeoutMs: Int): CaptureResult {
        if (open() != ScannerStatus.CONNECTED) return CaptureResult.Error(CaptureFailure.SCANNER_UNAVAILABLE, "Fingerprint scanner is not connected.")
        val data = FingerData()
        val ret = try {
            sdk.AutoCapture(data, timeoutMs, true)
        } catch (t: Throwable) {
            return CaptureResult.Error(CaptureFailure.ERROR, t.message ?: "Capture failed")
        }
        if (ret != 0) {
            val msg = runCatching { sdk.GetErrorMsg(ret) }.getOrNull() ?: "Capture failed ($ret)"
            val reason = when {
                msg.contains("timeout", ignoreCase = true) -> CaptureFailure.TIMEOUT
                msg.contains("abort", ignoreCase = true) || msg.contains("stop", ignoreCase = true) -> CaptureFailure.CANCELLED
                msg.contains("not connected", ignoreCase = true) || msg.contains("not found", ignoreCase = true) -> CaptureFailure.SCANNER_UNAVAILABLE
                else -> CaptureFailure.ERROR
            }
            return CaptureResult.Error(reason, msg)
        }
        val template = data.ISOTemplate()?.takeIf { it.isNotEmpty() }
            ?: return CaptureResult.Error(CaptureFailure.LOW_QUALITY, "No usable fingerprint — try again.")
        return CaptureResult.Ok(template.copyOf(), data.Quality().coerceIn(0, 100))
    }

    override fun match(probe: ByteArray, gallery: ByteArray): Int = try {
        sdk.MatchISO(probe, gallery)
    } catch (t: Throwable) {
        Log.e(TAG, "MatchISO failed", t); -1
    }

    override fun cancel() {
        runCatching { sdk.StopAutoCapture() }
    }

    private companion object {
        const val TAG = "MantraMfs100"
        const val VID_CYPRESS = 1204   // 0x04B4 — before firmware load
        const val VID_MANTRA = 11279   // 0x2C0F
        const val PID_NEEDS_FIRMWARE = 34323
        const val PID_READY = 4101
    }
}
