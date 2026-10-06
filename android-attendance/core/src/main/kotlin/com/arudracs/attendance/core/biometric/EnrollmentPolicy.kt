package com.arudracs.attendance.core.biometric

/** Tunables for enrollment and identification. Defaults suit an office of up to a few hundred people. */
data class EnrollmentPolicy(
    /** Samples captured per enrollment. */
    val captures: Int = 3,
    /** Minimum normalised quality (0–100) for a sample to count. */
    val minQuality: Int = 50,
    /** Re-tries allowed per sample after a low-quality read. */
    val retriesPerSample: Int = 2,
    val captureTimeoutMs: Int = 15_000,
    /**
     * 1:N safety rule when a DIFFERENT employee also matches above the threshold. null (default): such a
     * read is ambiguous and nobody is identified — a wrong person is worse than a retry. A number: the
     * best score wins only if it beats that other employee by at least this margin.
     */
    val ambiguityMargin: Int? = null,
)
