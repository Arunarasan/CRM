package com.arudracs.attendance.security

import android.content.Context
import android.util.Base64
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.arudracs.attendance.core.time.AnchorStore
import com.arudracs.attendance.core.time.ClockAnchor
import java.security.SecureRandom
import java.util.UUID

/**
 * Device identity and credentials, encrypted with a key that never leaves the Android Keystore.
 * Holds: install UUID, registration id + one-time poll token, the device secret, the SQLCipher
 * passphrase and the trusted-clock anchor. Excluded from backup (data_extraction_rules.xml).
 */
class SecureStore(context: Context) : AnchorStore {

    private val prefs = EncryptedSharedPreferences.create(
        context,
        "arudracs_terminal_secure",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    /** Generated once per install; what the admin sees as the Device UUID. */
    val deviceUuid: String
        @Synchronized get() = prefs.getString(K_UUID, null) ?: UUID.randomUUID().toString().also {
            prefs.edit().putString(K_UUID, it).apply()
        }

    var registrationId: Long?
        get() = prefs.getLong(K_REG_ID, -1).takeIf { it > 0 }
        set(v) = prefs.edit().apply { if (v == null) remove(K_REG_ID) else putLong(K_REG_ID, v) }.apply()

    var pollToken: String?
        get() = prefs.getString(K_POLL, null)
        set(v) = prefs.edit().putString(K_POLL, v).apply()

    var deviceSecret: String?
        get() = prefs.getString(K_SECRET, null)
        set(v) = prefs.edit().putString(K_SECRET, v).apply()

    var deviceCode: String?
        get() = prefs.getString(K_CODE, null)
        set(v) = prefs.edit().putString(K_CODE, v).apply()

    var deviceName: String?
        get() = prefs.getString(K_NAME, null)
        set(v) = prefs.edit().putString(K_NAME, v).apply()

    /** Random 256-bit SQLCipher key, created on first use. */
    @Synchronized
    fun databasePassphrase(): ByteArray {
        prefs.getString(K_DB, null)?.let { return Base64.decode(it, Base64.NO_WRAP) }
        val key = ByteArray(32).also(SecureRandom()::nextBytes)
        prefs.edit().putString(K_DB, Base64.encodeToString(key, Base64.NO_WRAP)).commit()
        return key
    }

    /** Forget the registration (device revoked / rejected); the UUID and local data stay. */
    fun clearRegistration() {
        prefs.edit().remove(K_REG_ID).remove(K_POLL).remove(K_SECRET).apply()
    }

    override fun load(): ClockAnchor? {
        val server = prefs.getLong(K_ANCHOR_SERVER, -1)
        if (server < 0) return null
        return ClockAnchor(server, prefs.getLong(K_ANCHOR_ELAPSED, 0), prefs.getInt(K_ANCHOR_BOOT, -1))
    }

    override fun save(anchor: ClockAnchor) {
        prefs.edit().putLong(K_ANCHOR_SERVER, anchor.serverEpochMs).putLong(K_ANCHOR_ELAPSED, anchor.elapsedMs)
            .putInt(K_ANCHOR_BOOT, anchor.bootCount).apply()
    }

    private companion object {
        const val K_UUID = "device_uuid"
        const val K_REG_ID = "registration_id"
        const val K_POLL = "poll_token"
        const val K_SECRET = "device_secret"
        const val K_CODE = "device_code"
        const val K_NAME = "device_name"
        const val K_DB = "db_passphrase"
        const val K_ANCHOR_SERVER = "anchor_server"
        const val K_ANCHOR_ELAPSED = "anchor_elapsed"
        const val K_ANCHOR_BOOT = "anchor_boot"
    }
}
