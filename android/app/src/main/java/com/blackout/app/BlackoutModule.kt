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

            var totalTimeMs = 0L

            val events = usageStatsManager.queryEvents(startTime, endTime)
            val event = UsageEvents.Event()
            var eventTotal = 0L
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
                            eventTotal += duration
                        }
                    }
                    currentPkg = pkg
                    currentStart = time
                } else if (type == 2 /* PAUSED */ || type == 23 /* STOPPED */) {
                    if (currentPkg == pkg) {
                        val duration = time - currentStart
                        if (duration > 0 && currentPkg == packageName) {
                            eventTotal += duration
                        }
                        currentPkg = null
                    }
                }
            }

            if (currentPkg == packageName) {
                val duration = endTime - currentStart
                if (duration > 0) {
                    eventTotal += duration
                }
            }

            totalTimeMs = eventTotal
            promise.resolve(totalTimeMs.toDouble())
        } catch (e: Exception) {
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

            // 1. Query launcher intent activities
            val intent = Intent(Intent.ACTION_MAIN, null).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
            }
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PackageManager.MATCH_ALL else 0
            val resolveInfos = pm.queryIntentActivities(intent, flags)

            for (resolveInfo in resolveInfos) {
                val packageName = resolveInfo.activityInfo.packageName
                if (packageName != selfPkg && !addedPackages.contains(packageName)) {
                    if (packageName.startsWith("com.android.systemui") || packageName == "android") {
                        continue
                    }
                    addedPackages.add(packageName)
                    val appName = resolveInfo.loadLabel(pm).toString()
                    var iconBase64 = ""
                    try {
                        val iconDrawable = resolveInfo.loadIcon(pm)
                        val width = Math.min(iconDrawable.intrinsicWidth.takeIf { it > 0 } ?: 96, 96)
                        val height = Math.min(iconDrawable.intrinsicHeight.takeIf { it > 0 } ?: 96, 96)
                        val bitmap = android.graphics.Bitmap.createBitmap(width, height, android.graphics.Bitmap.Config.ARGB_8888)
                        val canvas = android.graphics.Canvas(bitmap)
                        iconDrawable.setBounds(0, 0, canvas.width, canvas.height)
                        iconDrawable.draw(canvas)
                        val outputStream = java.io.ByteArrayOutputStream()
                        bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 80, outputStream)
                        iconBase64 = android.util.Base64.encodeToString(outputStream.toByteArray(), android.util.Base64.NO_WRAP)
                    } catch (e: Exception) {
                        // ignore icon error
                    }

                    val map = WritableNativeMap().apply {
                        putString("packageName", packageName)
                        putString("appName", appName)
                        putString("category", "Installed App")
                        if (iconBase64.isNotEmpty()) {
                            putString("iconBase64", iconBase64)
                        }
                    }
                    array.pushMap(map)
                }
            }

            // 2. Query ALL installed packages to ensure apps like Instagram, MovieBox, WhatsApp are included
            try {
                val installedPackages = pm.getInstalledPackages(PackageManager.GET_META_DATA)
                for (pkgInfo in installedPackages) {
                    val packageName = pkgInfo.packageName
                    if (packageName != selfPkg && !addedPackages.contains(packageName)) {
                        val appInfo = pkgInfo.applicationInfo ?: continue
                        val isUserApp = pm.getLaunchIntentForPackage(packageName) != null

                        if (isUserApp) {
                            if (packageName.startsWith("com.android.systemui") || packageName == "android") {
                                continue
                            }
                            addedPackages.add(packageName)
                            val appName = pm.getApplicationLabel(appInfo).toString()
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
                                if (iconBase64.isNotEmpty()) {
                                    putString("iconBase64", iconBase64)
                                }
                            }
                            array.pushMap(map)
                        }
                    }
                }
            } catch (e: Exception) {
                // ignore
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

                val dailyStats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, dayStart, dayEnd)
                var dayTotalMs = 0L
                if (dailyStats != null) {
                    for (stat in dailyStats) {
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

            // Step 1: Pre-query launchable and user installed packages
            val validPackages = mutableMapOf<String, String>()
            try {
                val launcherIntent = Intent(Intent.ACTION_MAIN, null).apply {
                    addCategory(Intent.CATEGORY_LAUNCHER)
                }
                val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PackageManager.MATCH_ALL else 0
                val launcherApps = pm.queryIntentActivities(launcherIntent, flags)

                for (resolveInfo in launcherApps) {
                    val pkg = resolveInfo.activityInfo.packageName
                    val label = resolveInfo.loadLabel(pm).toString()
                    validPackages[pkg] = label
                }
            } catch (e: Exception) {}

            try {
                val allPkgs = pm.getInstalledPackages(PackageManager.GET_META_DATA)
                for (pkgInfo in allPkgs) {
                    val pkg = pkgInfo.packageName
                    if (!validPackages.containsKey(pkg)) {
                        val appInfo = pkgInfo.applicationInfo ?: continue
                        val isUserApp = pm.getLaunchIntentForPackage(pkg) != null
                        if (isUserApp) {
                            validPackages[pkg] = pm.getApplicationLabel(appInfo).toString()
                        }
                    }
                }
            } catch (e: Exception) {}

            val packageUsageMap = mutableMapOf<String, Long>()

            // queryAndAggregateUsageStats removed due to UTC bounds timezone inaccuracy.
            // We solely rely on precise local UsageEvents.

            // Step 3: Query UsageEvents for exact session precision
            try {
                val events = usageStatsManager.queryEvents(startTime, endTime)
                val eventMap = mutableMapOf<String, Long>()
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
                    }
                }

                if (currentPkg != null) {
                    val duration = endTime - currentStart
                    if (duration > 0) {
                        eventMap[currentPkg] = (eventMap[currentPkg] ?: 0L) + duration
                    }
                }

                for ((pkg, timeMs) in eventMap) {
                    val existing = packageUsageMap[pkg] ?: 0L
                    packageUsageMap[pkg] = Math.max(existing, timeMs)
                }
            } catch (e: Exception) {}

            val array = WritableNativeArray()
            val selfPkg = reactApplicationContext.packageName

            // Sort by duration descending (highest usage apps first, e.g. MovieBox, Instagram)
            val sortedList = packageUsageMap.entries
                .filter { it.value >= 30000 && it.key != "com.android.systemui" && it.key != "android" && it.key != selfPkg }
                .sortedByDescending { it.value }

            for (entry in sortedList) {
                val pkg = entry.key
                val timeMs = entry.value

                var appName = validPackages[pkg]
                if (appName == null) {
                    try {
                        val appInfo = pm.getApplicationInfo(pkg, 0)
                        appName = pm.getApplicationLabel(appInfo).toString()
                    } catch (e: Exception) {
                        appName = pkg.substringAfterLast('.')
                    }
                }

                val map = WritableNativeMap().apply {
                    putString("packageName", pkg)
                    putString("appName", appName)
                    putDouble("usedMs", timeMs.toDouble())
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
