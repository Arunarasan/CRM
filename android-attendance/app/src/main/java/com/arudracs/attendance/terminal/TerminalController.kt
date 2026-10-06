package com.arudracs.attendance.terminal

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.os.Build
import android.util.Log
import com.arudracs.attendance.BuildConfig
import com.arudracs.attendance.core.api.*
import com.arudracs.attendance.core.biometric.*
import com.arudracs.attendance.core.punch.PunchService
import com.arudracs.attendance.core.sync.OfflineSyncer
import com.arudracs.attendance.core.time.TimeSource
import com.arudracs.attendance.core.time.TrustedClock
import com.arudracs.attendance.data.AttendanceDatabase
import com.arudracs.attendance.data.RoomLedger
import com.arudracs.attendance.data.RoomPunchQueue
import com.arudracs.attendance.data.RoomTemplateStore
import com.arudracs.attendance.kiosk.KioskPolicy
import com.arudracs.attendance.net.DeviceHttp
import com.arudracs.attendance.net.RetrofitTerminalApi
import com.arudracs.attendance.scanner.ScannerDriverFactory
import com.arudracs.attendance.security.SecureStore
import com.arudracs.attendance.security.TemplateCipher
import com.arudracs.attendance.time.AndroidClockSource
import com.arudracs.attendance.work.SyncWorker
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * The terminal's brain: registration → approval → credential, heartbeat (every 1–5 min, server-set),
 * punches (online or queued), offline sync, enrollment sessions pushed by HR, and reaction to the
 * server blocking or revoking the device. UI observes [phase], [status] and [pendingEnrollment].
 */
