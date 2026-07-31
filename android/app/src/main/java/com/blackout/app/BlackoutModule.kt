package com.blackout.app

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
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
    def hasUsageStatsPermission(promise: Promise) {
        val appOps = reactApplicationContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), reactApplicationContext.packageName)
        } else {
            appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), reactApplicationContext.packageName)
        }
        promise.resolve(mode == AppOpsManager.MODE_ALLOWED)
    }

    @ReactMethod
    def openUsageStatsSettings() {
        val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactApplicationContext.startActivity(intent)
    }

    @ReactMethod
    def hasOverlayPermission(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            promise.resolve(Settings.canDrawOverlays(reactApplicationContext))
        } else {
            promise.resolve(true)
        }
    }

    @ReactMethod
    def openOverlaySettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + reactApplicationContext.packageName)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.startActivity(intent)
        }
    }

    @ReactMethod
    def hasAccessibilityPermission(promise: Promise) {
        val isServiceRunning = BlackoutAccessibilityService.instance != null
        promise.resolve(isServiceRunning)
    }

    @ReactMethod
    def openAccessibilitySettings() {
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
        val usageStatsManager = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val calendar = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val startTime = calendar.timeInMillis
        val endTime = System.currentTimeMillis()

        val stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startTime, endTime)
        var totalTimeMs = 0L
        if (stats != null) {
            for (usageStat in stats) {
                if (usageStat.packageName == packageName) {
                    totalTimeMs += usageStat.totalTimeInForeground
                }
            }
        }
        promise.resolve(totalTimeMs.toDouble())
    }

    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val intent = Intent(Intent.ACTION_MAIN, null).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
            }
            val resolveInfos = pm.queryIntentActivities(intent, 0)
            val array = WritableNativeArray()
            val addedPackages = mutableSetOf<String>()

            for (resolveInfo in resolveInfos) {
                val packageName = resolveInfo.activityInfo.packageName
                if (packageName != reactApplicationContext.packageName && !addedPackages.contains(packageName)) {
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
            val calendar = Calendar.getInstance()
            calendar.add(Calendar.DAY_OF_YEAR, dayOffset)
            calendar.set(Calendar.HOUR_OF_DAY, 0)
            calendar.set(Calendar.MINUTE, 0)
            calendar.set(Calendar.SECOND, 0)
            calendar.set(Calendar.MILLISECOND, 0)
            val startTime = calendar.timeInMillis
            val endTime = startTime + (24 * 3600 * 1000) - 1

            val stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startTime, endTime)
            val array = WritableNativeArray()
            val packageUsageMap = mutableMapOf<String, Long>()

            if (stats != null) {
                for (stat in stats) {
                    if (stat.totalTimeInForeground > 0) {
                        val current = packageUsageMap.getOrDefault(stat.packageName, 0L)
                        packageUsageMap[stat.packageName] = Math.max(current, stat.totalTimeInForeground)
                    }
                }
            }

            for ((pkg, timeMs) in packageUsageMap.entries) {
                try {
                    val appInfo = pm.getApplicationInfo(pkg, 0)
                    val appName = pm.getApplicationLabel(appInfo).toString()
                    val map = WritableNativeMap().apply {
                        putString("packageName", pkg)
                        putString("appName", appName)
                        putDouble("usedMs", timeMs.toDouble())
                    }
                    array.pushMap(map)
                } catch (e: Exception) {
                    // skip
                }
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
