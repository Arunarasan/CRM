package com.arudracs.attendance.data

import android.content.Context
import androidx.room.*
import net.zetetic.database.sqlcipher.SupportOpenHelperFactory

/**
 * Local store, encrypted with SQLCipher (key in [com.arudracs.attendance.security.SecureStore]).
 *  templates        — biometric templates, additionally sealed per row by TemplateCipher
 *  pending_punches  — offline queue, one row per idempotency key
 *  ledger           — today's punches per employee (offline answers only)
 */
@Database(entities = [TemplateEntity::class, PendingPunchEntity::class, LedgerEntity::class], version = 1, exportSchema = false)
abstract class AttendanceDatabase : RoomDatabase() {
    abstract fun templates(): TemplateDao
    abstract fun punches(): PendingPunchDao
    abstract fun ledger(): LedgerDao

    companion object {
        fun open(context: Context, passphrase: ByteArray): AttendanceDatabase {
            System.loadLibrary("sqlcipher")
            return Room.databaseBuilder(context, AttendanceDatabase::class.java, "attendance.db")
                .openHelperFactory(SupportOpenHelperFactory(passphrase))
                .build()
        }
    }
}

@Entity(tableName = "templates", indices = [Index("employeeId")])
class TemplateEntity(
    @PrimaryKey val templateRef: String,
    val employeeId: Long,
    val employeeCode: String,
    val employeeName: String,
    val finger: String,
    val quality: Int,
    val providerId: String,
    val iv: ByteArray,
    val cipherText: ByteArray,
    val createdAt: Long,
)

@Entity(tableName = "pending_punches", indices = [Index("capturedAt")])
data class PendingPunchEntity(
    @PrimaryKey val idempotencyKey: String,
    val employeeId: Long,
    val employeeCode: String,
    val employeeName: String,
    val capturedAt: Long,
    val timeSource: String,
    val matchScore: Int?,
    val identification: String,
    val action: String,
    val attempts: Int,
    val lastError: String?,
    val createdAt: Long,
)

@Entity(tableName = "ledger", primaryKeys = ["employeeId", "date"])
data class LedgerEntity(val employeeId: Long, val date: String, val checkInAt: Long?, val checkOutAt: Long?)

@Dao
interface TemplateDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun upsert(t: TemplateEntity)
    @Query("SELECT * FROM templates") suspend fun all(): List<TemplateEntity>
    @Query("SELECT * FROM templates WHERE employeeId = :employeeId") suspend fun forEmployee(employeeId: Long): List<TemplateEntity>
    @Query("SELECT * FROM templates WHERE employeeCode = :code COLLATE NOCASE LIMIT 1") suspend fun byCode(code: String): TemplateEntity?
    @Query("DELETE FROM templates WHERE templateRef = :ref") suspend fun delete(ref: String): Int
    @Query("DELETE FROM templates WHERE employeeId = :employeeId") suspend fun deleteEmployee(employeeId: Long): Int
    @Query("DELETE FROM templates") suspend fun clear()
}

@Dao
interface PendingPunchDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE) suspend fun insert(p: PendingPunchEntity)
    @Query("SELECT * FROM pending_punches ORDER BY capturedAt ASC LIMIT :limit") suspend fun oldest(limit: Int): List<PendingPunchEntity>
    @Query("DELETE FROM pending_punches WHERE idempotencyKey IN (:keys)") suspend fun delete(keys: List<String>)
    @Query("UPDATE pending_punches SET attempts = attempts + 1, lastError = :error WHERE idempotencyKey IN (:keys)")
    suspend fun markAttempt(keys: List<String>, error: String?)
    @Query("SELECT COUNT(*) FROM pending_punches") suspend fun count(): Int
}

@Dao
interface LedgerDao {
    @Query("SELECT * FROM ledger WHERE employeeId = :employeeId AND date = :date") suspend fun get(employeeId: Long, date: String): LedgerEntity?
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun put(e: LedgerEntity)
    @Query("DELETE FROM ledger WHERE date < :date") suspend fun purgeBefore(date: String)
}
