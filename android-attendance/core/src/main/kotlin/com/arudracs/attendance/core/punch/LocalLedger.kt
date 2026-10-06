package com.arudracs.attendance.core.punch

import java.time.LocalDate

/**
 * The terminal's own memory of today's punches per employee, fed by every online response and every
 * offline punch. Used only to give a sensible on-screen answer while offline — the server re-decides
 * everything on sync.
 */
interface LocalLedger {
    suspend fun get(employeeId: Long, date: LocalDate): LedgerDay?
    suspend fun put(day: LedgerDay)
    suspend fun purgeBefore(date: LocalDate)
}

data class LedgerDay(
    val employeeId: Long,
    val date: LocalDate,
    /** Epoch millis; null when unknown. */
    val checkInAt: Long?,
    val checkOutAt: Long?,
)
