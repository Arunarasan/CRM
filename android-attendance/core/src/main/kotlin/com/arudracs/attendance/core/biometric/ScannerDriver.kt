package com.arudracs.attendance.core.biometric

/**
 * The ONLY vendor-specific seam for a USB/OTG fingerprint scanner. Each manufacturer SDK (Mantra
 * MFS100, SecuGen Hamster, Startek FM220, …) gets one small implementation of this interface in the
 * Android app's product-flavour source set; everything above it ([ExternalScannerProvider], the
 * attendance flow, the UI) is shared.
 *
 * Requirements an implementation must meet:
 *  - [capture] returns a standard minutiae template (ISO/IEC 19794-2 preferred) — never an image
 *    to the caller, and must not write images to disk;
 *  - [match] compares two templates produced by this same driver and returns the vendor score;
 *  - all calls may block; the provider calls them off the main thread.
 */
interface ScannerDriver {
    /** e.g. "MANTRA_MFS100". */
    val vendorId: String

    /** Score at/above which [match] means "same finger" — the vendor's recommended operating point. */
    val matchThreshold: Int

    /** Opens/initialises the scanner (USB permission, firmware load). Idempotent. */
    fun open(): ScannerStatus

    fun close()

    fun status(): ScannerStatus

    /** Model / serial for the admin device list (may be null before [open]). */
    fun info(): ScannerInfo?

    /** Blocks until a finger is captured or [timeoutMs] elapses. */
    fun capture(timeoutMs: Int): CaptureResult

    /** Vendor score for two templates; higher = more similar; negative = error. */
    fun match(probe: ByteArray, gallery: ByteArray): Int

    fun cancel()
}

data class ScannerInfo(val make: String?, val model: String?, val serial: String?)

sealed interface CaptureResult {
    /** [quality] normalised to 0–100. */
    data class Ok(val template: ByteArray, val quality: Int) : CaptureResult {
        override fun equals(other: Any?) = other is Ok && quality == other.quality && template.contentEquals(other.template)
        override fun hashCode() = 31 * template.contentHashCode() + quality
    }
    data class Error(val reason: CaptureFailure, val message: String) : CaptureResult
}
