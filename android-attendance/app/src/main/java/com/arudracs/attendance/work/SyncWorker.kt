package com.arudracs.attendance.work

import android.content.Context
import androidx.work.*
import com.arudracs.attendance.AttendanceApp
import com.arudracs.attendance.core.api.DeviceRejectedException
import java.util.concurrent.TimeUnit

/**
 * Background safety net for the offline queue: runs when the network returns and every 15 minutes,
 * independently of the UI (the kiosk also syncs immediately after each heartbeat).
 */
class SyncWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        val terminal = (applicationContext as AttendanceApp).terminal
        return try {
            terminal.syncNow()
            Result.success()
        } catch (_: DeviceRejectedException) {
            Result.success() // the terminal controller handles the blocked/revoked state
        } catch (_: Exception) {
            Result.retry()
        }
    }

    companion object {
        private const val PERIODIC = "attendance-sync-periodic"
        private const val NOW = "attendance-sync-now"
        private val network = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

        fun schedule(ctx: Context) {
            WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP,
                PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES).setConstraints(network).build())
        }

        /** Runs as soon as there is connectivity. */
        fun kick(ctx: Context) {
            WorkManager.getInstance(ctx).enqueueUniqueWork(NOW, ExistingWorkPolicy.KEEP,
                OneTimeWorkRequestBuilder<SyncWorker>().setConstraints(network)
                    .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS).build())
        }
    }
}
