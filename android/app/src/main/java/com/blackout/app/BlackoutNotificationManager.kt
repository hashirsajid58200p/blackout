package com.blackout.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat

object BlackoutNotificationManager {
    private const val TAG = "BlackoutNotification"

    const val CHANNEL_ALERTS = "blackout_alerts"
    const val CHANNEL_DAILY = "blackout_daily"
    const val CHANNEL_STATUS = "blackout_status"

    private const val PREFS_NAME = "BlackoutPrefs"
    private const val KEY_NOTIF_WARNINGS = "notif_warnings_enabled"
    private const val KEY_NOTIF_LOCKS = "notif_locks_enabled"
    private const val KEY_NOTIF_RESET = "notif_reset_enabled"

    // Deduplication map so warnings are not spammed continuously in the same session
    private val warnedPackagesToday = mutableSetOf<String>()

    fun initChannels(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = context.getSystemService(NotificationManager::class.java) ?: return

            // Channel 1: High Priority Heads-up Alerts (5m warnings & lockout events)
            val alertsChannel = NotificationChannel(
                CHANNEL_ALERTS,
                "Blackout Lock & Warning Alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Critical warnings when allowances near completion and lockout confirmations"
                enableVibration(true)
                setShowBadge(true)
            }
            manager.createNotificationChannel(alertsChannel)

            // Channel 2: Daily Reports (Midnight Reset)
            val dailyChannel = NotificationChannel(
                CHANNEL_DAILY,
                "Daily Focus Briefs",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Midnight reset notifications and daily focus reports"
                enableVibration(false)
                setShowBadge(true)
            }
            manager.createNotificationChannel(dailyChannel)

            // Channel 3: Ongoing Status Bar Indicator (Low Importance)
            val statusChannel = NotificationChannel(
                CHANNEL_STATUS,
                "Ongoing Focus Monitor",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Persistent status bar indicator showing active limits and screen time"
                enableVibration(false)
                setShowBadge(false)
            }
            manager.createNotificationChannel(statusChannel)

            Log.d(TAG, "Notification channels initialized successfully")
        }
    }

    private fun getLaunchPendingIntent(context: Context): PendingIntent {
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            ?: Intent(context, MainActivity::class.java)
        launchIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or
                (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        return PendingIntent.getActivity(context, 0, launchIntent, flags)
    }

    fun sendWarningNotification(context: Context, packageName: String, appName: String, remainingMins: Int) {
        try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            if (!prefs.getBoolean(KEY_NOTIF_WARNINGS, true)) {
                return
            }

            // Deduplicate: Send warning only once per package per session
            if (warnedPackagesToday.contains(packageName)) {
                return
            }
            warnedPackagesToday.add(packageName)

            initChannels(context)

            val pendingIntent = getLaunchPendingIntent(context)
            val builder = NotificationCompat.Builder(context, CHANNEL_ALERTS)
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setContentTitle("BLACKOUT WARNING // ${appName.uppercase()}")
                .setContentText("Allowance expiring in ${remainingMins}m. App will lock until midnight.")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)

            val manager = context.getSystemService(NotificationManager::class.java)
            val notifId = (packageName.hashCode() and 0x7FFFFFFF) % 10000 + 1000
            manager?.notify(notifId, builder.build())
            Log.d(TAG, "Sent 5m warning notification for $appName (ID: $notifId)")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send warning notification", e)
        }
    }

    fun sendLockoutNotification(context: Context, packageName: String, appName: String) {
        try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            if (!prefs.getBoolean(KEY_NOTIF_LOCKS, true)) {
                return
            }

            initChannels(context)

            val pendingIntent = getLaunchPendingIntent(context)
            val builder = NotificationCompat.Builder(context, CHANNEL_ALERTS)
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setContentTitle("LOCKED // ${appName.uppercase()}")
                .setContentText("Daily allowance reached. ${appName} is locked until 12:00 AM midnight.")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_STATUS)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)

            val manager = context.getSystemService(NotificationManager::class.java)
            val notifId = (packageName.hashCode() and 0x7FFFFFFF) % 10000 + 2000
            manager?.notify(notifId, builder.build())
            Log.d(TAG, "Sent lockout notification for $appName (ID: $notifId)")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send lockout notification", e)
        }
    }

    fun sendMidnightResetNotification(context: Context, unlockedCount: Int) {
        try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            if (!prefs.getBoolean(KEY_NOTIF_RESET, true)) {
                return
            }

            warnedPackagesToday.clear()
            initChannels(context)

            val pendingIntent = getLaunchPendingIntent(context)
            val textContent = if (unlockedCount > 0) {
                "Midnight reset complete. Daily limits for $unlockedCount applications restored."
            } else {
                "Midnight reset complete. Allowances restored for deliberate focus."
            }

            val builder = NotificationCompat.Builder(context, CHANNEL_DAILY)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle("NEW DAY RESET // LIMITS RESTORED")
                .setContentText(textContent)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)

            val manager = context.getSystemService(NotificationManager::class.java)
            manager?.notify(9001, builder.build())
            Log.d(TAG, "Sent midnight reset notification")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send midnight reset notification", e)
        }
    }

    fun clearWarning(packageName: String) {
        warnedPackagesToday.remove(packageName)
    }
}
