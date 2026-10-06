package com.arudracs.attendance.kiosk

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.app.admin.SystemUpdatePolicy
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.UserManager
import android.provider.Settings
import android.util.Log
import com.arudracs.attendance.ui.MainActivity

/**
 * Locks the terminal down when this app is the DEVICE OWNER (provisioned once by IT with
 * `adb shell dpm set-device-owner com.arudracs.attendance/.kiosk.KioskAdminReceiver` on a freshly
 * reset device, or via QR/zero-touch provisioning).
 *
 * Employees cannot: open Settings or other apps (lock-task, no status bar, no home/recents/notifications),
 * change date/time or time zone (forced network time + DISALLOW_CONFIG_DATE_TIME), uninstall the app,
 * factory reset, boot to safe mode, add users, use USB file transfer / ADB, mount media, install apps.
 * The app is the persistent HOME activity, so a reboot lands straight back in the kiosk.
 *
 * Maintenance (app update, Wi-Fi change) is done from the admin screen after a CRM admin signs in:
 * [enterMaintenance] lifts the restrictions temporarily; [apply] re-locks.
 */
object KioskPolicy {
    private const val TAG = "KioskPolicy"

    private val RESTRICTIONS = listOf(
        UserManager.DISALLOW_CONFIG_DATE_TIME,
        UserManager.DISALLOW_FACTORY_RESET,
        UserManager.DISALLOW_SAFE_BOOT,
        UserManager.DISALLOW_ADD_USER,
        UserManager.DISALLOW_UNINSTALL_APPS,
        UserManager.DISALLOW_INSTALL_APPS,
        UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES,
        UserManager.DISALLOW_DEBUGGING_FEATURES,
        UserManager.DISALLOW_USB_FILE_TRANSFER,
        UserManager.DISALLOW_MOUNT_PHYSICAL_MEDIA,
        UserManager.DISALLOW_MODIFY_ACCOUNTS,
        UserManager.DISALLOW_NETWORK_RESET,
        UserManager.DISALLOW_CREATE_WINDOWS,
        UserManager.DISALLOW_SYSTEM_ERROR_DIALOGS,
    )
    /** Lifted during admin maintenance so an updated APK can be installed over ADB / MDM. */
    private val MAINTENANCE_LIFT = listOf(
        UserManager.DISALLOW_INSTALL_APPS,
        UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES,
        UserManager.DISALLOW_DEBUGGING_FEATURES,
    )

    private fun dpm(ctx: Context) = ctx.getSystemService(DevicePolicyManager::class.java)
    private fun admin(ctx: Context) = ComponentName(ctx, KioskAdminReceiver::class.java)

    fun isDeviceOwner(ctx: Context): Boolean = dpm(ctx).isDeviceOwnerApp(ctx.packageName)

    /** Idempotent; safe to call on every start. No-op (logged) when not device owner. */
    fun apply(ctx: Context) {
        if (!isDeviceOwner(ctx)) {
            Log.w(TAG, "Not device owner — kiosk lockdown unavailable (screen pinning only).")
            return
        }
        val dpm = dpm(ctx)
        val admin = admin(ctx)
        try {
            dpm.setLockTaskPackages(admin, arrayOf(ctx.packageName))
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                dpm.setLockTaskFeatures(admin, DevicePolicyManager.LOCK_TASK_FEATURE_NONE)
            }
            RESTRICTIONS.forEach { dpm.addUserRestriction(admin, it) }
            dpm.setStatusBarDisabled(admin, true)
            dpm.setKeyguardDisabled(admin, true)
            dpm.setUninstallBlocked(admin, ctx.packageName, true)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                dpm.setAutoTimeEnabled(admin, true)
                dpm.setAutoTimeZoneEnabled(admin, true)
            } else {
                @Suppress("DEPRECATION")
                dpm.setAutoTimeRequired(admin, true)
            }
            dpm.setGlobalSetting(admin, Settings.Global.STAY_ON_WHILE_PLUGGED_IN,
                (BatteryManager.BATTERY_PLUGGED_AC or BatteryManager.BATTERY_PLUGGED_USB or BatteryManager.BATTERY_PLUGGED_WIRELESS).toString())
            // OS updates only at night so the terminal is never rebooting during office hours.
            dpm.setSystemUpdatePolicy(admin, SystemUpdatePolicy.createWindowedInstallPolicy(2 * 60, 4 * 60))
            dpm.addPersistentPreferredActivity(admin,
                IntentFilter(Intent.ACTION_MAIN).apply {
                    addCategory(Intent.CATEGORY_HOME)
                    addCategory(Intent.CATEGORY_DEFAULT)
                },
                ComponentName(ctx, MainActivity::class.java))
        } catch (e: SecurityException) {
            Log.e(TAG, "Applying kiosk policy failed", e)
        }
    }

    fun startLockTask(activity: Activity) {
        if (isDeviceOwner(activity)) {
            runCatching { activity.startLockTask() }.onFailure { Log.e(TAG, "startLockTask failed", it) }
        }
    }

    /** Admin maintenance window: leave lock-task and allow installing an update. Re-lock with [apply]. */
    fun enterMaintenance(activity: Activity) {
        if (!isDeviceOwner(activity)) return
        val dpm = dpm(activity)
        val admin = admin(activity)
        MAINTENANCE_LIFT.forEach { dpm.clearUserRestriction(admin, it) }
        dpm.setStatusBarDisabled(admin, false)
        runCatching { activity.stopLockTask() }
    }

    fun exitMaintenance(activity: Activity) {
        apply(activity)
        startLockTask(activity)
    }
}
