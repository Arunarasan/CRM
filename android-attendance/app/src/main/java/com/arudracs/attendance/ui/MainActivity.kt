package com.arudracs.attendance.ui

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.arudracs.attendance.AttendanceApp
import com.arudracs.attendance.kiosk.KioskPolicy

/** The kiosk window: full screen, screen kept on, back disabled, lock-task when device owner. */
class MainActivity : ComponentActivity() {

    /** True while a CRM admin has the terminal in maintenance mode (lock-task lifted). */
    var maintenance = false
        private set

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE) // no screenshots / screen recording of the kiosk
        WindowCompat.setDecorFitsSystemWindows(window, false)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() { /* kiosk: back does nothing */ }
        })
        KioskPolicy.apply(this)
        val terminal = (application as AttendanceApp).terminal
        setContent {
            KioskTheme {
                KioskApp(terminal = terminal, onMaintenance = ::setMaintenance)
            }
        }
    }

    override fun onResume() {
        super.onResume()
        hideSystemBars()
        if (!maintenance) KioskPolicy.startLockTask(this)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    private fun setMaintenance(on: Boolean) {
        maintenance = on
        if (on) KioskPolicy.enterMaintenance(this) else KioskPolicy.exitMaintenance(this)
    }

    private fun hideSystemBars() {
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }
}
