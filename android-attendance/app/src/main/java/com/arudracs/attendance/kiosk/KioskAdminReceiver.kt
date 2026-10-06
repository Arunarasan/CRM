package com.arudracs.attendance.kiosk

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent

/** Device-owner receiver. Policies are (re)applied by [KioskPolicy] whenever the kiosk starts. */
class KioskAdminReceiver : DeviceAdminReceiver() {
    override fun onEnabled(context: Context, intent: Intent) {
        KioskPolicy.apply(context)
    }
}
