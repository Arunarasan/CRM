package com.arudracs.attendance.core.sync

/**
 * Durable offline punch queue (SQLCipher-backed on the device). Every record carries the
 * idempotency key it will be sent with, so re-sending after a lost response can never create a
 * second attendance record — the server returns the original outcome for a repeated key.
 */
interface PunchQueue {
    suspend fun enqueue(punch: PendingPunch)
    /** Oldest first. */
    suspend fun pending(limit: Int): List<PendingPunch>
    suspend fun remove(keys: Collection<String>)
    suspend fun markAttempt(keys: Collection<String>, error: String?)
    suspend fun count(): Int
}

data class PendingPunch(
    val idempotencyKey: String,
    val employeeId: Long,
    val employeeCode: String,
    val employeeName: String,
    val capturedAt: Long,
    val timeSource: String,
    val matchScore: Int?,
    val identification: String,
    val action: String = "AUTO",
    val attempts: Int = 0,
    val lastError: String? = null,
)
