package com.arudracs.attendance

import android.app.Application
import com.arudracs.attendance.terminal.TerminalController
import com.arudracs.attendance.work.SyncWorker

class AttendanceApp : Application() {
    /** Single terminal brain for the process; the kiosk UI and the sync worker share it. */
    lateinit var terminal: TerminalController
        private set

    override fun onCreate() {
        super.onCreate()
        terminal = TerminalController(this)
        terminal.start()
        SyncWorker.schedule(this)
    }
}
