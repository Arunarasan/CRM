package com.arudracs.attendance.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.arudracs.attendance.BuildConfig
import com.arudracs.attendance.core.api.PendingEnrollment
import com.arudracs.attendance.core.biometric.BiometricSync
import com.arudracs.attendance.core.biometric.EnrollmentProgress
import com.arudracs.attendance.scanner.ScannerDriverFactory
import com.arudracs.attendance.terminal.Phase
import com.arudracs.attendance.terminal.PunchDisplay
import com.arudracs.attendance.terminal.TerminalController
import com.arudracs.attendance.terminal.TerminalStatus
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Top-level kiosk: picks the screen from the terminal's lifecycle phase. */
@Composable
fun KioskApp(terminal: TerminalController, onMaintenance: (Boolean) -> Unit) {
    val phase by terminal.phase.collectAsState()
    val status by terminal.status.collectAsState()
    val enrollment by terminal.pendingEnrollment.collectAsState()
    var adminLogin by remember { mutableStateOf(false) }
    var adminPanel by remember { mutableStateOf(false) }
    var maintenance by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxSize().background(Brand.Background)) {
        Header(status, onSecretLongPress = { adminLogin = true })
        Box(Modifier.weight(1f).fillMaxWidth()) {
            when (val p = phase) {
                Phase.Starting -> Centered { CircularProgressIndicator() }
                is Phase.Unregistered -> RegistrationScreen(terminal, p)
                is Phase.AwaitingApproval -> MessageScreen(Icons.Default.HourglassTop, "Waiting for approval",
                    "Device ${p.deviceCode ?: ""} has requested registration.\n${p.message}\n\nAn administrator approves it in ArudraCS → HR → Attendance → Devices.")
                is Phase.Rejected -> MessageScreen(Icons.Default.Block, "Registration rejected", p.message,
                    action = "Register again" to { terminal.retryNow() })
                is Phase.Blocked -> MessageScreen(Icons.Default.Lock, "Device blocked",
                    "${p.message}\nAttendance cannot be recorded on this device. Please contact HR.")
                Phase.Ready -> {
                    val e = enrollment
                    if (e != null) EnrollmentScreen(terminal, e) else AttendanceScreen(terminal, status)
                }
            }
        }
        StatusBar(status, terminal.deviceUuid)
    }

    if (adminLogin) AdminLoginDialog(terminal, onDismiss = { adminLogin = false }, onUnlocked = { adminLogin = false; adminPanel = true })
    if (adminPanel) AdminPanel(terminal, status, maintenance,
        onMaintenance = { on -> maintenance = on; onMaintenance(on) },
        onDismiss = { adminPanel = false })
}

// ===================================================================== chrome

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun Header(status: TerminalStatus, onSecretLongPress: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().background(Brand.DeepNavy).padding(horizontal = 24.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Long-press the wordmark to open the admin sign-in (no visible admin button for employees).
        Column(Modifier.combinedClickable(interactionSource = remember { MutableInteractionSource() }, indication = null,
            onClick = {}, onLongClick = onSecretLongPress)) {
            Text("ARUDRACS", color = Brand.Gold, fontWeight = FontWeight.Bold, fontSize = 22.sp, letterSpacing = 3.sp)
            Text("EMPLOYEE ATTENDANCE", color = Color.White.copy(alpha = 0.8f), fontSize = 13.sp, letterSpacing = 2.sp)
        }
        Spacer(Modifier.weight(1f))
        Text(listOfNotNull(status.deviceName, status.location).joinToString(" · "), color = Color.White.copy(alpha = 0.7f), fontSize = 13.sp)
    }
}

