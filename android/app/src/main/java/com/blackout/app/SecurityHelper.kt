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
            val now = System.currentTimeMillis()

            val blockedSet = mutableSetOf<String>()
            try {
                val jsonArray = JSONArray(jsonString)
                for (i in 0 until jsonArray.length()) {
                    val item = jsonArray.optJSONObject(i)
                    if (item != null) {
                        val pkg = item.optString("packageName")
                        val itemExpiration = item.optLong("lockExpirationTimestamp", 0L)
                        if (itemExpiration > 0L && now >= itemExpiration) {
                            // Lock has expired; do not block
                            continue
                        }
                        val isLocked = item.optBoolean("isLocked", false)
                        val usedTodayMs = item.optDouble("usedTodayMs", 0.0)
                        val dailyLimitMs = item.optDouble("dailyLimitMs", 0.0)
                        val initialUsageMs = item.optDouble("initialUsageMs", 0.0)
                        val currentElapsed = Math.max(0.0, usedTodayMs)
                        if (pkg.isNotEmpty() && (isLocked || (dailyLimitMs > 0 && currentElapsed >= dailyLimitMs))) {
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
            Log.e(TAG, "Failed to schedule exact midnight reset alarm, attempting fallback", e)
            try {
                val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
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
                alarmManager?.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, calendar.timeInMillis, pendingIntent)
                Log.d(TAG, "Fallback midnight reset alarm scheduled successfully")
            } catch (fallbackError: Exception) {
                Log.e(TAG, "Fatal: failed fallback midnight alarm schedule", fallbackError)
            }
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
                        item.put("initialUsageMs", 0.0)
                        item.put("lockExpirationTimestamp", 0L)
                        item.remove("lockedAtTimestamp")
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
                    var itemExpiration = item.optLong("lockExpirationTimestamp", 0L)
                    if (itemExpiration <= 0L) {
                        val lockDate = item.optString("lockDate", "")
                        if (lockDate.isNotEmpty()) {
                            try {
                                val parts = lockDate.split("-")
                                if (parts.size == 3) {
                                    val cal = Calendar.getInstance().apply {
                                        set(Calendar.YEAR, parts[0].toInt())
                                        set(Calendar.MONTH, parts[1].toInt() - 1)
                                        set(Calendar.DAY_OF_MONTH, parts[2].toInt())
                                        add(Calendar.DAY_OF_YEAR, 1)
                                        set(Calendar.HOUR_OF_DAY, 0)
                                        set(Calendar.MINUTE, 0)
                                        set(Calendar.SECOND, 0)
                                        set(Calendar.MILLISECOND, 0)
                                    }
                                    itemExpiration = cal.timeInMillis
                                }
                            } catch (e: Exception) {}
                        }
                    }
                    if (itemExpiration > 0L && now >= itemExpiration) {
                        continue // Lock for this item has expired
                    }
                    val isLocked = item.optBoolean("isLocked", false)
                    var usedTodayMs = item.optDouble("usedTodayMs", 0.0)
                    val dailyLimitMs = item.optDouble("dailyLimitMs", 0.0)
                    val initialUsageMs = item.optDouble("initialUsageMs", 0.0)
                    val pkg = item.optString("packageName")
                    if (dailyLimitMs > 0 && pkg.isNotEmpty()) {
                        val liveUsage = getTodayPackageUsage(context, pkg)
                        val liveElapsed = Math.max(0.0, liveUsage.toDouble() - initialUsageMs)
                        if (liveElapsed > usedTodayMs) {
                            usedTodayMs = liveElapsed
                        }
                    }
                    val currentElapsed = Math.max(0.0, usedTodayMs)
                    if (isLocked || (dailyLimitMs > 0 && currentElapsed >= dailyLimitMs)) {
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
            val todayMidnight = calendar.timeInMillis
            val queryStart = todayMidnight - (12 * 3600 * 1000L) // 12-hour lookback before midnight
            val endTime = System.currentTimeMillis()
            val events = usageStatsManager.queryEvents(queryStart, endTime) ?: return 0L
            val event = UsageEvents.Event()

            var totalUsage = 0L
            var currentPkg: String? = null
            var currentStart = 0L
            val activeActivities = mutableSetOf<String>()

            fun addDuration(pkg: String, start: Long, end: Long) {
                if (pkg == packageName) {
                    val effectiveStart = Math.max(start, todayMidnight)
                    val effectiveEnd = Math.max(end, todayMidnight)
                    val duration = effectiveEnd - effectiveStart
                    if (duration > 0) {
                        totalUsage += duration
                    }
                }
            }

            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                val pkg = event.packageName ?: continue
                val time = event.timeStamp
                val type = event.eventType
                val activityClass = event.className ?: "MainActivity"

                when (type) {
                    UsageEvents.Event.ACTIVITY_RESUMED -> {
                        if (currentPkg != null) {
                            if (currentPkg == pkg) {
                                addDuration(currentPkg!!, currentStart, time)
                                currentStart = time
                                activeActivities.add(activityClass)
                            } else {
                                addDuration(currentPkg!!, currentStart, time)
                                currentPkg = pkg
                                currentStart = time
                                activeActivities.clear()
                                activeActivities.add(activityClass)
                            }
                        } else {
                            currentPkg = pkg
                            currentStart = time
                            activeActivities.clear()
                            activeActivities.add(activityClass)
                        }
                    }
                    UsageEvents.Event.ACTIVITY_PAUSED -> {
                        if (currentPkg != null && currentPkg == pkg) {
                            addDuration(pkg, currentStart, time)
                            currentStart = time
                            activeActivities.remove(activityClass)
                            if (activeActivities.isEmpty()) {
                                currentPkg = null
                                currentStart = 0L
                            }
                        }
                    }
                    16 /* SCREEN_NON_INTERACTIVE */,
                    17 /* KEYGUARD_SHOWN */,
                    26 /* DEVICE_SHUTDOWN */ -> {
                        if (currentPkg != null) {
                            addDuration(currentPkg!!, currentStart, time)
                            currentPkg = null
                            currentStart = 0L
                            activeActivities.clear()
                        }
                    }
                }
            }

            if (currentPkg != null && currentStart > 0L) {
                addDuration(currentPkg!!, currentStart, endTime)
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
            val nextMidnight = getNextMidnightTimestamp()
            for (i in 0 until jsonArray.length()) {
                val item = jsonArray.optJSONObject(i)
                if (item != null) {
                    if (item.optString("packageName") == packageName) {
                        item.put("isLocked", true)
                        item.put("lockedAtTimestamp", System.currentTimeMillis())
                        item.put("lockExpirationTimestamp", nextMidnight)
                    }
                    updated.put(item)
                } else {
                    updated.put(jsonArray.get(i))
                }
            }
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

    /**
     * Unlocks a package ONLY if its lock period has completed (now >= expiration).
     * Returns true if unlocked successfully, false if locked and lock period is still active.
     */
    fun unlockPackage(context: Context, packageName: String): Boolean {
        try {
            val prefs = getPreferences(context)
            val expiration = prefs.getLong(KEY_LOCK_EXPIRATION, 0L)
            val now = System.currentTimeMillis()

            val jsonString = prefs.getString(KEY_LOCKED_APPS_JSON, null) ?: return true
            val jsonArray = JSONArray(jsonString)
            var targetItem: org.json.JSONObject? = null
            for (i in 0 until jsonArray.length()) {
                val item = jsonArray.optJSONObject(i) ?: continue
                if (item.optString("packageName") == packageName) {
                    targetItem = item
                    break
                }
            }

            if (targetItem != null) {
                val isLocked = targetItem.optBoolean("isLocked", false)
                val dailyLimitMs = targetItem.optDouble("dailyLimitMs", 0.0)
                val usedTodayMs = targetItem.optDouble("usedTodayMs", 0.0)
                val initialUsageMs = targetItem.optDouble("initialUsageMs", 0.0)
                val currentElapsed = Math.max(0.0, usedTodayMs)
                val currentlyLocked = isLocked || (dailyLimitMs > 0 && currentElapsed >= dailyLimitMs)

                if (currentlyLocked) {
                    val appExpiration = targetItem.optLong("lockExpirationTimestamp", 0L)
                    val effectiveExpiration = if (appExpiration > 0) appExpiration else (if (expiration > 0) expiration else getNextMidnightTimestamp())
                    if (now < effectiveExpiration) {
                        Log.w(TAG, "Cannot unlock $packageName: lock period active until $effectiveExpiration (now=$now)")
                        return false
                    }
                }
            }

            // Remove packageName from locked_apps_json
            val updated = JSONArray()
            for (i in 0 until jsonArray.length()) {
                val item = jsonArray.optJSONObject(i)
                if (item != null) {
                    if (item.optString("packageName") != packageName) {
                        updated.put(item)
                    }
                } else {
                    if (jsonArray.optString(i) != packageName) {
                        updated.put(jsonArray.get(i))
                    }
                }
            }

            val hasLocks = updated.length() > 0
            prefs.edit()
                .putString(KEY_LOCKED_APPS_JSON, updated.toString())
                .putBoolean(KEY_HAS_ACTIVE_LOCKS, hasLocks)
                .apply()

            val blackoutPrefs = context.getSharedPreferences("BlackoutPrefs", Context.MODE_PRIVATE)
            blackoutPrefs.edit().putString("locked_apps_json", updated.toString()).apply()

            BlackoutAccessibilityService.lockedPackages.remove(packageName)
            Log.i(TAG, "Successfully unlocked package: $packageName")
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Error unlocking package $packageName", e)
            return false
        }
    }
}
