package com.arudracs.attendance.terminal

import com.arudracs.attendance.core.api.RegistrationOptions

/** Where the terminal is in its lifecycle; drives which top-level screen is shown. */
sealed interface Phase {
    data object Starting : Phase
    data class Unregistered(val options: RegistrationOptions?, val error: String? = null, val busy: Boolean = false) : Phase
    data class AwaitingApproval(val deviceCode: String?, val message: String) : Phase
    data class Rejected(val message: String) : Phase
    data class Blocked(val message: String) : Phase
    data object Ready : Phase
}

data class TerminalStatus(
    val online: Boolean = false,
    val scanner: String = "UNKNOWN",
    val pendingSync: Int = 0,
    val deviceName: String? = null,
    val deviceCode: String? = null,
    val branch: String? = null,
    val location: String? = null,
    val clockTrusted: Boolean = false,
    val lastSyncedAllAt: Long? = null,
    val deviceOwner: Boolean = false,
)

/** What the kiosk shows after a scan. */
data class PunchDisplay(
    val kind: Kind,
    val employeeName: String? = null,
    val checkIn: String? = null,
    val checkOut: String? = null,
    val workingMinutes: Int? = null,
    val lateMinutes: Int? = null,
    val offline: Boolean = false,
    val flagged: Boolean = false,
    val message: String? = null,
    val atEpochMs: Long = 0,
) {
    enum class Kind { CHECK_IN, CHECK_OUT, ALREADY_IN, ALREADY_OUT, NOT_RECOGNISED, NOT_ENROLLED, ERROR }
}