class TerminalController(private val app: Context) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val store = SecureStore(app)
    private val db = AttendanceDatabase.open(app, store.databasePassphrase())
    val clock = TrustedClock(AndroidClockSource(app.contentResolver), store)
    val api = RetrofitTerminalApi(DeviceHttp.service(), store, clock)
    private val templates = RoomTemplateStore(db.templates(), TemplateCipher())
    private val queue = RoomPunchQueue(db.punches())
    private val ledger = RoomLedger(db.ledger())
    private val driver = ScannerDriverFactory.create(app)
    val biometrics: BiometricProvider = ExternalScannerProvider(driver, templates)
    private val bioSync = BiometricSync(biometrics, templates, api)

    @Volatile var config = DeviceConfig(60, 15, 72, 4, ZoneId.systemDefault().id)
        private set
    val zone: ZoneId get() = runCatching { ZoneId.of(config.timeZone) }.getOrDefault(ZoneId.systemDefault())

    private val punches = PunchService(api, queue, ledger, clock,
        isOnline = { _status.value.online }, zone = { zone }, minCheckoutGapMinutes = { config.minCheckoutGapMinutes })
    private val syncer = OfflineSyncer(queue, api, onResult = { p, r -> scope.launch { punches.remember(p.employeeId, r) } })

    private val _phase = MutableStateFlow<Phase>(Phase.Starting)
    val phase: StateFlow<Phase> = _phase.asStateFlow()
    private val _status = MutableStateFlow(TerminalStatus(deviceName = store.deviceName, deviceCode = store.deviceCode))
    val status: StateFlow<TerminalStatus> = _status.asStateFlow()
    private val _pendingEnrollment = MutableStateFlow<PendingEnrollment?>(null)
    val pendingEnrollment: StateFlow<PendingEnrollment?> = _pendingEnrollment.asStateFlow()

    private var enrollmentsRevision: String? = null
    private var heartbeatJob: Job? = null
    val deviceUuid: String get() = store.deviceUuid

    fun start() {
        watchConnectivity()
        heartbeatJob = scope.launch { lifecycleLoop() }
        scope.launch { ledger.purgeBefore(LocalDate.now(zone).minusDays(2)) }
    }

    // ------------------------------------------------------------------ lifecycle

    private suspend fun lifecycleLoop() {
        while (currentCoroutineContext().isActive) {
            val wait = try {
                when {
                    store.deviceSecret != null -> { heartbeat(); config.heartbeatIntervalSeconds.coerceIn(30, 300) * 1000L }
                    store.registrationId != null && store.pollToken != null -> { pollRegistration(); 15_000L }
                    else -> { ensureRegistrationScreen(); 30_000L }
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.w(TAG, "Lifecycle step failed", e); 30_000L
            }
            refreshLocalStatus()
            delay(wait)
        }
    }

    private suspend fun heartbeat() {
        try {
            val res = api.heartbeat(HeartbeatRequest(
                appVersion = BuildConfig.VERSION_NAME,
                scannerStatus = biometrics.getScannerStatus().name,
                scannerVendor = BuildConfig.SCANNER_VENDOR,
                scannerModel = driver.info()?.model,
                scannerSerial = driver.info()?.serial,
                pendingSyncCount = queue.count(),
                osVersion = Build.VERSION.RELEASE,
                deviceTime = System.currentTimeMillis(),
            ))
            config = res.config
            store.deviceCode = res.device.code
            store.deviceName = res.device.name
            _status.update { it.copy(online = true, deviceName = res.device.name, deviceCode = res.device.code,
                branch = res.device.branchName, location = res.device.locationName) }
            if (_phase.value != Phase.Ready) _phase.value = Phase.Ready
            _pendingEnrollment.value = res.pendingEnrollment?.takeIf { it.status == "PENDING" || it.status == "IN_PROGRESS" }
            if (res.enrollmentsRevision != enrollmentsRevision) {
                bioSync.reconcile()
                enrollmentsRevision = res.enrollmentsRevision
            }
            if (queue.count() > 0) syncNow()
        } catch (e: TransportException) {
            _status.update { it.copy(online = false) }
            if (_phase.value == Phase.Starting) _phase.value = Phase.Ready // offline start: keep working
        } catch (e: DeviceRejectedException) {
            onRejected(e)
        }
    }

    private suspend fun pollRegistration() {
        val id = store.registrationId ?: return
        val token = store.pollToken ?: return
        try {
            val res = api.registrationStatus(RegistrationStatusRequest(id, store.deviceUuid, token))
            _status.update { it.copy(online = true, deviceCode = res.deviceCode, deviceName = res.deviceName) }
            when (res.status) {
                "ACTIVE" -> if (res.deviceSecret != null) {
                    store.deviceSecret = res.deviceSecret
                    store.deviceCode = res.deviceCode
                    store.deviceName = res.deviceName
                    heartbeat()
                }
                "REJECTED" -> { store.clearRegistration(); _phase.value = Phase.Rejected(res.message ?: "Registration was rejected.") }
                "BLOCKED" -> _phase.value = Phase.Blocked(res.message ?: "This device has been blocked.")
                else -> _phase.value = Phase.AwaitingApproval(res.deviceCode, res.message ?: "Waiting for administrator approval.")
            }
        } catch (e: TransportException) {
            _status.update { it.copy(online = false) }
            _phase.value = Phase.AwaitingApproval(store.deviceCode, "Waiting for network…")
        } catch (e: DeviceRejectedException) {
            store.clearRegistration()
            _phase.value = Phase.Unregistered(null, e.message)
        }
    }

    private suspend fun ensureRegistrationScreen() {
        val current = _phase.value
        if (current is Phase.Unregistered && current.options != null) return
        val options = try {
            api.registrationOptions().also { _status.update { s -> s.copy(online = true) } }
        } catch (e: Exception) {
            _status.update { it.copy(online = false) }; null
        }
        if (current !is Phase.Rejected || options != null) {
            _phase.value = Phase.Unregistered(options, (current as? Phase.Unregistered)?.error)
        }
    }

    /** The server refused the device itself: stop recording immediately. */
    private suspend fun onRejected(e: DeviceRejectedException) {
        Log.w(TAG, "Device rejected: ${e.code}")
        api.dropToken()
        _status.update { it.copy(online = true) }
        when (e.code) {
            "DEVICE_BLOCKED", "DEVICE_UNASSIGNED" -> _phase.value = Phase.Blocked(e.message ?: "This device has been blocked.")
            "DEVICE_PENDING" -> _phase.value = Phase.AwaitingApproval(store.deviceCode, "Waiting for administrator approval.")
            else -> {
                // Revoked / unknown / credential replaced: the credential and local templates are void.
                store.clearRegistration()
                templates.clear()
                _phase.value = Phase.Unregistered(null, "This device's registration was revoked. Register it again.")
            }
        }
    }

    fun retryNow() { scope.launch { heartbeatJob?.cancelAndJoin(); heartbeatJob = scope.launch { lifecycleLoop() } } }

    // ------------------------------------------------------------------ registration

    suspend fun register(branchId: Long?, locationId: Long?, name: String?, pairingCode: String?) {
        _phase.update { (it as? Phase.Unregistered)?.copy(busy = true, error = null) ?: it }
        try {
            val scanner = runCatching { driver.info() }.getOrNull()
            val res = api.register(RegisterRequest(store.deviceUuid, name?.takeIf { it.isNotBlank() }, branchId, locationId,
                pairingCode?.takeIf { it.isNotBlank() }, BuildConfig.VERSION_NAME, Build.MANUFACTURER, Build.MODEL,
                Build.VERSION.RELEASE, BuildConfig.SCANNER_VENDOR, scanner?.model))
            store.deviceCode = res.deviceCode
            store.deviceName = res.deviceName
            if (res.deviceSecret != null) {           // paired with an admin code: active straight away
                store.deviceSecret = res.deviceSecret
            } else {
                store.registrationId = res.registrationId
                store.pollToken = res.pollToken
                _phase.value = Phase.AwaitingApproval(res.deviceCode, res.message ?: "Waiting for administrator approval.")
            }
            retryNow()
        } catch (e: Exception) {
            _phase.update { (it as? Phase.Unregistered)?.copy(busy = false, error = e.message ?: "Registration failed") ?: it }
        }
    }

    // ------------------------------------------------------------------ attendance

    /** Home screen: 1:N identification, then punch. Returns null when no finger was placed. */
    suspend fun identifyAndPunch(timeoutMs: Int = 8_000): PunchDisplay? =
        when (val r = biometrics.identifyEmployee(timeoutMs)) {
            is IdentifyResult.Match -> punch(PunchService.Identified(r.employeeId, r.employeeCode, r.employeeName, r.score, "FINGERPRINT"))
            IdentifyResult.NoMatch -> PunchDisplay(PunchDisplay.Kind.NOT_RECOGNISED, message = "Fingerprint not recognised. Try again or enter your Employee ID.")
            is IdentifyResult.Failed -> when (r.reason) {
                CaptureFailure.TIMEOUT, CaptureFailure.CANCELLED -> null
                CaptureFailure.LOW_QUALITY -> PunchDisplay(PunchDisplay.Kind.NOT_RECOGNISED, message = "Could not read the finger. Press flat and hold still.")
                else -> { refreshLocalStatus(); delay(1_500); null }
            }
        }

    /** Employee typed their ID: resolve them, verify 1:1, then punch. */
    suspend fun verifyAndPunch(employeeCode: String, timeoutMs: Int = 12_000): PunchDisplay {
        val code = employeeCode.trim()
        val local = templates.employeeByCode(code)
        val who: Triple<Long, String, String> = when {
            local != null -> Triple(local.employeeId, local.employeeCode, local.employeeName)
            _status.value.online -> try {
                val e = api.lookupEmployee(code)
                if (!e.enrolled) return PunchDisplay(PunchDisplay.Kind.NOT_ENROLLED, e.name, message = "Fingerprint not enrolled. Please contact HR.")
                return PunchDisplay(PunchDisplay.Kind.NOT_ENROLLED, e.name, message = "Your fingerprint is not registered on this terminal. Please contact HR.")
            } catch (e: ApiErrorException) {
                return PunchDisplay(PunchDisplay.Kind.ERROR, message = e.message ?: "Employee not found.")
            } catch (e: TransportException) {
                return PunchDisplay(PunchDisplay.Kind.ERROR, message = "Employee $code is not enrolled on this terminal.")
            }
            else -> return PunchDisplay(PunchDisplay.Kind.ERROR, message = "Employee $code is not enrolled on this terminal.")
        }
        return when (val v = biometrics.verifyEmployee(who.first, timeoutMs)) {
            is VerifyResult.Verified -> punch(PunchService.Identified(who.first, who.second, who.third, v.score, "EMPLOYEE_ID_FINGERPRINT"))
            VerifyResult.Rejected -> PunchDisplay(PunchDisplay.Kind.NOT_RECOGNISED, who.third, message = "Fingerprint does not match ${who.second}.")
            VerifyResult.NotEnrolled -> PunchDisplay(PunchDisplay.Kind.NOT_ENROLLED, who.third, message = "Fingerprint not enrolled. Please contact HR.")
            is VerifyResult.Failed -> PunchDisplay(PunchDisplay.Kind.ERROR, who.third, message = v.message)
        }
    }

    private suspend fun punch(who: PunchService.Identified): PunchDisplay {
        val outcome = try {
            punches.record(who)
        } catch (e: DeviceRejectedException) {
            onRejected(e)
            return PunchDisplay(PunchDisplay.Kind.ERROR, who.employeeName, message = "This device can no longer record attendance.")
        }
        refreshLocalStatus()
        return when (outcome) {
            is PunchService.Outcome.Recorded -> outcome.response.let { r ->
                PunchDisplay(kindOf(r.result), outcome.employeeName, clockLabel(r.checkInTime), clockLabel(r.checkOutTime),
                    r.workingMinutes, r.lateMinutes, offline = false, flagged = r.flagged, message = r.message,
                    atEpochMs = clock.now().epochMs)
            }
            is PunchService.Outcome.Queued -> PunchDisplay(kindOf(outcome.result), outcome.employeeName,
                checkIn = outcome.checkInAt?.let(::epochLabel),
                checkOut = if (outcome.result == PunchResult.CHECK_OUT) epochLabel(outcome.at) else null,
                workingMinutes = outcome.checkInAt?.takeIf { outcome.result == PunchResult.CHECK_OUT }
                    ?.let { ((outcome.at - it) / 60_000).toInt() },
                offline = true, message = "Saved on this device — will sync when online.", atEpochMs = outcome.at)
            is PunchService.Outcome.Refused -> PunchDisplay(PunchDisplay.Kind.ERROR, outcome.employeeName, message = outcome.message)
        }
    }

    // ------------------------------------------------------------------ sync & enrollment

    suspend fun syncNow() {
        if (store.deviceSecret == null) return
        try {
            val report = syncer.syncOnce()
            _status.update { it.copy(online = report.error == null,
                lastSyncedAllAt = if (report.remaining == 0 && report.settled > 0) System.currentTimeMillis() else it.lastSyncedAllAt) }
        } catch (e: DeviceRejectedException) {
            onRejected(e)
        }
        refreshLocalStatus()
    }

    suspend fun enroll(pending: PendingEnrollment, onProgress: (EnrollmentProgress) -> Unit): BiometricSync.Outcome {
        val outcome = try {
            bioSync.enroll(pending, onProgress)
        } catch (e: Exception) {
            BiometricSync.Outcome.Failed(e.message ?: "Enrollment failed")
        }
        enrollmentsRevision = null // force a reconcile on the next heartbeat
        return outcome
    }

    /** Called by the enrollment screen once the result has been shown. */
    fun dismissEnrollment() { _pendingEnrollment.value = null }

    suspend fun declineEnrollment(pending: PendingEnrollment) {
        runCatching { api.failEnrollment(pending.sessionId, EnrollmentFailRequest("Cancelled at the device")) }
        _pendingEnrollment.value = null
    }

    suspend fun adminUnlock(email: String, password: String): Boolean = try {
        api.verifyAdmin(email.trim(), password)
    } catch (e: Exception) {
        false
    }

    // ------------------------------------------------------------------ helpers

    private suspend fun refreshLocalStatus() {
        val pending = runCatching { queue.count() }.getOrDefault(0)
        _status.update {
            it.copy(scanner = biometrics.getScannerStatus().name, pendingSync = pending,
                clockTrusted = clock.now().source == TimeSource.SERVER_ANCHORED,
                deviceOwner = KioskPolicy.isDeviceOwner(app))
        }
    }

    private fun watchConnectivity() {
        val cm = app.getSystemService(ConnectivityManager::class.java)
        cm.registerDefaultNetworkCallback(object : ConnectivityManager.NetworkCallback() {
            override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
                if (caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) && !_status.value.online) {
                    _status.update { it.copy(online = true) }
                    SyncWorker.kick(app)
                    retryNow()
                }
            }
            override fun onLost(network: Network) {
                _status.update { it.copy(online = false) }
            }
        })
    }

    private fun kindOf(result: String) = when (result) {
        PunchResult.CHECK_IN -> PunchDisplay.Kind.CHECK_IN
        PunchResult.CHECK_OUT -> PunchDisplay.Kind.CHECK_OUT
        PunchResult.ALREADY_CHECKED_IN -> PunchDisplay.Kind.ALREADY_IN
        PunchResult.ALREADY_CHECKED_OUT -> PunchDisplay.Kind.ALREADY_OUT
        else -> PunchDisplay.Kind.ERROR
    }

    private val hhmm = DateTimeFormatter.ofPattern("hh:mm a")
    private fun clockLabel(t: String?) = t?.let { runCatching { java.time.LocalTime.parse(it).format(hhmm) }.getOrNull() }
    private fun epochLabel(ms: Long) = Instant.ofEpochMilli(ms).atZone(zone).toLocalTime().format(hhmm)

    private companion object { const val TAG = "Terminal" }
}
