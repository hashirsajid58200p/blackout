package com.blackout.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import org.json.JSONArray
import java.util.Calendar
import java.util.TimeZone

object SecurityHelper {
    private const val TAG = "BlackoutSecurity"
    private const val PREFS_FILE = "BlackoutSecurePrefs"
    private const val KEY_LOCKED_APPS_JSON = "locked_apps_json"
    private const val KEY_LOCK_EXPIRATION = "lock_expiration_timestamp"
    private const val KEY_HAS_ACTIVE_LOCKS = "has_active_locks"

    private fun getPreferences(context: Context): SharedPreferences {
        return try {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()

            EncryptedSharedPreferences.create(
                context,
                PREFS_FILE,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            Log.w(TAG, "EncryptedSharedPreferences init failed, falling back to private prefs", e)
            context.getSharedPreferences("BlackoutPrivatePrefs", Context.MODE_PRIVATE)
        }
    }

    /**
     * Calculates the exact millisecond epoch for 12:00:00 AM the following day.
     */
    fun getNextMidnightTimestamp(): Long {
        val calendar = Calendar.getInstance(TimeZone.getDefault()).apply {
            add(Calendar.DAY_OF_YEAR, 1)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        return calendar.timeInMillis
    }

    /**
     * Safely stores locked apps and sets the 12:00 AM next day expiration timestamp.
     */
    fun saveLockedApps(context: Context, jsonString: String) {
        try {
            val prefs = getPreferences(context)
            val nextMidnight = getNextMidnightTimestamp()

            val blockedSet = mutableSetOf<String>()
            try {
                val jsonArray = JSONArray(jsonString)
                for (i in 0 until jsonArray.length()) {
                    val item = jsonArray.optJSONObject(i)
                    if (item != null) {
                        val pkg = item.optString("packageName")
                        val isLocked = item.optBoolean("isLocked", false)
                        val usedTodayMs = item.optDouble("usedTodayMs", 0.0)
                        val dailyLimitMs = item.optDouble("dailyLimitMs", 0.0)
                        if (pkg.isNotEmpty() && (isLocked || (dailyLimitMs > 0 && usedTodayMs >= dailyLimitMs))) {
                            blockedSet.add(pkg)
                        }
                    } else {
                        val pkg = jsonArray.optString(i)
                        if (pkg.isNotEmpty()) {
                            blockedSet.add(pkg)
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error parsing locked apps JSON", e)
            }

            val hasLocks = blockedSet.isNotEmpty()
            prefs.edit()
                .putString(KEY_LOCKED_APPS_JSON, jsonString)
                .putLong(KEY_LOCK_EXPIRATION, if (hasLocks) nextMidnight else 0L)
                .putBoolean(KEY_HAS_ACTIVE_LOCKS, hasLocks)
                .apply()

            val blackoutPrefs = context.getSharedPreferences("BlackoutPrefs", Context.MODE_PRIVATE)
            blackoutPrefs.edit().putString("locked_apps_json", jsonString).apply()

            BlackoutAccessibilityService.lockedPackages = blockedSet
            scheduleMidnightReset(context)
            Log.d(TAG, "Saved locked apps. Has active locks: $hasLocks, next midnight: $nextMidnight, packages: $blockedSet")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to save locked apps in SecurityHelper", e)
        }
    }

    /**
     * Schedules an exact AlarmManager alarm to trigger MidnightResetReceiver at 12:00 AM daily.
     */
    fun scheduleMidnightReset(context: Context) {
        try {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val intent = Intent(context, MidnightResetReceiver::class.java)
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
            val pendingIntent = PendingIntent.getBroadcast(context, 1001, intent, flags)

            val calendar = Calendar.getInstance(TimeZone.getDefault()).apply {
                add(Calendar.DAY_OF_YEAR, 1)
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            val triggerTime = calendar.timeInMillis

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
                } else {
                    Log.w(TAG, "SCHEDULE_EXACT_ALARM not granted, falling back to setAndAllowWhileIdle")
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
            }
            Log.d(TAG, "Midnight reset alarm scheduled successfully for: $triggerTime (${calendar.time})")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to schedule midnight reset alarm", e)
        }
    }

    /**
     * Resets usedTodayMs and isLocked flags across all apps in SharedPreferences at midnight.
     */
    fun resetMidnightLocks(context: Context) {
        try {
            val prefs = getPreferences(context)
            val jsonString = prefs.getString(KEY_LOCKED_APPS_JSON, null)
            var updatedJsonString: String? = null
            if (jsonString != null) {
                val jsonArray = JSONArray(jsonString)
                val updatedArray = JSONArray()
                for (i in 0 until jsonArray.length()) {
                    val item = jsonArray.optJSONObject(i)
                    if (item != null) {
                        item.put("isLocked", false)
                        item.put("usedTodayMs", 0.0)
                        updatedArray.put(item)
                    } else {
                        updatedArray.put(jsonArray.get(i))
                    }
                }
                updatedJsonString = updatedArray.toString()
                prefs.edit()
                    .putString(KEY_LOCKED_APPS_JSON, updatedJsonString)
                    .putLong(KEY_LOCK_EXPIRATION, 0L)
                    .putBoolean(KEY_HAS_ACTIVE_LOCKS, false)
                    .apply()
            } else {
                prefs.edit()
                    .putLong(KEY_LOCK_EXPIRATION, 0L)
                    .putBoolean(KEY_HAS_ACTIVE_LOCKS, false)
                    .apply()
            }

            val blackoutPrefs = context.getSharedPreferences("BlackoutPrefs", Context.MODE_PRIVATE)
            val bEditor = blackoutPrefs.edit()
            val allEntries = blackoutPrefs.all
            for ((key, _) in allEntries) {
                if (key.startsWith("realtime_usage_")) {
                    bEditor.remove(key)
                }
            }
            if (updatedJsonString != null) {
                bEditor.putString("locked_apps_json", updatedJsonString)
            }
            bEditor.apply()

            BlackoutAccessibilityService.lockedPackages.clear()
            BlackoutAccessibilityService.instance?.resetDailyUsage()
            Log.d(TAG, "Midnight reset successfully completed: lock flags cleared.")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to reset midnight locks", e)
        }
    }

    /**
     * Checks if there are active locks that have NOT yet expired at midnight.
     */
    fun hasActiveLocks(context: Context): Boolean {
        return try {
            val prefs = getPreferences(context)
            val expiration = prefs.getLong(KEY_LOCK_EXPIRATION, 0L)
            val now = System.currentTimeMillis()

            if (expiration > 0 && now >= expiration) {
                // Midnight has passed! Reset expired locks
                Log.d(TAG, "Midnight passed (now=$now >= expiration=$expiration). Clearing active locks.")
                resetMidnightLocks(context)
                return false
            }

            val jsonString = prefs.getString(KEY_LOCKED_APPS_JSON, null) ?: return false
            val jsonArray = JSONArray(jsonString)
            for (i in 0 until jsonArray.length()) {
                val item = jsonArray.optJSONObject(i)
                if (item != null) {
                    val isLocked = item.optBoolean("isLocked", false)
                    var usedTodayMs = item.optDouble("usedTodayMs", 0.0)
                    val dailyLimitMs = item.optDouble("dailyLimitMs", 0.0)
                    val pkg = item.optString("packageName")
                    if (dailyLimitMs > 0 && pkg.isNotEmpty()) {
                        val liveUsage = getTodayPackageUsage(context, pkg)
                        if (liveUsage > usedTodayMs) {
                            usedTodayMs = liveUsage.toDouble()
                        }
                    }
                    if (isLocked || (dailyLimitMs > 0 && usedTodayMs >= dailyLimitMs)) {
                        return true
                    }
                } else {
                    val pkg = jsonArray.optString(i)
                    if (pkg.isNotEmpty()) return true
                }
            }
            false
        } catch (e: Exception) {
            Log.e(TAG, "Error checking active locks", e)
            false
        }
    }


    /**
     * Reads usedTodayMs and dailyLimitMs from locked_apps_json in SharedPreferences,
     * cross-checking with UsageStatsManager for the most real-time data.
     */
    /**
     * Calculates the millisecond foreground usage of a package since local midnight
     * using fine-grained UsageEvents to ensure exact parity with Digital Wellbeing.
     * Accurately pauses on screen lock / off and eliminates historical bucket inflation.
     */
    fun getTodayPackageUsage(context: Context, packageName: String): Long {
        try {
            val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return 0L
            val calendar = Calendar.getInstance(TimeZone.getDefault()).apply {
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            val startTime = calendar.timeInMillis
            val endTime = System.currentTimeMillis()
            val events = usageStatsManager.queryEvents(startTime, endTime) ?: return 0L
            val event = UsageEvents.Event()

            var totalUsage = 0L
            var currentPkg: String? = null
            var currentStart = 0L

            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                val pkg = event.packageName ?: continue
                val time = event.timeStamp
                val type = event.eventType

                when (type) {
                    UsageEvents.Event.ACTIVITY_RESUMED -> {
                        if (currentPkg != null && currentPkg == packageName) {
                            val duration = time - currentStart
                            if (duration > 0) totalUsage += duration
                        }
                        currentPkg = pkg
                        currentStart = time
                    }
                    UsageEvents.Event.ACTIVITY_PAUSED -> {
                        if (currentPkg != null && currentPkg == pkg) {
                            if (pkg == packageName) {
                                val duration = time - currentStart
                                if (duration > 0) totalUsage += duration
                            }
                            currentPkg = null
                            currentStart = 0L
                        }
                    }
                    16 /* SCREEN_NON_INTERACTIVE */,
                    17 /* KEYGUARD_SHOWN */,
                    26 /* DEVICE_SHUTDOWN */ -> {
                        if (currentPkg != null) {
                            if (currentPkg == packageName) {
                                val duration = time - currentStart
                                if (duration > 0) totalUsage += duration
                            }
                            currentPkg = null
                            currentStart = 0L
                        }
                    }
                }
            }

            if (currentPkg != null && currentPkg == packageName && currentStart > 0L) {
                val duration = endTime - currentStart
                if (duration > 0) totalUsage += duration
            }

            return totalUsage
        } catch (e: Exception) {
            Log.e(TAG, "Error in getTodayPackageUsage for $packageName", e)
            return 0L
        }
    }

    /**
     * Persistently marks a package as locked in SharedPreferences.
     */
    fun markPackageLocked(context: Context, packageName: String) {
        try {
            val prefs = getPreferences(context)
            val jsonString = prefs.getString(KEY_LOCKED_APPS_JSON, null) ?: return
            val jsonArray = JSONArray(jsonString)
            val updated = JSONArray()
            for (i in 0 until jsonArray.length()) {
                val item = jsonArray.optJSONObject(i)
                if (item != null) {
                    if (item.optString("packageName") == packageName) {
                        item.put("isLocked", true)
                    }
                    updated.put(item)
                } else {
                    updated.put(jsonArray.get(i))
                }
            }
            val nextMidnight = getNextMidnightTimestamp()
            prefs.edit()
                .putString(KEY_LOCKED_APPS_JSON, updated.toString())
                .putLong(KEY_LOCK_EXPIRATION, nextMidnight)
                .putBoolean(KEY_HAS_ACTIVE_LOCKS, true)
                .apply()

            val blackoutPrefs = context.getSharedPreferences("BlackoutPrefs", Context.MODE_PRIVATE)
            blackoutPrefs.edit().putString("locked_apps_json", updated.toString()).apply()

            BlackoutAccessibilityService.lockedPackages.add(packageName)
            Log.d(TAG, "Marked package as locked: $packageName")
        } catch (e: Exception) {
            Log.e(TAG, "Error marking package locked", e)
        }
    }
}
