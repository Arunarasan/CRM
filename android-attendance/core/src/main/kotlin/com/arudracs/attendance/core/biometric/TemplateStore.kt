package com.arudracs.attendance.core.biometric

/**
 * Local template store. The Android implementation keeps templates in the SQLCipher database and
 * additionally seals each template with an AES-256-GCM key held in the Android Keystore, so a copied
 * database file is useless off the device. Templates are loaded into memory only for matching.
 */
interface TemplateStore {
    suspend fun save(template: StoredTemplate)
    suspend fun all(): List<StoredTemplate>
    suspend fun forEmployee(employeeId: Long): List<StoredTemplate>
    suspend fun delete(templateRef: String): Boolean
    suspend fun deleteEmployee(employeeId: Long): Int
}

class StoredTemplate(
    val templateRef: String,
    val employeeId: Long,
    val employeeCode: String,
    val employeeName: String,
    val finger: FingerPosition,
    val quality: Int,
    val providerId: String,
    /** Plain template bytes — only ever held in memory; the store encrypts at rest. */
    val template: ByteArray,
    /** Set once the server has acknowledged the enrollment (see BiometricSync). */
    val confirmed: Boolean = false,
)