@Composable
private fun StatusBar(status: TerminalStatus, uuid: String) {
    Column(Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 24.dp, vertical = 12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Dot(status.scanner == "CONNECTED")
            Text(" Scanner: ${if (status.scanner == "CONNECTED") "Connected" else status.scanner.lowercase().replace('_', ' ')}", fontSize = 15.sp)
            Spacer(Modifier.width(24.dp))
            Dot(status.online)
            Text(" Network: ${if (status.online) "Online" else "Offline"}", fontSize = 15.sp)
            Spacer(Modifier.weight(1f))
            Text(status.deviceCode ?: uuid.take(8).uppercase(Locale.ROOT), color = Brand.Muted, fontSize = 12.sp)
        }
        val justSynced = status.pendingSync == 0 && status.lastSyncedAllAt != null &&
            System.currentTimeMillis() - status.lastSyncedAllAt < 15_000
        when {
            !status.online -> Text("● Offline Mode   Pending Sync: ${status.pendingSync}", color = Brand.Warning,
                fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 6.dp))
            status.pendingSync > 0 -> Text("Synchronising ${status.pendingSync} offline punch(es)…", color = Brand.Warning,
                modifier = Modifier.padding(top = 6.dp))
            justSynced -> Text("✓ All attendance synchronized", color = Brand.Success, fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(top = 6.dp))
        }
        if (!status.deviceOwner && BuildConfig.SCANNER_VENDOR != "SIMULATED") {
            Text("Kiosk lock not active — provision this device as device owner.", color = Brand.Error, fontSize = 12.sp,
                modifier = Modifier.padding(top = 4.dp))
        }
    }
}

@Composable
private fun Dot(ok: Boolean) = Box(Modifier.size(12.dp).background(if (ok) Brand.Success else Brand.Error, CircleShape))

@Composable
private fun Centered(content: @Composable () -> Unit) =
    Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) { content() }

@Composable
private fun MessageScreen(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, body: String,
                          action: Pair<String, () -> Unit>? = null) = Centered {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(icon, null, tint = Brand.Navy, modifier = Modifier.size(72.dp))
        Spacer(Modifier.height(16.dp))
        Text(title, fontSize = 28.sp, fontWeight = FontWeight.Bold, color = Brand.DeepNavy)
        Spacer(Modifier.height(12.dp))
        Text(body, fontSize = 18.sp, textAlign = TextAlign.Center, color = Brand.Muted)
        if (action != null) {
            Spacer(Modifier.height(24.dp))
            Button(onClick = action.second, modifier = Modifier.height(56.dp)) { Text(action.first, fontSize = 18.sp) }
        }
    }
}

// ===================================================================== attendance

private sealed interface Mode {
    data object Home : Mode
    data object EnterId : Mode
    data class Verifying(val code: String) : Mode
    data class Result(val display: PunchDisplay) : Mode
}

@Composable
private fun AttendanceScreen(terminal: TerminalController, status: TerminalStatus) {
    var mode by remember { mutableStateOf<Mode>(Mode.Home) }

    when (val m = mode) {
        Mode.Home -> {
            // Always listening: a finger on the scanner is all an employee needs to do.
            LaunchedEffect(Unit) {
                try {
                    while (isActive) {
                        val r = terminal.identifyAndPunch()
                        if (r != null) { mode = Mode.Result(r); break }
                    }
                } finally {
                    terminal.biometrics.cancelCapture()
                }
            }
            HomeScreen(terminal, status, onEnterId = { mode = Mode.EnterId })
        }
        Mode.EnterId -> EnterIdScreen(onCancel = { mode = Mode.Home }, onContinue = { mode = Mode.Verifying(it) })
        is Mode.Verifying -> {
            LaunchedEffect(m.code) {
                try { mode = Mode.Result(terminal.verifyAndPunch(m.code)) } finally { terminal.biometrics.cancelCapture() }
            }
            Centered {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    PulsingFingerprint()
                    Spacer(Modifier.height(24.dp))
                    Text("Place your finger on the scanner", fontSize = 26.sp, fontWeight = FontWeight.SemiBold)
                    Text("Employee ID ${m.code}", color = Brand.Muted, fontSize = 18.sp)
                    Spacer(Modifier.height(24.dp))
                    OutlinedButton(onClick = { mode = Mode.Home }, modifier = Modifier.height(52.dp)) { Text("Cancel", fontSize = 18.sp) }
                    SimulatedFingerButtons()
                }
            }
        }
        is Mode.Result -> {
            LaunchedEffect(m) {
                delay(terminal.config.successScreenSeconds.coerceIn(3, 5) * 1000L)
                mode = Mode.Home
            }
            ResultScreen(m.display, terminal, onDone = { mode = Mode.Home })
        }
    }
}

