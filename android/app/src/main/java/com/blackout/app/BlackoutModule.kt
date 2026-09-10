package com.blackout.app

import android.app.AppOpsManager
import android.app.admin.DevicePolicyManager
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

    @ReactMethod
    fun getTodayUsage(packageName: String, promise: Promise) {
        try {
            val calendar = Calendar.getInstance(TimeZone.getDefault()).apply {
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            val startTime = calendar.timeInMillis
            val endTime = System.currentTimeMillis()

            val usageStatsManager = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            // INTERVAL_DAILY gives the exact aggregated time for the day
            val stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startTime, endTime)

            // To get time for a specific app:
            val appStat = stats?.find { it.packageName == packageName }
            val totalTimeMs = appStat?.totalTimeInForeground ?: 0L

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

            val calendar = Calendar.getInstance(TimeZone.getDefault()).apply {
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            val startTime = calendar.timeInMillis
            val endTime = System.currentTimeMillis()

            val usageStatsManager = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startTime, endTime)

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
                val appStat = stats?.find { it.packageName == packageName }
                val usedTodayMs = appStat?.totalTimeInForeground ?: 0L

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

                val stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, dayStart, dayEnd)
                var dayTotalMs = 0L
                if (stats != null) {
                    val seenPackages = mutableSetOf<String>()
                    for (stat in stats) {
                        val pkg = stat.packageName ?: continue
                        if (seenPackages.contains(pkg)) continue
                        if (pkg == selfPkg || pkg == "com.blackout.app" || pkg.startsWith("com.blackout") ||
                            pkg == "android" || pkg.contains("systemui") || pkg.contains("launcher") ||
                            pkg.contains("navigationbar") || homePackages.contains(pkg)) {
                            continue
                        }
                        if (stat.totalTimeInForeground <= 0) continue
                        try {
                            val appInfo = pm.getApplicationInfo(pkg, 0)
                            val isSystem = (appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0 &&
                                           (appInfo.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) == 0
                            if (isSystem) continue
                            if (pm.getLaunchIntentForPackage(pkg) != null) {
                                seenPackages.add(pkg)
                                dayTotalMs += stat.totalTimeInForeground
                            }
                        } catch (e: Exception) {}
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

            val stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startTime, endTime)
            val array = WritableNativeArray()
            val selfPkg = reactApplicationContext.packageName

            if (stats != null) {
                val seenPackages = mutableSetOf<String>()
                val filteredStats = stats.filter { stat ->
                    val pkg = stat.packageName ?: return@filter false
                    // 1. Exclude Blackout itself
                    if (pkg == selfPkg || pkg == "com.blackout.app" || pkg.startsWith("com.blackout")) {
                        return@filter false
                    }
                    // 2. Exclude system UI, launcher, navigation bar, and pure android framework
                    if (pkg.contains("systemui") || pkg.contains("launcher") || pkg.contains("navigationbar") ||
                        pkg == "android" || homePackages.contains(pkg)) {
                        return@filter false
                    }
                    if (stat.totalTimeInForeground <= 0) {
                        return@filter false
                    }
                    try {
                        val appInfo = pm.getApplicationInfo(pkg, 0)
                        val isSystem = (appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0 &&
                                       (appInfo.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) == 0
                        if (isSystem) return@filter false
                        if (pm.getLaunchIntentForPackage(pkg) == null) return@filter false
                    } catch (e: Exception) {
                        return@filter false
                    }
                    true
                }.sortedByDescending { it.totalTimeInForeground }

                for (stat in filteredStats) {
                    val pkg = stat.packageName ?: continue
                    if (seenPackages.contains(pkg)) continue
                    seenPackages.add(pkg)

                    val timeMs = stat.totalTimeInForeground
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
                        putInt("openCount", 0)
                        putString("iconUri", iconUri)
                        putString("iconBase64", "")
                    }
                    array.pushMap(map)
                }
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
