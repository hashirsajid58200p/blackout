package com.blackout.app

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import com.facebook.react.bridge.*
import java.util.*

class BlackoutModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "BlackoutModule"
    }

    @ReactMethod
    fun hasUsageStatsPermission(promise: Promise) {
        val appOps = reactApplicationContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), reactApplicationContext.packageName)
        } else {
            appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), reactApplicationContext.packageName)
        }
        promise.resolve(mode == AppOpsManager.MODE_ALLOWED)
    }

    @ReactMethod
    fun openUsageStatsSettings() {
        val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactApplicationContext.startActivity(intent)
    }

    @ReactMethod
    fun hasOverlayPermission(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            promise.resolve(Settings.canDrawOverlays(reactApplicationContext))
        } else {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun openOverlaySettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + reactApplicationContext.packageName)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.startActivity(intent)
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
            promise.resolve(isEnabled)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun openAccessibilitySettings() {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactApplicationContext.startActivity(intent)
    }

    @ReactMethod
    fun setLockedPackages(packagesList: ReadableArray) {
        val set = mutableSetOf<String>()
        for (i in 0 until packagesList.size()) {
            packagesList.getString(i)?.let { set.add(it) }
        }
        BlackoutAccessibilityService.lockedPackages = set
    }

    @ReactMethod
    fun getTodayUsage(packageName: String, promise: Promise) {
        try {
            val usageStatsManager = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val calendar = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            val startTime = calendar.timeInMillis
            val endTime = System.currentTimeMillis()

            val aggregated = usageStatsManager.queryAndAggregateUsageStats(startTime, endTime)
            val aggMs = aggregated[packageName]?.totalTimeInForeground ?: 0L

            var eventMs = 0L
            try {
                val events = usageStatsManager.queryEvents(startTime, endTime)
                val event = UsageEvents.Event()
                var currentPkg: String? = null
                var currentStart = 0L

                while (events.hasNextEvent()) {
                    events.getNextEvent(event)
                    val pkg = event.packageName
                    val time = event.timeStamp
                    val type = event.eventType

                    if (type == 1 /* RESUMED */) {
                        if (currentPkg != null) {
                            val duration = time - currentStart
                            if (duration > 0 && currentPkg == packageName) {
                                eventMs += duration
                            }
                        }
                        currentPkg = pkg
                        currentStart = time
                    } else if (type == 2 /* PAUSED */ || type == 23 /* STOPPED */) {
                        if (currentPkg == pkg) {
                            val duration = time - currentStart
                            if (duration > 0 && currentPkg == packageName) {
                                eventMs += duration
                            }
                            currentPkg = null
                        }
                    } else if (type == 16 || type == 17 || type == 26) {
                        if (currentPkg != null) {
                            val duration = time - currentStart
                            if (duration > 0 && currentPkg == packageName) {
                                eventMs += duration
                            }
                            currentPkg = null
                        }
                    }
                }
                if (currentPkg == packageName) {
                    val duration = endTime - currentStart
                    if (duration > 0) {
                        eventMs += duration
                    }
                }
            } catch (e: Exception) {}

            val totalTimeMs = Math.max(aggMs, eventMs)
            promise.resolve(totalTimeMs.toDouble())
        } catch (e: Exception) {
            promise.resolve(0.0)
        }
    }

    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val usageStatsManager = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val array = WritableNativeArray()
            val addedPackages = mutableSetOf<String>()
            val selfPkg = reactApplicationContext.packageName

            val calendar = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            val startTime = calendar.timeInMillis
            val endTime = System.currentTimeMillis()

            val aggregatedMap = usageStatsManager.queryAndAggregateUsageStats(startTime, endTime)

            val eventMap = mutableMapOf<String, Long>()
            try {
                val events = usageStatsManager.queryEvents(startTime, endTime)
                val event = UsageEvents.Event()
                var currentPkg: String? = null
                var currentStart = 0L

                while (events.hasNextEvent()) {
                    events.getNextEvent(event)
                    val pkg = event.packageName
                    val time = event.timeStamp
                    val type = event.eventType

                    if (type == 1 /* RESUMED */) {
                        if (currentPkg != null) {
                            val duration = time - currentStart
                            if (duration > 0) {
                                eventMap[currentPkg] = (eventMap[currentPkg] ?: 0L) + duration
                            }
                        }
                        currentPkg = pkg
                        currentStart = time
                    } else if (type == 2 /* PAUSED */ || type == 23 /* STOPPED */) {
                        if (currentPkg == pkg) {
                            val duration = time - currentStart
                            if (duration > 0) {
                                eventMap[pkg] = (eventMap[pkg] ?: 0L) + duration
                            }
                            currentPkg = null
                        }
                    } else if (type == 16 || type == 17 || type == 26) {
                        if (currentPkg != null) {
                            val duration = time - currentStart
                            if (duration > 0) {
                                eventMap[currentPkg] = (eventMap[currentPkg] ?: 0L) + duration
                            }
                            currentPkg = null
                        }
                    }
                }
                if (currentPkg != null) {
                    val duration = endTime - currentStart
                    if (duration > 0) {
                        eventMap[currentPkg] = (eventMap[currentPkg] ?: 0L) + duration
                    }
                }
            } catch (e: Exception) {}

            val homeIntent = Intent(Intent.ACTION_MAIN, null).apply { addCategory(Intent.CATEGORY_HOME) }
            val homeApps = pm.queryIntentActivities(homeIntent, PackageManager.MATCH_DEFAULT_ONLY)
            val homePackages = homeApps.map { it.activityInfo.packageName }.toSet()

            val installedPackages = pm.getInstalledPackages(PackageManager.GET_META_DATA)
            for (pkgInfo in installedPackages) {
                val packageName = pkgInfo.packageName
                if (packageName == selfPkg || homePackages.contains(packageName) || packageName.startsWith("com.android.systemui") || packageName == "android") {
                    continue
                }

                try {
                    val appInfo = pm.getApplicationInfo(packageName, 0)
                    val isLaunchable = pm.getLaunchIntentForPackage(packageName) != null
                    if (!isLaunchable) continue

                    addedPackages.add(packageName)
                    val appName = pm.getApplicationLabel(appInfo).toString()

                    val aggTime = aggregatedMap[packageName]?.totalTimeInForeground ?: 0L
                    val evtTime = eventMap[packageName] ?: 0L
                    val usedTodayMs = Math.max(aggTime, evtTime)

                    var iconBase64 = ""
                    try {
                        val iconDrawable = pm.getApplicationIcon(appInfo)
                        val width = Math.min(iconDrawable.intrinsicWidth.takeIf { it > 0 } ?: 96, 96)
                        val height = Math.min(iconDrawable.intrinsicHeight.takeIf { it > 0 } ?: 96, 96)
                        val bitmap = android.graphics.Bitmap.createBitmap(width, height, android.graphics.Bitmap.Config.ARGB_8888)
                        val canvas = android.graphics.Canvas(bitmap)
                        iconDrawable.setBounds(0, 0, canvas.width, canvas.height)
                        iconDrawable.draw(canvas)
                        val outputStream = java.io.ByteArrayOutputStream()
                        bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 80, outputStream)
                        iconBase64 = android.util.Base64.encodeToString(outputStream.toByteArray(), android.util.Base64.NO_WRAP)
                    } catch (e: Exception) {}

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
                } catch (e: PackageManager.NameNotFoundException) {
                    // Exclude uninstalled app
                    continue
                } catch (e: Exception) {
                    continue
                }
            }

            promise.resolve(array)
        } catch (e: Exception) {
            promise.reject("GET_APPS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getWeeklyUsageStats(promise: Promise) {
        try {
            val usageStatsManager = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val dayNames = arrayOf("SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT")
            val array = WritableNativeArray()

            for (i in 0..6) {
                val dayCal = Calendar.getInstance()
                dayCal.add(Calendar.DAY_OF_YEAR, -6 + i)
                val dayName = dayNames[dayCal.get(Calendar.DAY_OF_WEEK) - 1]
                val dayStart = dayCal.apply {
                    set(Calendar.HOUR_OF_DAY, 0)
                    set(Calendar.MINUTE, 0)
                    set(Calendar.SECOND, 0)
                    set(Calendar.MILLISECOND, 0)
                }.timeInMillis
                val dayEnd = dayStart + (24 * 3600 * 1000) - 1

                val aggregated = usageStatsManager.queryAndAggregateUsageStats(dayStart, dayEnd)
                var dayTotalMs = 0L
                if (aggregated != null) {
                    for ((_, stat) in aggregated) {
                        dayTotalMs += stat.totalTimeInForeground
                    }
                }

                val map = WritableNativeMap().apply {
                    putString("day", dayName)
                    putString("dateStr", "${dayCal.get(Calendar.MONTH) + 1}/${dayCal.get(Calendar.DAY_OF_MONTH)}")
                    putDouble("totalUsageMs", dayTotalMs.toDouble())
                }
                array.pushMap(map)
            }
            promise.resolve(array)
        } catch (e: Exception) {
            promise.reject("WEEKLY_STATS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getDayUsageStats(dayOffset: Int, promise: Promise) {
        try {
            val usageStatsManager = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val pm = reactApplicationContext.packageManager

            val calendar = Calendar.getInstance().apply {
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

            val aggregatedMap = usageStatsManager.queryAndAggregateUsageStats(startTime, endTime)
            val eventMap = mutableMapOf<String, Long>()
            val globalOpenCountMap = mutableMapOf<String, Int>()

            try {
                val events = usageStatsManager.queryEvents(startTime, endTime)
                val event = UsageEvents.Event()
                var currentPkg: String? = null
                var currentStart = 0L

                while (events.hasNextEvent()) {
                    events.getNextEvent(event)
                    val pkg = event.packageName
                    val time = event.timeStamp
                    val type = event.eventType

                    if (type == 1 /* RESUMED */) {
                        if (currentPkg != pkg) {
                            globalOpenCountMap[pkg] = (globalOpenCountMap[pkg] ?: 0) + 1
                        }
                        if (currentPkg != null) {
                            val duration = time - currentStart
                            if (duration > 0) {
                                eventMap[currentPkg] = (eventMap[currentPkg] ?: 0L) + duration
                            }
                        }
                        currentPkg = pkg
                        currentStart = time
                    } else if (type == 2 /* PAUSED */ || type == 23 /* STOPPED */) {
                        if (currentPkg == pkg) {
                            val duration = time - currentStart
                            if (duration > 0) {
                                eventMap[pkg] = (eventMap[pkg] ?: 0L) + duration
                            }
                            currentPkg = null
                        }
                    } else if (type == 16 || type == 17 || type == 26) {
                        if (currentPkg != null) {
                            val duration = time - currentStart
                            if (duration > 0) {
                                eventMap[currentPkg] = (eventMap[currentPkg] ?: 0L) + duration
                            }
                            currentPkg = null
                        }
                    }
                }
                if (currentPkg != null) {
                    val duration = endTime - currentStart
                    if (duration > 0) {
                        eventMap[currentPkg] = (eventMap[currentPkg] ?: 0L) + duration
                    }
                }
            } catch (e: Exception) {}

            val packageUsageMap = mutableMapOf<String, Long>()
            if (aggregatedMap != null) {
                for ((pkg, stat) in aggregatedMap) {
                    if (stat.totalTimeInForeground > 0) {
                        packageUsageMap[pkg] = stat.totalTimeInForeground
                    }
                }
            }
            for ((pkg, timeMs) in eventMap) {
                val existing = packageUsageMap[pkg] ?: 0L
                packageUsageMap[pkg] = Math.max(existing, timeMs)
            }

            val array = WritableNativeArray()
            val selfPkg = reactApplicationContext.packageName

            val sortedList = packageUsageMap.entries
                .filter { entry ->
                    val pkg = entry.key
                    if (pkg == "com.android.systemui" || pkg == "android" || pkg == selfPkg || homePackages.contains(pkg) || entry.value <= 0) {
                        return@filter false
                    }
                    try {
                        val appInfo = pm.getApplicationInfo(pkg, 0)
                        val isLaunchable = pm.getLaunchIntentForPackage(pkg) != null
                        isLaunchable
                    } catch (e: PackageManager.NameNotFoundException) {
                        false
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

            promise.resolve(array)
        } catch (e: Exception) {
            promise.reject("DAY_STATS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun uninstallPackage(packageName: String, promise: Promise) {
        try {
            val intent = android.content.Intent(android.content.Intent.ACTION_DELETE).apply {
                data = android.net.Uri.parse("package:$packageName")
                flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("UNINSTALL_ERROR", e.message)
        }
    }
}
