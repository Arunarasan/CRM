package com.arudracs.attendance.net

import android.os.SystemClock
import com.arudracs.attendance.core.api.*
import com.arudracs.attendance.core.time.TrustedClock
import com.arudracs.attendance.security.SecureStore
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * [TerminalApi] over Retrofit with the device-token lifecycle:
 * the long-lived device secret (encrypted at rest) is exchanged for a short-lived token, which is
 * cached in memory only and refreshed on expiry. Every token exchange and heartbeat re-anchors the
 * trusted clock to server time.
 */
class RetrofitTerminalApi(
    private val service: DeviceService,
    private val store: SecureStore,
    private val clock: TrustedClock,
) : TerminalApi {

    private val tokenLock = Mutex()
    @Volatile private var token: String? = null
    @Volatile private var tokenExpiresAtElapsed = 0L
    @Volatile var device: DeviceInfo? = null
        private set

    override suspend fun registrationOptions() = DeviceHttp.call { service.options() }
    override suspend fun register(req: RegisterRequest) = DeviceHttp.call { service.register(req) }
    override suspend fun registrationStatus(req: RegistrationStatusRequest) = DeviceHttp.call { service.registrationStatus(req) }

    override suspend fun token(req: TokenRequest): TokenResponse {
        val start = SystemClock.elapsedRealtime()
        val res = DeviceHttp.call { service.token(req) }
        clock.anchor(res.serverTime, start, SystemClock.elapsedRealtime())
        return res
    }

    override suspend fun heartbeat(req: HeartbeatRequest): HeartbeatResponse {
        val start = SystemClock.elapsedRealtime()
        val res = authed { service.heartbeat(it, req) }
        clock.anchor(res.serverTime, start, SystemClock.elapsedRealtime())
        device = res.device
        return res
    }

    override suspend fun lookupEmployee(code: String) = authed { service.lookup(it, code) }
    override suspend fun roster() = authed { service.roster(it) }
    override suspend fun punch(req: PunchRequest) = authed { service.punch(it, req) }
    override suspend fun sync(req: SyncRequest) = authed { service.sync(it, req) }
    override suspend fun enrollments() = authed { service.enrollments(it) }
    override suspend fun startEnrollment(sessionId: Long) = authed { service.startEnrollment(it, sessionId) }
    override suspend fun completeEnrollment(sessionId: Long, req: EnrollmentCompleteRequest) = authed { service.completeEnrollment(it, sessionId, req) }
    override suspend fun failEnrollment(sessionId: Long, req: EnrollmentFailRequest) { authed { service.failEnrollment(it, sessionId, req) } }

    /** Admin unlock on the terminal: true when the CRM user may manage attendance devices. */
    suspend fun verifyAdmin(email: String, password: String): Boolean {
        val res = DeviceHttp.call { service.login(mapOf("email" to email, "password" to password)) }
        val roles = res.roles.orEmpty()
        return "ROLE_ADMIN" in roles || "WORKFORCE_WRITE" in roles
    }

    fun dropToken() { token = null }

    private suspend fun <T> authed(block: suspend (String) -> T): T {
        val t = currentToken()
        return try {
            DeviceHttp.call { block("Device $t") }
        } catch (_: DeviceHttp.TokenExpired) {
            dropToken()
            DeviceHttp.call { block("Device ${currentToken()}") }
        }
    }

    private suspend fun currentToken(): String = tokenLock.withLock {
        val now = SystemClock.elapsedRealtime()
        token?.takeIf { now < tokenExpiresAtElapsed }?.let { return it }
        val secret = store.deviceSecret ?: throw DeviceRejectedException("DEVICE_UNKNOWN", "Device is not registered.", 401)
        val res = token(TokenRequest(store.deviceUuid, secret))
        device = res.device
        token = res.accessToken
        tokenExpiresAtElapsed = now + (res.expiresIn - 60).coerceAtLeast(30) * 1000 // refresh a minute early
        res.accessToken
    }
}