@Composable
private fun HomeScreen(terminal: TerminalController, status: TerminalStatus, onEnterId: () -> Unit) {
    var now by remember { mutableLongStateOf(terminal.clock.now().epochMs) }
    LaunchedEffect(Unit) { while (true) { now = terminal.clock.now().epochMs; delay(1_000) } }
    val t = Instant.ofEpochMilli(now).atZone(terminal.zone)
    Centered {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(t.format(DateTimeFormatter.ofPattern("EEEE, dd MMM", Locale.ENGLISH)), fontSize = 24.sp, color = Brand.Muted)
            Text(t.format(DateTimeFormatter.ofPattern("hh:mm a", Locale.ENGLISH)), fontSize = 72.sp, fontWeight = FontWeight.Bold, color = Brand.DeepNavy)
            if (!status.clockTrusted) Text("Time not yet verified with the server", color = Brand.Warning, fontSize = 13.sp)
            Spacer(Modifier.height(40.dp))
            Button(onClick = onEnterId, modifier = Modifier.fillMaxWidth(0.7f).height(72.dp), shape = RoundedCornerShape(16.dp)) {
                Icon(Icons.Default.Dialpad, null); Spacer(Modifier.width(12.dp)); Text("ENTER EMPLOYEE ID", fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.height(20.dp))
            Text("OR", color = Brand.Muted, fontSize = 18.sp)
            Spacer(Modifier.height(20.dp))
            PulsingFingerprint()
            Text("SCAN FINGERPRINT", fontSize = 24.sp, fontWeight = FontWeight.SemiBold, color = Brand.Navy)
            if (status.scanner != "CONNECTED") Text("Fingerprint scanner not connected", color = Brand.Error, fontSize = 16.sp)
            SimulatedFingerButtons()
        }
    }
}

@Composable
private fun PulsingFingerprint() {
    val pulse by rememberInfiniteTransition(label = "pulse").animateFloat(
        initialValue = 0.94f, targetValue = 1.06f,
        animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse), label = "scale")
    Box(Modifier.size(140.dp).scale(pulse).background(Brand.Navy.copy(alpha = 0.08f), CircleShape), contentAlignment = Alignment.Center) {
        Icon(Icons.Default.Fingerprint, "Fingerprint", tint = Brand.Navy, modifier = Modifier.size(96.dp))
    }
}

/** Simulated flavour only: stand-in for a real finger. */
@Composable
private fun SimulatedFingerButtons() {
    val press = ScannerDriverFactory.debugPress ?: return
    Row(Modifier.padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        (1..5).forEach { n -> AssistChip(onClick = { press(n) }, label = { Text("Finger $n") }) }
    }
}

@Composable
private fun EnterIdScreen(onCancel: () -> Unit, onContinue: (String) -> Unit) {
    var code by remember { mutableStateOf("") }
    Centered {
        Column(Modifier.fillMaxWidth(0.7f), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("Enter your Employee ID", fontSize = 28.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(24.dp))
            OutlinedTextField(value = code, onValueChange = { code = it.uppercase(Locale.ROOT).filter { c -> c.isLetterOrDigit() || c == '-' }.take(30) },
                singleLine = true, textStyle = LocalTextStyle.current.copy(fontSize = 32.sp, textAlign = TextAlign.Center),
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters, keyboardType = KeyboardType.Ascii),
                modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(24.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                OutlinedButton(onClick = onCancel, modifier = Modifier.weight(1f).height(64.dp)) { Text("Cancel", fontSize = 20.sp) }
                Button(onClick = { onContinue(code) }, enabled = code.isNotBlank(), modifier = Modifier.weight(1f).height(64.dp)) {
                    Text("Continue", fontSize = 20.sp)
                }
            }
        }
    }
    // Return home if left idle (someone walked away mid-entry).
    LaunchedEffect(code) { delay(30_000); onCancel() }
}

