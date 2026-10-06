package com.arudracs.attendance.data

import com.arudracs.attendance.core.biometric.FingerPosition
import com.arudracs.attendance.core.biometric.StoredTemplate
import com.arudracs.attendance.core.biometric.TemplateStore
import com.arudracs.attendance.core.punch.LedgerDay
import com.arudracs.attendance.core.punch.LocalLedger
import com.arudracs.attendance.core.sync.PendingPunch
import com.arudracs.attendance.core.sync.PunchQueue
import com.arudracs.attendance.security.TemplateCipher
import java.time.LocalDate

/** TemplateStore over SQLCipher + per-row Keystore sealing. Plain templates exist only in memory. */
class RoomTemplateStore(private val dao: TemplateDao, private val cipher: TemplateCipher) : TemplateStore {
    override suspend fun save(template: StoredTemplate) {
        val (iv, ct) = cipher.encrypt(template.template)
        dao.upsert(TemplateEntity(template.templateRef, template.employeeId, template.employeeCode, template.employeeName,
            template.finger.name, template.quality, template.providerId, iv, ct, System.currentTimeMillis()))
    }
    override suspend fun all() = dao.all().mapNotNull(::open)
    override suspend fun forEmployee(employeeId: Long) = dao.forEmployee(employeeId).mapNotNull(::open)
    override suspend fun delete(templateRef: String) = dao.delete(templateRef) > 0
    override suspend fun deleteEmployee(employeeId: Long) = dao.deleteEmployee(employeeId)

    /** Employee for an ID typed on the keypad, from local templates (works offline). */
    suspend fun employeeByCode(code: String) = dao.byCode(code.trim())

    suspend fun clear() = dao.clear()

    private fun open(e: TemplateEntity): StoredTemplate? = runCatching {
        StoredTemplate(e.templateRef, e.employeeId, e.employeeCode, e.employeeName, FingerPosition.parse(e.finger),
            e.quality, e.providerId, cipher.decrypt(e.iv, e.cipherText), confirmed = true)
    }.getOrNull() // a row sealed by a key that no longer exists (factory reset of keystore) is unusable
}

class RoomPunchQueue(private val dao: PendingPunchDao) : PunchQueue {
    override suspend fun enqueue(punch: PendingPunch) = dao.insert(PendingPunchEntity(punch.idempotencyKey, punch.employeeId,
        punch.employeeCode, punch.employeeName, punch.capturedAt, punch.timeSource, punch.matchScore, punch.identification,
        punch.action, punch.attempts, punch.lastError, System.currentTimeMillis()))
    override suspend fun pending(limit: Int) = dao.oldest(limit).map {
        PendingPunch(it.idempotencyKey, it.employeeId, it.employeeCode, it.employeeName, it.capturedAt, it.timeSource,
            it.matchScore, it.identification, it.action, it.attempts, it.lastError)
    }
    override suspend fun remove(keys: Collection<String>) { if (keys.isNotEmpty()) dao.delete(keys.toList()) }
    override suspend fun markAttempt(keys: Collection<String>, error: String?) { if (keys.isNotEmpty()) dao.markAttempt(keys.toList(), error) }
    override suspend fun count() = dao.count()
}

class RoomLedger(private val dao: LedgerDao) : LocalLedger {
    override suspend fun get(employeeId: Long, date: LocalDate) =
        dao.get(employeeId, date.toString())?.let { LedgerDay(it.employeeId, LocalDate.parse(it.date), it.checkInAt, it.checkOutAt) }
    override suspend fun put(day: LedgerDay) = dao.put(LedgerEntity(day.employeeId, day.date.toString(), day.checkInAt, day.checkOutAt))
    override suspend fun purgeBefore(date: LocalDate) = dao.purgeBefore(date.toString())
}
