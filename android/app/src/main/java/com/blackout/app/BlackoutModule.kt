package com.blackout.app

import android.Manifest
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
import android.os.PowerManager
import android.os.Process
import android.provider.Settings
import android.util.Base64
import android.util.Log
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import android.os.Vibrator
import android.os.VibrationEffect
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
        val todayMidnight = calendar.timeInMillis
        val queryStart = todayMidnight - (12 * 3600 * 1000L) // 12-hour lookback before midnight to catch sessions running across 00:00
        val endTime = System.currentTimeMillis()

        fun addDuration(pkg: String, start: Long, end: Long) {
            val effectiveStart = Math.max(start, todayMidnight)
            val effectiveEnd = Math.max(end, todayMidnight)
            val duration = effectiveEnd - effectiveStart
            if (duration > 0) {
                usageMap[pkg] = (usageMap[pkg] ?: 0L) + duration
            }
        }

        try {
            val events = usageStatsManager.queryEvents(queryStart, endTime)
            val event = UsageEvents.Event()

            var currentPkg: String? = null
            var currentStart = 0L
            val activeActivities = mutableSetOf<String>()
            var lastClosedPkg: String? = null
            var lastClosedTime = 0L
            val lastOpenTimeMap = mutableMapOf<String, Long>()

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
                                // Intra-app activity transition (e.g. Chat list -> Conversation)
                                addDuration(currentPkg!!, currentStart, time)
                                currentStart = time
                                activeActivities.add(activityClass)
                            } else {
                                // Switched to a new package
                                addDuration(currentPkg!!, currentStart, time)
                                currentPkg = pkg
                                currentStart = time
                                activeActivities.clear()
                                activeActivities.add(activityClass)

                                val isSamePkgReopen = (lastClosedPkg == pkg && (time - lastClosedTime) < 2000L)
                                val isRapidDuplicate = (time - (lastOpenTimeMap[pkg] ?: 0L)) < 2000L
                                if (!isSamePkgReopen && !isRapidDuplicate && time >= todayMidnight) {
                                    openCountMap[pkg] = (openCountMap[pkg] ?: 0) + 1
                                    lastOpenTimeMap[pkg] = time
                                }
                            }
                        } else {
                            currentPkg = pkg
                            currentStart = time
                            activeActivities.clear()
                            activeActivities.add(activityClass)

                            val isSamePkgReopen = (lastClosedPkg == pkg && (time - lastClosedTime) < 2000L)
                            val isRapidDuplicate = (time - (lastOpenTimeMap[pkg] ?: 0L)) < 2000L
                            if (!isSamePkgReopen && !isRapidDuplicate && time >= todayMidnight) {
                                openCountMap[pkg] = (openCountMap[pkg] ?: 0) + 1
                                lastOpenTimeMap[pkg] = time
                            }
                        }
                    }
                    UsageEvents.Event.ACTIVITY_PAUSED -> {
                        if (currentPkg != null && currentPkg == pkg) {
                            addDuration(pkg, currentStart, time)
                            currentStart = time
                            activeActivities.remove(activityClass)
                            if (activeActivities.isEmpty()) {
                                lastClosedPkg = pkg
                                lastClosedTime = time
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
                            lastClosedPkg = currentPkg
                            lastClosedTime = time
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

    private fun resolveAppCategory(packageName: String, appInfo: ApplicationInfo): String {
        val lowerPkg = packageName.lowercase()
        // High confidence package name heuristics
        if (lowerPkg.contains("whatsapp") || lowerPkg.contains("instagram") ||
            lowerPkg.contains("facebook") || lowerPkg.contains("twitter") ||
            lowerPkg.contains("reddit") || lowerPkg.contains("tiktok") ||
            lowerPkg.contains("snapchat") || lowerPkg.contains("telegram") ||
            lowerPkg.contains("discord") || lowerPkg.contains("linkedin") ||
            lowerPkg.contains("threads") || lowerPkg.contains("wechat")) {
            return "Social"
        }
        if (lowerPkg.contains("chrome") || lowerPkg.contains("browser") ||
            lowerPkg.contains("firefox") || lowerPkg.contains("opera") ||
            lowerPkg.contains("edge") || lowerPkg.contains("brave") ||
            lowerPkg.contains("duckduckgo")) {
            return "Browsers"
        }
        if (lowerPkg.contains("youtube") || lowerPkg.contains("netflix") ||
            lowerPkg.contains("spotify") || lowerPkg.contains("music") ||
            lowerPkg.contains("video") || lowerPkg.contains("vlc") ||
            lowerPkg.contains("primevideo") || lowerPkg.contains("disney") ||
            lowerPkg.contains("twitch") || lowerPkg.contains("soundcloud")) {
            return "Media"
        }
        if (lowerPkg.contains("game") || lowerPkg.contains("pubg") ||
            lowerPkg.contains("freefire") || lowerPkg.contains("clash") ||
            lowerPkg.contains("subway") || lowerPkg.contains("candy") ||
            lowerPkg.contains("roblox") || lowerPkg.contains("minecraft") ||
            lowerPkg.contains("asphalt") || lowerPkg.contains("chess")) {
            return "Games"
        }
        // OS ApplicationInfo category mapping (Android 8.0+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            when (appInfo.category) {
                ApplicationInfo.CATEGORY_GAME -> return "Games"
                ApplicationInfo.CATEGORY_AUDIO, ApplicationInfo.CATEGORY_VIDEO, ApplicationInfo.CATEGORY_NEWS -> return "Media"
                ApplicationInfo.CATEGORY_SOCIAL -> return "Social"
                ApplicationInfo.CATEGORY_MAPS, ApplicationInfo.CATEGORY_PRODUCTIVITY -> return "Tools"
            }
        }
        return "General"
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

                if (pm.getLaunchIntentForPackage(packageName) == null) {
                    continue
                }

                val appInfo = resolveInfo.activityInfo?.applicationInfo ?: continue
                addedPackages.add(packageName)
                val appName = resolveInfo.loadLabel(pm).toString()
                val usedTodayMs = usageMap[packageName] ?: 0L

                val iconUri = getAppIconUri(pm, appInfo)

                val appCategory = resolveAppCategory(packageName, appInfo)

                val map = WritableNativeMap().apply {
                    putString("packageName", packageName)
                    putString("appName", appName)
                    putString("category", appCategory)
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
                            if (pm.getLaunchIntentForPackage(pkg) != null) {
                                dayTotalMs += timeMs
                            }
                        } catch (e: Exception) {}
                    }
                    dayTotalMs = Math.min(dayTotalMs, 24L * 3600 * 1000)
                } else {
                    // Past days: INTERVAL_DAILY with strict timestamp overlap check to prevent multi-day bucket leakage
                    val stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, dayStart, dayEnd)
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
                            if (stat.firstTimeStamp > dayEnd || stat.lastTimeStamp < dayStart) continue
                            val validTime = Math.min(stat.totalTimeInForeground, 24L * 3600 * 1000)
                            val existing = packageUsageMap[pkg] ?: 0L
                            if (validTime > existing) {
                                packageUsageMap[pkg] = validTime
                            }
                        }

                        for ((pkg, timeMs) in packageUsageMap) {
                            try {
                                if (pm.getLaunchIntentForPackage(pkg) != null) {
                                    dayTotalMs += timeMs
                                }
                            } catch (e: Exception) {}
                        }
                    }
                    dayTotalMs = Math.min(dayTotalMs, 24L * 3600 * 1000)
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
                // Past days: INTERVAL_DAILY with strict timestamp overlap check
                val stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startTime, endTime)
                val map = mutableMapOf<String, Long>()
                stats?.forEach { stat ->
                    val pkg = stat.packageName ?: return@forEach
                    if (stat.firstTimeStamp > endTime || stat.lastTimeStamp < startTime) return@forEach
                    val validTime = Math.min(stat.totalTimeInForeground, 24L * 3600 * 1000)
                    if (validTime <= 0) return@forEach
                    val existing = map[pkg] ?: 0L
                    if (validTime > existing) {
                        map[pkg] = validTime
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

    @ReactMethod
    fun unlockPackage(packageName: String, promise: Promise) {
        try {
            val success = SecurityHelper.unlockPackage(reactApplicationContext, packageName)
            if (success) {
                promise.resolve(true)
            } else {
                promise.reject("LOCKED", "This application is locked and cannot be unlocked until the lock period completes at midnight.")
            }
        } catch (e: Exception) {
            Log.e(TAG, "unlockPackage error", e)
            promise.reject("UNLOCK_ERROR", e.message)
        }
    }

    @ReactMethod
    fun hasNotificationPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                val granted = ContextCompat.checkSelfPermission(
                    reactApplicationContext,
                    Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED
                promise.resolve(granted)
            } else {
                val areEnabled = NotificationManagerCompat.from(reactApplicationContext).areNotificationsEnabled()
                promise.resolve(areEnabled)
            }
        } catch (e: Exception) {
            Log.e(TAG, "hasNotificationPermission error", e)
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun requestNotificationPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                val activity = reactApplicationContext.currentActivity
                if (activity != null) {
                    activity.requestPermissions(
                        arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                        102
                    )
                    promise.resolve(true)
                } else {
                    val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                        putExtra(Settings.EXTRA_APP_PACKAGE, reactApplicationContext.packageName)
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    reactApplicationContext.startActivity(intent)
                    promise.resolve(true)
                }
            } else {
                val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                    putExtra(Settings.EXTRA_APP_PACKAGE, reactApplicationContext.packageName)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                reactApplicationContext.startActivity(intent)
                promise.resolve(true)
            }
        } catch (e: Exception) {
            Log.e(TAG, "requestNotificationPermission error", e)
            promise.reject("NOTIF_PERM_ERROR", e.message)
        }
    }

    @ReactMethod
    fun isBatteryOptimizationIgnored(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val pm = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
                val isIgnored = pm?.isIgnoringBatteryOptimizations(reactApplicationContext.packageName) ?: false
                promise.resolve(isIgnored)
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            Log.e(TAG, "isBatteryOptimizationIgnored error", e)
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun requestIgnoreBatteryOptimization(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val pm = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
                if (pm != null && !pm.isIgnoringBatteryOptimizations(reactApplicationContext.packageName)) {
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:${reactApplicationContext.packageName}")
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    reactApplicationContext.startActivity(intent)
                }
            }
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "requestIgnoreBatteryOptimization error", e)
            promise.reject("BATTERY_OPT_ERROR", e.message)
        }
    }

    @ReactMethod
    fun syncNotificationSettings(warningsEnabled: Boolean, locksEnabled: Boolean, resetEnabled: Boolean) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("BlackoutPrefs", Context.MODE_PRIVATE)
            prefs.edit()
                .putBoolean("notif_warnings_enabled", warningsEnabled)
                .putBoolean("notif_locks_enabled", locksEnabled)
                .putBoolean("notif_reset_enabled", resetEnabled)
                .apply()
            Log.d(TAG, "Synced notification settings: warnings=$warningsEnabled, locks=$locksEnabled, reset=$resetEnabled")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to sync notification settings", e)
        }
    }

    @ReactMethod
    fun getDiagnostics(promise: Promise) {
        try {
            val isAccessibilityActive = BlackoutAccessibilityService.instance != null
            val pm = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
            val isBatteryIgnored = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                pm?.isIgnoringBatteryOptimizations(reactApplicationContext.packageName) ?: false
            } else true

            val isNotifGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ContextCompat.checkSelfPermission(
                    reactApplicationContext,
                    Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED
            } else {
                NotificationManagerCompat.from(reactApplicationContext).areNotificationsEnabled()
            }

            val dpm = reactApplicationContext.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val adminComponent = ComponentName(reactApplicationContext, BlackoutDeviceAdminReceiver::class.java)
            val isAdminActive = dpm.isAdminActive(adminComponent)

            val map = Arguments.createMap().apply {
                putBoolean("isAccessibilityActive", isAccessibilityActive)
                putBoolean("isBatteryIgnored", isBatteryIgnored)
                putBoolean("isNotificationGranted", isNotifGranted)
                putBoolean("isDeviceAdminActive", isAdminActive)
                putDouble("nextMidnightTimestamp", SecurityHelper.getNextMidnightTimestamp().toDouble())
            }
            promise.resolve(map)
        } catch (e: Exception) {
            Log.e(TAG, "getDiagnostics error", e)
            promise.reject("DIAGNOSTICS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun rearmDiagnostics(promise: Promise) {
        try {
            // Re-arm midnight reset AlarmManager
            SecurityHelper.scheduleMidnightReset(reactApplicationContext)
            // Re-verify notification channels
            BlackoutNotificationManager.initChannels(reactApplicationContext)
            // Return fresh diagnostics
            getDiagnostics(promise)
        } catch (e: Exception) {
            Log.e(TAG, "rearmDiagnostics error", e)
            promise.reject("REARM_ERROR", e.message)
        }
    }

    @ReactMethod
    fun syncDowntimeSettings(
        enabled: Boolean,
        startHour: Int,
        startMinute: Int,
        endHour: Int,
        endMinute: Int,
        activeDays: String
    ) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("BlackoutPrefs", Context.MODE_PRIVATE)
            prefs.edit()
                .putBoolean("downtime_enabled", enabled)
                .putInt("downtime_start_hour", startHour)
                .putInt("downtime_start_min", startMinute)
                .putInt("downtime_end_hour", endHour)
                .putInt("downtime_end_min", endMinute)
                .putString("downtime_active_days", activeDays)
                .apply()
            Log.d(TAG, "Synced downtime settings: enabled=$enabled, $startHour:$startMinute - $endHour:$endMinute, days=$activeDays")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to sync downtime settings", e)
        }
    }

    @ReactMethod
    fun syncHapticSetting(enabled: Boolean) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("BlackoutPrefs", Context.MODE_PRIVATE)
            prefs.edit().putBoolean("haptic_feedback_enabled", enabled).apply()
            Log.d(TAG, "Synced haptic setting: $enabled")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to sync haptic setting", e)
        }
    }

    @ReactMethod
    fun triggerHaptic(type: String) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("BlackoutPrefs", Context.MODE_PRIVATE)
            if (!prefs.getBoolean("haptic_feedback_enabled", true)) {
                return
            }

            val vibrator = reactApplicationContext.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator ?: return
            if (!vibrator.hasVibrator()) return

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                when (type) {
                    "tick" -> {
                        vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK))
                    }
                    "stamp", "heavy" -> {
                        vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK))
                    }
                    "strike" -> {
                        val timings = longArrayOf(0, 35, 45, 60)
                        val amplitudes = intArrayOf(0, 200, 0, 255)
                        vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
                    }
                    else -> {
                        vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK))
                    }
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val duration = when (type) {
                    "tick" -> 15L
                    "stamp", "heavy" -> 45L
                    "strike" -> 110L
                    else -> 18L
                }
                vibrator.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                val duration = when (type) {
                    "tick" -> 15L
                    "stamp", "heavy" -> 45L
                    "strike" -> 110L
                    else -> 18L
                }
                vibrator.vibrate(duration)
            }
        } catch (e: Exception) {
            Log.w(TAG, "triggerHaptic error", e)
        }
    }
}
