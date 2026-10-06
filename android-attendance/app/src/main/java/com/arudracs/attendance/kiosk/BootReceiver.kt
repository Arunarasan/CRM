package com.arudracs.attendance.kiosk

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.arudracs.attendance.ui.MainActivity
import com.arudracs.attendance.work.SyncWorker

/** Brings the kiosk back after a reboot or an app update, and re-arms background sync. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        SyncWorker.schedule(context)
        context.startActivity(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}