@Composable
private fun ResultScreen(d: PunchDisplay, terminal: TerminalController, onDone: () -> Unit) {
    val ok = d.kind == PunchDisplay.Kind.CHECK_IN || d.kind == PunchDisplay.Kind.CHECK_OUT
    val info = d.kind == PunchDisplay.Kind.ALREADY_IN || d.kind == PunchDisplay.Kind.ALREADY_OUT
    val (bg, fg) = when { ok -> Brand.SuccessBg to Brand.Success; info -> Brand.WarningBg to Brand.Warning; else -> Brand.ErrorBg to Brand.Error }
    val date = Instant.ofEpochMilli(if (d.atEpochMs > 0) d.atEpochMs else terminal.clock.now().epochMs).atZone(terminal.zone)
    Box(Modifier.fillMaxSize().background(bg).combinedClickableNoRipple(onDone), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(32.dp)) {
            val title = when (d.kind) {
                PunchDisplay.Kind.CHECK_IN -> "✓ CHECK-IN SUCCESSFUL"
                PunchDisplay.Kind.CHECK_OUT -> "✓ CHECK-OUT SUCCESSFUL"
                PunchDisplay.Kind.ALREADY_IN -> "Already checked in."
                PunchDisplay.Kind.ALREADY_OUT -> "Attendance already completed today."
                PunchDisplay.Kind.NOT_RECOGNISED -> "Not recognised"
                PunchDisplay.Kind.NOT_ENROLLED -> "Not enrolled"
                PunchDisplay.Kind.ERROR -> "Could not record attendance"
            }
            Text(title, fontSize = 34.sp, fontWeight = FontWeight.Bold, color = fg, textAlign = TextAlign.Center)
            d.employeeName?.let { Spacer(Modifier.height(16.dp)); Text(it, fontSize = 30.sp, fontWeight = FontWeight.SemiBold, color = Brand.DeepNavy) }
            Spacer(Modifier.height(20.dp))
            when (d.kind) {
                PunchDisplay.Kind.CHECK_IN -> {
                    Text(d.checkIn ?: date.format(DateTimeFormatter.ofPattern("hh:mm a")), fontSize = 40.sp, fontWeight = FontWeight.Bold)
                    Text(date.format(DateTimeFormatter.ofPattern("dd MMMM yyyy", Locale.ENGLISH)), fontSize = 20.sp, color = Brand.Muted)
                    if ((d.lateMinutes ?: 0) > 0) Text("Late by ${d.lateMinutes} min", fontSize = 18.sp, color = Brand.Warning)
                    Spacer(Modifier.height(16.dp)); Text("Have a productive day.", fontSize = 22.sp)
                }
                PunchDisplay.Kind.CHECK_OUT -> {
                    Text("Check In: ${d.checkIn ?: "—"}", fontSize = 24.sp)
                    Text("Check Out: ${d.checkOut ?: "—"}", fontSize = 24.sp)
                    Spacer(Modifier.height(12.dp))
                    Text("Working Hours", fontSize = 18.sp, color = Brand.Muted)
                    Text(d.workingMinutes?.let { "${it / 60}h ${it % 60}m" } ?: "—", fontSize = 36.sp, fontWeight = FontWeight.Bold)
                }
                PunchDisplay.Kind.ALREADY_IN, PunchDisplay.Kind.ALREADY_OUT -> {
                    d.checkIn?.let { Text("Check-in: $it", fontSize = 24.sp) }
                    d.checkOut?.let { Text("Check-out: $it", fontSize = 24.sp) }
                }
                else -> d.message?.let { Text(it, fontSize = 20.sp, textAlign = TextAlign.Center) }
            }
            if (d.offline) { Spacer(Modifier.height(20.dp)); Text("● Saved offline — will sync automatically", color = Brand.Warning, fontSize = 16.sp) }
            if (d.flagged) { Spacer(Modifier.height(8.dp)); Text("Sent to HR for review", color = Brand.Warning, fontSize = 16.sp) }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
private fun Modifier.combinedClickableNoRipple(onClick: () -> Unit) =
    this.then(Modifier.combinedClickable(interactionSource = MutableInteractionSource(), indication = null, onClick = onClick))

// ===================================================================== enrollment

@Composable
private fun EnrollmentScreen(terminal: TerminalController, pending: PendingEnrollment) {
    val scope = rememberCoroutineScope()
    var progress by remember(pending.sessionId) { mutableStateOf<String?>(null) }
    var result by remember(pending.sessionId) { mutableStateOf<BiometricSync.Outcome?>(null) }
    var running by remember(pending.sessionId) { mutableStateOf(false) }
    val finger = (pending.fingerPosition ?: "RIGHT_INDEX").lowercase().replace('_', ' ')
    Centered {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth(0.8f)) {
            Text("FINGERPRINT ENROLLMENT", color = Brand.Gold, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
            Spacer(Modifier.height(8.dp))
            Text(pending.employeeName, fontSize = 32.sp, fontWeight = FontWeight.Bold)
            Text("${pending.employeeCode} · $finger finger", fontSize = 18.sp, color = Brand.Muted)
            Spacer(Modifier.height(28.dp))
            when {
                result != null -> {
                    val r = result!!
                    val ok = r is BiometricSync.Outcome.Enrolled
                    Text(if (ok) "✓ Enrolled" else "Enrollment failed", fontSize = 28.sp, fontWeight = FontWeight.Bold,
                        color = if (ok) Brand.Success else Brand.Error)
                    if (r is BiometricSync.Outcome.Failed) Text(r.message, textAlign = TextAlign.Center, fontSize = 18.sp)
                    LaunchedEffect(r) { delay(4_000); terminal.dismissEnrollment() }
                }
                running -> {
                    PulsingFingerprint()
                    Spacer(Modifier.height(16.dp))
                    Text(progress ?: "Place your finger on the scanner", fontSize = 24.sp, textAlign = TextAlign.Center)
                    SimulatedFingerButtons()
                }
                else -> {
                    Text("HR has requested fingerprint enrollment.\nPlace the $finger finger on the scanner three times when asked.",
                        fontSize = 18.sp, textAlign = TextAlign.Center)
                    Spacer(Modifier.height(24.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        OutlinedButton(onClick = { scope.launch { terminal.declineEnrollment(pending) } }, modifier = Modifier.height(60.dp)) {
                            Text("Not now", fontSize = 18.sp)
                        }
                        Button(onClick = {
                            running = true
                            scope.launch {
                                result = terminal.enroll(pending) { p ->
                                    progress = when (p) {
                                        is EnrollmentProgress.PlaceFinger -> "Place finger — scan ${p.sample} of ${p.of}"
                                        EnrollmentProgress.LiftFinger -> "Lift your finger"
                                        is EnrollmentProgress.SampleAccepted -> "Scan ${p.sample} captured (quality ${p.quality})"
                                        is EnrollmentProgress.SampleRejected -> p.reason
                                    }
                                }
                                running = false
                            }
                        }, modifier = Modifier.height(60.dp)) { Text("Start enrollment", fontSize = 18.sp) }
                    }
                }
            }
        }
    }
}

// ===================================================================== registration

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RegistrationScreen(terminal: TerminalController, p: Phase.Unregistered) {
    val scope = rememberCoroutineScope()
    var branchId by remember { mutableStateOf<Long?>(null) }
    var locationId by remember { mutableStateOf<Long?>(null) }
    var name by remember { mutableStateOf("") }
    var pairing by remember { mutableStateOf(false) }
    var code by remember { mutableStateOf("") }
    val options = p.options

    Centered {
        Column(Modifier.fillMaxWidth(0.75f), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("ARUDRACS ATTENDANCE", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = Brand.DeepNavy)
            Text("Device not registered.", fontSize = 18.sp, color = Brand.Muted)
            Spacer(Modifier.height(16.dp))
            Text("Device ID", color = Brand.Muted)
            Text(terminal.deviceUuid.take(8).uppercase(Locale.ROOT), fontSize = 28.sp, fontWeight = FontWeight.Bold, letterSpacing = 4.sp)
            Text(terminal.deviceUuid, fontSize = 11.sp, color = Brand.Muted)
            Spacer(Modifier.height(24.dp))

            if (pairing) {
                OutlinedTextField(value = code, onValueChange = { code = it.uppercase(Locale.ROOT).take(9) }, label = { Text("Pairing code from ArudraCS") },
                    singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(16.dp))
                Button(onClick = { scope.launch { terminal.register(null, null, null, code) } }, enabled = code.length >= 8 && !p.busy,
                    modifier = Modifier.fillMaxWidth().height(60.dp)) { Text("PAIR DEVICE", fontSize = 18.sp) }
            } else if (options == null) {
                Text("Cannot reach ArudraCS. Check the network connection.", color = Brand.Error)
                Spacer(Modifier.height(12.dp))
                OutlinedButton(onClick = { terminal.retryNow() }) { Text("Retry") }
            } else {
                Picker("Branch", options.branches.map { it.id to it.name }, branchId) { branchId = it; locationId = null }
                Spacer(Modifier.height(12.dp))
                Picker("Attendance Location",
                    options.locations.filter { branchId == null || it.branchId == null || it.branchId == branchId }.map { it.id to it.name },
                    locationId) { locationId = it }
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(value = name, onValueChange = { name = it.take(60) }, label = { Text("Device name (optional)") },
                    singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(20.dp))
                Button(onClick = { scope.launch { terminal.register(branchId, locationId, name, null) } },
                    enabled = branchId != null && locationId != null && !p.busy,
                    modifier = Modifier.fillMaxWidth().height(60.dp)) { Text("REQUEST REGISTRATION", fontSize = 18.sp) }
            }
            Spacer(Modifier.height(8.dp))
            TextButton(onClick = { pairing = !pairing }) { Text(if (pairing) "Request approval instead" else "I have a pairing code") }
            if (p.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            p.error?.let { Text(it, color = Brand.Error, textAlign = TextAlign.Center) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun Picker(label: String, items: List<Pair<Long, String>>, selected: Long?, onSelect: (Long) -> Unit) {
    var open by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = open, onExpandedChange = { open = it }) {
        OutlinedTextField(value = items.firstOrNull { it.first == selected }?.second ?: "", onValueChange = {}, readOnly = true,
            label = { Text(label) }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(open) },
            modifier = Modifier.menuAnchor().fillMaxWidth())
        ExposedDropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            items.forEach { (id, text) -> DropdownMenuItem(text = { Text(text) }, onClick = { onSelect(id); open = false }) }
        }
    }
}

// ===================================================================== admin

@Composable
private fun AdminLoginDialog(terminal: TerminalController, onDismiss: () -> Unit, onUnlocked: () -> Unit) {
    val scope = rememberCoroutineScope()
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Administrator sign-in") },
        text = {
            Column {
                Text("Sign in with an ArudraCS account that can manage attendance devices.", fontSize = 14.sp, color = Brand.Muted)
                OutlinedTextField(email, { email = it }, label = { Text("Email") }, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email))
                OutlinedTextField(password, { password = it }, label = { Text("Password") }, singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
                error?.let { Text(it, color = Brand.Error) }
            }
        },
        confirmButton = {
            Button(enabled = !busy && email.isNotBlank() && password.isNotBlank(), onClick = {
                busy = true
                scope.launch {
                    val ok = terminal.adminUnlock(email, password)
                    busy = false
                    password = ""
                    if (ok) onUnlocked() else error = "Not authorised (needs online sign-in as an HR administrator)."
                }
            }) { Text("Unlock") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
    LaunchedEffect(Unit) { delay(60_000); onDismiss() }
}

@Composable
private fun AdminPanel(terminal: TerminalController, status: TerminalStatus, maintenance: Boolean,
                       onMaintenance: (Boolean) -> Unit, onDismiss: () -> Unit) {
    val scope = rememberCoroutineScope()
    Dialog(onDismissRequest = onDismiss) {
        Surface(shape = RoundedCornerShape(16.dp)) {
            Column(Modifier.padding(24.dp).widthIn(min = 360.dp)) {
                Text("Terminal administration", fontSize = 22.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(12.dp))
                listOf(
                    "Device" to "${status.deviceName ?: "—"} (${status.deviceCode ?: "—"})",
                    "Device UUID" to terminal.deviceUuid,
                    "Branch / location" to "${status.branch ?: "—"} / ${status.location ?: "—"}",
                    "Network" to if (status.online) "Online" else "Offline",
                    "Scanner" to status.scanner,
                    "Pending sync" to status.pendingSync.toString(),
                    "Clock" to if (status.clockTrusted) "Verified with server" else "Not verified",
                    "Kiosk lock" to if (status.deviceOwner) "Device owner (locked)" else "NOT device owner",
                    "App" to "${BuildConfig.VERSION_NAME} · ${BuildConfig.SCANNER_VENDOR}",
                ).forEach { (k, v) ->
                    Row(Modifier.padding(vertical = 3.dp)) { Text(k, color = Brand.Muted, modifier = Modifier.width(150.dp)); Text(v) }
                }
                Spacer(Modifier.height(16.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = { scope.launch { terminal.syncNow() } }) { Text("Sync now") }
                    OutlinedButton(onClick = { terminal.retryNow() }) { Text("Reconnect") }
                }
                Spacer(Modifier.height(8.dp))
                OutlinedButton(onClick = { onMaintenance(!maintenance) }) {
                    Text(if (maintenance) "End maintenance (re-lock)" else "Maintenance mode (unlock for updates)")
                }
                Spacer(Modifier.height(16.dp))
                TextButton(onClick = { if (maintenance) onMaintenance(false); onDismiss() }, modifier = Modifier.align(Alignment.End)) { Text("Close & lock") }
            }
        }
    }
    // Never leave the admin panel (or maintenance) open on an unattended terminal.
    val inMaintenance by rememberUpdatedState(maintenance)
    LaunchedEffect(Unit) { delay(5 * 60_000); if (inMaintenance) onMaintenance(false); onDismiss() }
}
