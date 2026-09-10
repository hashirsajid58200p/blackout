package com.blackout.app

import android.app.AlarmManager
import android.app.PendingIntent
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

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
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
                prefs.edit()
                    .putString(KEY_LOCKED_APPS_JSON, updatedArray.toString())
                    .putLong(KEY_LOCK_EXPIRATION, 0L)
                    .putBoolean(KEY_HAS_ACTIVE_LOCKS, false)
                    .apply()
            } else {
                prefs.edit()
                    .putLong(KEY_LOCK_EXPIRATION, 0L)
                    .putBoolean(KEY_HAS_ACTIVE_LOCKS, false)
                    .apply()
            }

            BlackoutAccessibilityService.lockedPackages = emptySet()
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
                    val usedTodayMs = item.optDouble("usedTodayMs", 0.0)
                    val dailyLimitMs = item.optDouble("dailyLimitMs", 0.0)
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

    data class AppUsageLimitInfo(
        val isLocked: Boolean,
        val usedTodayMs: Long,
        val dailyLimitMs: Long
    )

    /**
     * Reads usedTodayMs and dailyLimitMs from locked_apps_json in SharedPreferences,
     * cross-checking with UsageStatsManager for the most real-time data.
     */
    fun getPackageUsageLimit(context: Context, packageName: String): AppUsageLimitInfo? {
        return try {
            val prefs = getPreferences(context)
            val jsonString = prefs.getString(KEY_LOCKED_APPS_JSON, null) ?: return null
            val jsonArray = JSONArray(jsonString)
            for (i in 0 until jsonArray.length()) {
                val item = jsonArray.optJSONObject(i)
                if (item != null && item.optString("packageName") == packageName) {
                    val isLocked = item.optBoolean("isLocked", false)
                    val limit = item.optDouble("dailyLimitMs", 0.0).toLong()
                    var used = item.optDouble("usedTodayMs", 0.0).toLong()

                    // Cross-check with UsageStatsManager for real-time foreground time
                    try {
                        val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as? android.app.usage.UsageStatsManager
                        if (usageStatsManager != null) {
                            val calendar = Calendar.getInstance(TimeZone.getDefault()).apply {
                                set(Calendar.HOUR_OF_DAY, 0)
                                set(Calendar.MINUTE, 0)
                                set(Calendar.SECOND, 0)
                                set(Calendar.MILLISECOND, 0)
                            }
                            val stats = usageStatsManager.queryUsageStats(
                                android.app.usage.UsageStatsManager.INTERVAL_DAILY,
                                calendar.timeInMillis,
                                System.currentTimeMillis()
                            )
                            val stat = stats?.find { it.packageName == packageName }
                            if (stat != null && stat.totalTimeInForeground > used) {
                                used = stat.totalTimeInForeground
                            }
                        }
                    } catch (e: Exception) {
                        // ignore
                    }

                    return AppUsageLimitInfo(
                        isLocked = isLocked || (limit > 0 && used >= limit),
                        usedTodayMs = used,
                        dailyLimitMs = limit
                    )
                }
            }
            null
        } catch (e: Exception) {
            Log.e(TAG, "Error in getPackageUsageLimit", e)
            null
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
            BlackoutAccessibilityService.lockedPackages = BlackoutAccessibilityService.lockedPackages + packageName
            Log.d(TAG, "Marked package as locked: $packageName")
        } catch (e: Exception) {
            Log.e(TAG, "Error marking package locked", e)
        }
    }

    /**
     * Returns true if the given package name is currently blocked.
     */
    fun isPackageBlocked(context: Context, packageName: String): Boolean {
        if (!hasActiveLocks(context)) {
            return false
        }

        if (BlackoutAccessibilityService.lockedPackages.contains(packageName)) {
            return true
        }

        return try {
            val prefs = getPreferences(context)
            val jsonString = prefs.getString(KEY_LOCKED_APPS_JSON, null) ?: return false
            val jsonArray = JSONArray(jsonString)
            for (i in 0 until jsonArray.length()) {
                val item = jsonArray.optJSONObject(i)
                if (item != null) {
                    val pkg = item.optString("packageName")
                    if (pkg == packageName) {
                        val isLocked = item.optBoolean("isLocked", false)
                        val usedTodayMs = item.optDouble("usedTodayMs", 0.0)
                        val dailyLimitMs = item.optDouble("dailyLimitMs", 0.0)
                        if (isLocked || (dailyLimitMs > 0 && usedTodayMs >= dailyLimitMs)) {
                            return true
                        }
                    }
                } else if (jsonArray.optString(i) == packageName) {
                    return true
                }
            }
            false
        } catch (e: Exception) {
            Log.e(TAG, "Error checking package blocked state", e)
            false
        }
    }
}
