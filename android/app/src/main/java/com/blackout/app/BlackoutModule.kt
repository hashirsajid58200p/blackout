package com.blackout.app

import android.app.AppOpsManager
import android.app.admin.DevicePolicyManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.*
import java.io.ByteArrayOutputStream
import java.util.*

class BlackoutModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "BlackoutModule"
    }

    override fun getName(): String {
        return "BlackoutModule"
    }

    @ReactMethod
    fun isDeviceAdminActive(promise: Promise) {
        try {
            val dpm = reactApplicationContext.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val adminComponent = ComponentName(reactApplicationContext, BlackoutDeviceAdminReceiver::class.java)
            val isActive = dpm.isAdminActive(adminComponent)
            Log.d(TAG, "isDeviceAdminActive: $isActive")
            promise.resolve(isActive)
        } catch (e: Exception) {
            Log.e(TAG, "isDeviceAdminActive error", e)
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun requestDeviceAdmin(promise: Promise) {
        try {
            val dpm = reactApplicationContext.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val adminComponent = ComponentName(reactApplicationContext, BlackoutDeviceAdminReceiver::class.java)
            if (!dpm.isAdminActive(adminComponent)) {
                val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
                    putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent)
                    putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "Blackout requires Device Administrator privileges to prevent unauthorized uninstallation while app limits are active.")
                }
                val activity = reactApplicationContext.currentActivity
                if (activity != null) {
                    activity.startActivity(intent)
                } else {
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    reactApplicationContext.startActivity(intent)
                }
            }
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "requestDeviceAdmin error", e)
            promise.reject("DEVICE_ADMIN_ERROR", e.message)
        }
    }

    @ReactMethod
    fun hasUsageStatsPermission(promise: Promise) {
        try {
            val appOps = reactApplicationContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), reactApplicationContext.packageName)
            } else {
                appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), reactApplicationContext.packageName)
            }
            val granted = mode == AppOpsManager.MODE_ALLOWED
            Log.d(TAG, "hasUsageStatsPermission: $granted")
            promise.resolve(granted)
        } catch (e: Exception) {
            Log.e(TAG, "hasUsageStatsPermission error", e)
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun openUsageStatsSettings() {
        try {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "openUsageStatsSettings error", e)
        }
    }

    @ReactMethod
    fun hasOverlayPermission(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val canDraw = Settings.canDrawOverlays(reactApplicationContext)
            Log.d(TAG, "hasOverlayPermission: $canDraw")
            promise.resolve(canDraw)
        } else {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun openOverlaySettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + reactApplicationContext.packageName)).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactApplicationContext.startActivity(intent)
            } catch (e: Exception) {
                Log.e(TAG, "openOverlaySettings error", e)
            }
        }
    }

    @ReactMethod
    fun hasAccessibilityPermission(promise: Promise) {
        try {
            if (BlackoutAccessibilityService.instance != null) {
                promise.resolve(true)
                return
            }
            val contentResolver = reactApplicationContext.contentResolver
            val enabledServices = Settings.Secure.getString(contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
            val isEnabled = enabledServices != null && (
                enabledServices.contains("BlackoutAccessibilityService") ||
                enabledServices.contains(reactApplicationContext.packageName)
            )
            Log.d(TAG, "hasAccessibilityPermission: $isEnabled")
            promise.resolve(isEnabled)
        } catch (e: Exception) {
            Log.e(TAG, "hasAccessibilityPermission error", e)
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun openAccessibilitySettings() {
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "openAccessibilitySettings error", e)
        }
    }

    @ReactMethod
    fun setLockedPackages(packagesList: ReadableArray) {
        val set = mutableSetOf<String>()
        for (i in 0 until packagesList.size()) {
            packagesList.getString(i)?.let { set.add(it) }
        }
        BlackoutAccessibilityService.lockedPackages = set
        Log.d(TAG, "setLockedPackages in-memory: $set")
    }

    @ReactMethod
    fun syncLockedAppsToNative(lockedAppsJson: String) {
        Log.d(TAG, "syncLockedAppsToNative called: $lockedAppsJson")
        SecurityHelper.saveLockedApps(reactApplicationContext, lockedAppsJson)
    }

    /**
     * Robust UsageStats aggregation using Android's official UsageStatsManager API.
     * Combines queryAndAggregateUsageStats and queryUsageStats (INTERVAL_DAILY)
     * to ensure foreground time (getTotalTimeInForeground()) is completely and accurately captured.
     */
    private fun getForegroundUsageStatsMap(startTime: Long, endTime: Long): Map<String, Long> {
        val usageStatsManager = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val totalTimeMap = mutableMapOf<String, Long>()

        try {
            // 1. Primary: queryAndAggregateUsageStats combines all usage records in the interval
            val aggregatedStats: Map<String, UsageStats>? = usageStatsManager.queryAndAggregateUsageStats(startTime, endTime)
            if (aggregatedStats != null) {
                for ((pkg, stat) in aggregatedStats) {
                    val fgTime = stat.totalTimeInForeground
                    if (fgTime > 0) {
                        totalTimeMap[pkg] = fgTime
                    }
                }
            }

            // 2. Secondary: queryUsageStats INTERVAL_DAILY ensures freshly closed apps are reflected
            val dailyStats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startTime, endTime)
            if (dailyStats != null) {
                for (stat in dailyStats) {
                    val fgTime = stat.totalTimeInForeground
                    if (fgTime > 0) {
                        val existing = totalTimeMap[stat.packageName] ?: 0L
                        if (fgTime > existing) {
                            totalTimeMap[stat.packageName] = fgTime
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error querying UsageStatsManager", e)
        }

        return totalTimeMap
    }

    @ReactMethod
    fun getTodayUsage(packageName: String, promise: Promise) {
        try {
            // 1. Read real-time accumulated usage from SharedPreferences (populated by Accessibility Service)
            val prefs = reactApplicationContext.getSharedPreferences(BlackoutAccessibilityService.USAGE_PREFS_NAME, Context.MODE_PRIVATE)
            val accumulatedUsage = prefs.getLong("usage_$packageName", 0L)

            // If the package is currently in foreground, add live active session time
            var liveSessionTime = 0L
            if (BlackoutAccessibilityService.currentForegroundPackage == packageName && BlackoutAccessibilityService.lastResumeTime > 0) {
                val delta = System.currentTimeMillis() - BlackoutAccessibilityService.lastResumeTime
                if (delta in 1..86400000) {
                    liveSessionTime = delta
                }
            }
            val realTimeTotal = accumulatedUsage + liveSessionTime

            // 2. Query UsageStatsManager as fallback / historical baseline for today
            val calendar = Calendar.getInstance(TimeZone.getDefault()).apply {
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            val startTime = calendar.timeInMillis
            val endTime = System.currentTimeMillis()

            val usageMap = getForegroundUsageStatsMap(startTime, endTime)
            val historicalTimeMs = usageMap[packageName] ?: 0L

            val finalUsageMs = Math.max(realTimeTotal, historicalTimeMs)
            Log.d(TAG, "getTodayUsage for $packageName: realTime=$realTimeTotal ms, historical=$historicalTimeMs ms -> resolved=$finalUsageMs ms")
            promise.resolve(finalUsageMs.toDouble())
        } catch (e: Exception) {
            Log.e(TAG, "getTodayUsage error for $packageName", e)
            promise.resolve(0.0)
        }
    }

    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val array = WritableNativeArray()
            val addedPackages = mutableSetOf<String>()
            val selfPkg = reactApplicationContext.packageName

            val calendar = Calendar.getInstance(TimeZone.getDefault()).apply {
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            val startTime = calendar.timeInMillis
            val endTime = System.currentTimeMillis()

            val usageMap = getForegroundUsageStatsMap(startTime, endTime)

            // Detect home launcher apps
            val homeIntent = Intent(Intent.ACTION_MAIN, null).apply { addCategory(Intent.CATEGORY_HOME) }
            val homeApps = pm.queryIntentActivities(homeIntent, PackageManager.MATCH_DEFAULT_ONLY)
            val homePackages = homeApps.map { it.activityInfo.packageName }.toSet()

            // Fetch launchable apps using Package Visibility Intent
            val launchIntent = Intent(Intent.ACTION_MAIN, null).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
            }
            val resolveInfos = pm.queryIntentActivities(launchIntent, 0)

            for (resolveInfo in resolveInfos) {
                val packageName = resolveInfo.activityInfo?.packageName ?: continue
                if (addedPackages.contains(packageName) || packageName == selfPkg || homePackages.contains(packageName)) {
                    continue
                }

                if (packageName.startsWith("com.android.systemui") || packageName == "android") {
                    continue
                }

                // Filter out system apps
                val appInfo = try {
                    pm.getApplicationInfo(packageName, 0)
                } catch (e: Exception) {
                    continue
                }
                val isSystem = (appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0
                if (isSystem) continue

                if (pm.getLaunchIntentForPackage(packageName) == null) {
                    continue
                }

                addedPackages.add(packageName)
                val appName = resolveInfo.loadLabel(pm).toString()
                val usedTodayMs = usageMap[packageName] ?: 0L

                // Extract high-quality Base64 app icon
                var iconBase64 = ""
                try {
                    val iconDrawable = resolveInfo.loadIcon(pm)
                    val width = Math.min(iconDrawable.intrinsicWidth.takeIf { it > 0 } ?: 96, 96)
                    val height = Math.min(iconDrawable.intrinsicHeight.takeIf { it > 0 } ?: 96, 96)
                    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                    val canvas = Canvas(bitmap)
                    iconDrawable.setBounds(0, 0, canvas.width, canvas.height)
                    iconDrawable.draw(canvas)
                    val outputStream = ByteArrayOutputStream()
                    bitmap.compress(Bitmap.CompressFormat.PNG, 85, outputStream)
                    iconBase64 = Base64.encodeToString(outputStream.toByteArray(), Base64.NO_WRAP)
                } catch (e: Exception) {
                    Log.w(TAG, "Could not encode icon for $packageName", e)
                }

                val map = WritableNativeMap().apply {
                    putString("packageName", packageName)
                    putString("appName", appName)
                    putString("category", "Installed App")
                    putDouble("usedTodayMs", usedTodayMs.toDouble())
                    if (iconBase64.isNotEmpty()) {
                        putString("iconBase64", iconBase64)
                    }
                }
                array.pushMap(map)
            }

            Log.d(TAG, "getInstalledApps successfully returned ${array.size()} apps")
            promise.resolve(array)
        } catch (e: Exception) {
            Log.e(TAG, "getInstalledApps error", e)
            promise.reject("GET_APPS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getWeeklyUsageStats(promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val dayNames = arrayOf("SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT")
            val array = WritableNativeArray()
            val selfPkg = reactApplicationContext.packageName

            val homeIntent = Intent(Intent.ACTION_MAIN, null).apply { addCategory(Intent.CATEGORY_HOME) }
            val homeApps = pm.queryIntentActivities(homeIntent, PackageManager.MATCH_DEFAULT_ONLY)
            val homePackages = homeApps.map { it.activityInfo.packageName }.toSet()

            for (i in 0..6) {
                val dayCal = Calendar.getInstance(TimeZone.getDefault())
                dayCal.add(Calendar.DAY_OF_YEAR, -6 + i)
                val dayName = dayNames[dayCal.get(Calendar.DAY_OF_WEEK) - 1]
                val dayStart = dayCal.apply {
                    set(Calendar.HOUR_OF_DAY, 0)
                    set(Calendar.MINUTE, 0)
                    set(Calendar.SECOND, 0)
                    set(Calendar.MILLISECOND, 0)
                }.timeInMillis
                val dayEnd = if (i == 6) System.currentTimeMillis() else (dayStart + (24 * 3600 * 1000) - 1)

                val usageMap = getForegroundUsageStatsMap(dayStart, dayEnd)
                var dayTotalMs = 0L
                for ((pkg, timeMs) in usageMap) {
                    if (pkg == selfPkg || pkg == "android" || pkg.startsWith("com.android.systemui") || homePackages.contains(pkg)) {
                        continue
                    }
                    if (timeMs <= 0) continue
                    try {
                        if (pm.getLaunchIntentForPackage(pkg) != null) {
                            dayTotalMs += timeMs
                        }
                    } catch (e: Exception) {}
                }

                val month = dayCal.get(Calendar.MONTH) + 1
                val day = dayCal.get(Calendar.DAY_OF_MONTH)
                val map = WritableNativeMap().apply {
                    putString("day", dayName)
                    putString("dateStr", "$month/$day")
                    putDouble("totalUsageMs", dayTotalMs.toDouble())
                }
                array.pushMap(map)
            }

            Log.d(TAG, "getWeeklyUsageStats returned 7-day stats")
            promise.resolve(array)
        } catch (e: Exception) {
            Log.e(TAG, "getWeeklyUsageStats error", e)
            promise.reject("WEEKLY_STATS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getDayUsageStats(dayOffset: Int, promise: Promise) {
        try {
            val usageStatsManager = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val pm = reactApplicationContext.packageManager

            val calendar = Calendar.getInstance(TimeZone.getDefault()).apply {
                add(Calendar.DAY_OF_YEAR, dayOffset)
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            val startTime = calendar.timeInMillis
            val endTime = if (dayOffset == 0) System.currentTimeMillis() else (startTime + (24 * 3600 * 1000) - 1)

            val homeIntent = Intent(Intent.ACTION_MAIN, null).apply { addCategory(Intent.CATEGORY_HOME) }
            val homeApps = pm.queryIntentActivities(homeIntent, PackageManager.MATCH_DEFAULT_ONLY)
            val homePackages = homeApps.map { it.activityInfo.packageName }.toSet()

            // 1. Get precise foreground time from UsageStatsManager
            val foregroundUsageMap = getForegroundUsageStatsMap(startTime, endTime)

            // 2. Count launch/resume events for open counts
            val globalOpenCountMap = mutableMapOf<String, Int>()
            try {
                val events = usageStatsManager.queryEvents(startTime, endTime)
                val event = UsageEvents.Event()
                var currentPkg: String? = null

                while (events.hasNextEvent()) {
                    events.getNextEvent(event)
                    val pkg = event.packageName ?: continue
                    if (event.eventType == UsageEvents.Event.ACTIVITY_RESUMED) {
                        if (currentPkg != pkg) {
                            globalOpenCountMap[pkg] = (globalOpenCountMap[pkg] ?: 0) + 1
                        }
                        currentPkg = pkg
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Could not count open events", e)
            }

            val array = WritableNativeArray()
            val selfPkg = reactApplicationContext.packageName

            val sortedList = foregroundUsageMap.entries
                .filter { entry ->
                    val pkg = entry.key
                    if (pkg == "com.android.systemui" || pkg == "android" || pkg == selfPkg || homePackages.contains(pkg) || entry.value <= 0) {
                        return@filter false
                    }
                    try {
                        pm.getLaunchIntentForPackage(pkg) != null
                    } catch (e: Exception) {
                        false
                    }
                }
                .sortedByDescending { it.value }

            for (entry in sortedList) {
                val pkg = entry.key
                val timeMs = entry.value

                var appName: String
                try {
                    val appInfo = pm.getApplicationInfo(pkg, 0)
                    appName = pm.getApplicationLabel(appInfo).toString()
                } catch (e: Exception) {
                    continue
                }

                val map = WritableNativeMap().apply {
                    putString("packageName", pkg)
                    putString("appName", appName)
                    putDouble("usedMs", timeMs.toDouble())
                    putInt("openCount", globalOpenCountMap[pkg] ?: 0)
                }
                array.pushMap(map)
            }

            Log.d(TAG, "getDayUsageStats for dayOffset $dayOffset returned ${sortedList.size} apps")
            promise.resolve(array)
        } catch (e: Exception) {
            Log.e(TAG, "getDayUsageStats error", e)
            promise.reject("DAY_STATS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun uninstallPackage(packageName: String, promise: Promise) {
        try {
            val intent = Intent(Intent.ACTION_DELETE).apply {
                data = Uri.parse("package:$packageName")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("UNINSTALL_ERROR", e.message)
        }
    }
}
