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
        try {
            val prefs = reactApplicationContext.getSharedPreferences("BlackoutPrefs", Context.MODE_PRIVATE)
            prefs.edit().putString("locked_apps_json", lockedAppsJson).apply()
        } catch (e: Exception) {
            Log.e(TAG, "Error saving locked_apps_json to BlackoutPrefs", e)
        }
    }

    private fun getAppIconUri(pm: PackageManager, appInfo: ApplicationInfo): String {
        return try {
            val packageName = appInfo.packageName
            val cacheDir = reactApplicationContext.cacheDir
            val iconFile = java.io.File(cacheDir, "icon_${packageName.replace(".", "_")}.png")
            if (!iconFile.exists()) {
                val iconDrawable = pm.getApplicationIcon(appInfo)
                val bitmap = Bitmap.createBitmap(96, 96, Bitmap.Config.ARGB_8888)
                val canvas = Canvas(bitmap)
                iconDrawable.setBounds(0, 0, 96, 96)
                iconDrawable.draw(canvas)
                val outputStream = java.io.FileOutputStream(iconFile)
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream)
                outputStream.flush()
                outputStream.close()
            }
            "file://" + iconFile.absolutePath
        } catch (e: Exception) {
            Log.e(TAG, "Icon error for ${appInfo.packageName}", e)
            ""
        }
    }

    private fun getAppIconUriByPackage(pm: PackageManager, packageName: String): String {
        return try {
            val appInfo = pm.getApplicationInfo(packageName, 0)
            getAppIconUri(pm, appInfo)
        } catch (e: Exception) {
            ""
        }
    }

    /**
     * Extracts precise foreground session durations since local midnight from UsageEvents.
     * Accurately pauses during screen-off / lock and caps ongoing sessions at endTime.
     */
    private fun getTodayUsageEventsMap(context: Context): Pair<Map<String, Long>, Map<String, Int>> {
        val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val usageMap = mutableMapOf<String, Long>()
        val openCountMap = mutableMapOf<String, Int>()

        val calendar = Calendar.getInstance(TimeZone.getDefault()).apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val startTime = calendar.timeInMillis
        val endTime = System.currentTimeMillis()

        try {
            val events = usageStatsManager.queryEvents(startTime, endTime)
            val event = UsageEvents.Event()

            var currentPkg: String? = null
            var currentStart = 0L

            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                val pkg = event.packageName ?: continue
                val time = event.timeStamp
                val type = event.eventType

                when (type) {
                    UsageEvents.Event.ACTIVITY_RESUMED -> {
                        if (currentPkg != null && currentPkg != pkg) {
                            val duration = time - currentStart
                            if (duration > 0) {
                                usageMap[currentPkg!!] = (usageMap[currentPkg!!] ?: 0L) + duration
                            }
                        }
                        if (currentPkg != pkg) {
                            openCountMap[pkg] = (openCountMap[pkg] ?: 0) + 1
                        }
                        currentPkg = pkg
                        currentStart = time
                    }
                    UsageEvents.Event.ACTIVITY_PAUSED -> {
                        if (currentPkg != null && currentPkg == pkg) {
                            val duration = time - currentStart
                            if (duration > 0) {
                                usageMap[pkg] = (usageMap[pkg] ?: 0L) + duration
                            }
                            currentPkg = null
                            currentStart = 0L
                        }
                    }
                    16 /* SCREEN_NON_INTERACTIVE */,
                    17 /* KEYGUARD_SHOWN */,
                    26 /* DEVICE_SHUTDOWN */ -> {
                        if (currentPkg != null) {
                            val duration = time - currentStart
                            if (duration > 0) {
                                usageMap[currentPkg!!] = (usageMap[currentPkg!!] ?: 0L) + duration
                            }
                            currentPkg = null
                            currentStart = 0L
                        }
                    }
                }
            }

            if (currentPkg != null && currentStart > 0L) {
                val duration = endTime - currentStart
                if (duration > 0) {
                    usageMap[currentPkg!!] = (usageMap[currentPkg!!] ?: 0L) + duration
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error querying UsageEvents in getTodayUsageEventsMap", e)
        }

        return Pair(usageMap, openCountMap)
    }

    @ReactMethod
    fun getTodayUsage(packageName: String, promise: Promise) {
        try {
            val totalTimeMs = SecurityHelper.getTodayPackageUsage(reactApplicationContext, packageName)
            Log.d(TAG, "getTodayUsage for $packageName: $totalTimeMs ms")
            promise.resolve(totalTimeMs.toDouble())
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

            val (usageMap, _) = getTodayUsageEventsMap(reactApplicationContext)

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
                if (addedPackages.contains(packageName) || 
                    packageName == selfPkg || 
                    packageName == "com.blackout.app" || 
                    packageName.startsWith("com.blackout") || 
                    homePackages.contains(packageName)) {
                    continue
                }

                if (packageName.contains("systemui") || 
                    packageName.contains("launcher") || 
                    packageName.contains("navigationbar") || 
                    packageName == "android") {
                    continue
                }

                // Filter out pure system apps without launcher updates
                val appInfo = try {
                    pm.getApplicationInfo(packageName, 0)
                } catch (e: Exception) {
                    continue
                }
                val isSystem = (appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0 &&
                               (appInfo.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) == 0
                if (isSystem) continue

                if (pm.getLaunchIntentForPackage(packageName) == null) {
                    continue
                }

                addedPackages.add(packageName)
                val appName = resolveInfo.loadLabel(pm).toString()
                val usedTodayMs = usageMap[packageName] ?: 0L

                val iconUri = getAppIconUri(pm, appInfo)

                val map = WritableNativeMap().apply {
                    putString("packageName", packageName)
                    putString("appName", appName)
                    putString("category", "Installed App")
                    putDouble("usedTodayMs", usedTodayMs.toDouble())
                    putString("iconUri", iconUri)
                    putString("iconBase64", "")
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
            val usageStatsManager = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val pm = reactApplicationContext.packageManager
            val dayNames = arrayOf("SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT")
            val array = WritableNativeArray()
            val selfPkg = reactApplicationContext.packageName

            val homeIntent = Intent(Intent.ACTION_MAIN, null).apply { addCategory(Intent.CATEGORY_HOME) }
            val homeApps = pm.queryIntentActivities(homeIntent, PackageManager.MATCH_DEFAULT_ONLY)
            val homePackages = homeApps.map { it.activityInfo.packageName }.toSet()

            for (i in 0..6) {
                val dayCal = Calendar.getInstance(TimeZone.getDefault()).apply {
                    add(Calendar.DAY_OF_YEAR, -6 + i)
                    set(Calendar.HOUR_OF_DAY, 0)
                    set(Calendar.MINUTE, 0)
                    set(Calendar.SECOND, 0)
                    set(Calendar.MILLISECOND, 0)
                }
                val dayName = dayNames[dayCal.get(Calendar.DAY_OF_WEEK) - 1]
                val dayStart = dayCal.timeInMillis
                val dayEnd = if (i == 6) System.currentTimeMillis() else (dayStart + (24 * 3600 * 1000) - 1)

                var dayTotalMs = 0L

                if (i == 6) {
                    // Today: use event-accurate foreground durations
                    val (todayMap, _) = getTodayUsageEventsMap(reactApplicationContext)
                    for ((pkg, timeMs) in todayMap) {
                        if (pkg == selfPkg || pkg == "com.blackout.app" || pkg.startsWith("com.blackout") ||
                            pkg == "android" || pkg.contains("systemui") || pkg.contains("launcher") ||
                            pkg.contains("navigationbar") || homePackages.contains(pkg)) {
                            continue
                        }
                        if (timeMs <= 0) continue
                        try {
                            val appInfo = pm.getApplicationInfo(pkg, 0)
                            val isSystem = (appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0 &&
                                           (appInfo.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) == 0
                            if (isSystem) continue
                            if (pm.getLaunchIntentForPackage(pkg) != null) {
                                dayTotalMs += timeMs
                            }
                        } catch (e: Exception) {}
                    }
                } else {
                    // Past days: INTERVAL_BEST with maxOf per package to prevent bucket duplication
                    val stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_BEST, dayStart, dayEnd)
                    if (stats != null) {
                        val packageUsageMap = mutableMapOf<String, Long>()
                        for (stat in stats) {
                            val pkg = stat.packageName ?: continue
                            if (pkg == selfPkg || pkg == "com.blackout.app" || pkg.startsWith("com.blackout") ||
                                pkg == "android" || pkg.contains("systemui") || pkg.contains("launcher") ||
                                pkg.contains("navigationbar") || homePackages.contains(pkg)) {
                                continue
                            }
                            if (stat.totalTimeInForeground <= 0) continue
                            val existing = packageUsageMap[pkg] ?: 0L
                            if (stat.totalTimeInForeground > existing) {
                                packageUsageMap[pkg] = stat.totalTimeInForeground
                            }
                        }

                        for ((pkg, timeMs) in packageUsageMap) {
                            try {
                                val appInfo = pm.getApplicationInfo(pkg, 0)
                                val isSystem = (appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0 &&
                                               (appInfo.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) == 0
                                if (isSystem) continue
                                if (pm.getLaunchIntentForPackage(pkg) != null) {
                                    dayTotalMs += timeMs
                                }
                            } catch (e: Exception) {}
                        }
                    }
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

            val array = WritableNativeArray()
            val selfPkg = reactApplicationContext.packageName

            val (packageUsageMap, openCountMap) = if (dayOffset == 0) {
                // Today: event-accurate foreground usage and launch counts
                getTodayUsageEventsMap(reactApplicationContext)
            } else {
                // Past days: INTERVAL_BEST with maxOf per package
                val stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_BEST, startTime, endTime)
                val map = mutableMapOf<String, Long>()
                stats?.forEach { stat ->
                    val pkg = stat.packageName ?: return@forEach
                    val existing = map[pkg] ?: 0L
                    if (stat.totalTimeInForeground > existing) {
                        map[pkg] = stat.totalTimeInForeground
                    }
                }
                Pair(map, emptyMap<String, Int>())
            }

            val filteredList = mutableListOf<Triple<String, Long, Int>>()
            for ((pkg, timeMs) in packageUsageMap) {
                if (pkg == selfPkg || pkg == "com.blackout.app" || pkg.startsWith("com.blackout")) {
                    continue
                }
                if (pkg.contains("systemui") || pkg.contains("launcher") || pkg.contains("navigationbar") ||
                    pkg == "android" || homePackages.contains(pkg)) {
                    continue
                }
                if (timeMs <= 0) continue
                try {
                    val appInfo = pm.getApplicationInfo(pkg, 0)
                    val isSystem = (appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0 &&
                                   (appInfo.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) == 0
                    if (isSystem) continue
                    if (pm.getLaunchIntentForPackage(pkg) == null) continue
                    filteredList.add(Triple(pkg, timeMs, openCountMap[pkg] ?: 0))
                } catch (e: Exception) {}
            }
            filteredList.sortByDescending { it.second }

            for ((pkg, timeMs, openCount) in filteredList) {
                var appName = pkg
                try {
                    val appInfo = pm.getApplicationInfo(pkg, 0)
                    appName = pm.getApplicationLabel(appInfo).toString()
                } catch (e: Exception) {}

                val iconUri = getAppIconUriByPackage(pm, pkg)

                val map = WritableNativeMap().apply {
                    putString("packageName", pkg)
                    putString("appName", appName)
                    putDouble("usedMs", timeMs.toDouble())
                    putInt("openCount", openCount)
                    putString("iconUri", iconUri)
                    putString("iconBase64", "")
                }
                array.pushMap(map)
            }

            Log.d(TAG, "getDayUsageStats for dayOffset $dayOffset returned ${array.size()} apps")
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
