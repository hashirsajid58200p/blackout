const { withAndroidManifest, withDangerousMod, withMainApplication } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const withBlackoutNativeModule = (config) => {
  // 1. Android Manifest changes
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!manifest["uses-permission"]) {
      manifest["uses-permission"] = [];
    }

    const permissionsToAdd = [
      "android.permission.PACKAGE_USAGE_STATS",
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.BIND_ACCESSIBILITY_SERVICE",
      "android.permission.QUERY_ALL_PACKAGES",
    ];

    for (const perm of permissionsToAdd) {
      if (!manifest["uses-permission"].some((p) => p["$"]["android:name"] === perm)) {
        manifest["uses-permission"].push({
          $: { "android:name": perm },
        });
      }
    }

    if (!manifest["queries"]) {
      manifest["queries"] = [];
    }
    if (!manifest["queries"].some((q) => q.intent)) {
      manifest["queries"].push({
        intent: [
          {
            action: [{ $: { "android:name": "android.intent.action.MAIN" } }],
            category: [{ $: { "android:name": "android.intent.category.LAUNCHER" } }],
          },
        ],
      });
    }

    const mainApplication = config.modResults.manifest.application[0];

    // Ensure accessibility service is declared
    if (!mainApplication["service"]) {
      mainApplication["service"] = [];
    }

    const serviceName = "com.blackout.app.BlackoutAccessibilityService";
    const existingService = mainApplication["service"].find(
      (s) => s["$"]["android:name"] === serviceName
    );

    if (!existingService) {
      mainApplication["service"].push({
        $: {
          "android:name": serviceName,
          "android:permission": "android.permission.BIND_ACCESSIBILITY_SERVICE",
          "android:exported": "true",
          "android:label": "Blackout Accessibility Service",
        },
        "intent-filter": [
          {
            action: [
              {
                $: {
                  "android:name": "android.accessibilityservice.AccessibilityService",
                },
              },
            ],
          },
        ],
        "meta-data": [
          {
            $: {
              "android:name": "android.accessibilityservice",
              "android:resource": "@xml/accessibility_service_config",
            },
          },
        ],
      });
    }

    return config;
  });

  // 2. Add native Kotlin source files and xml configs
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidSrcDir = path.join(
        projectRoot,
        "android",
        "app",
        "src",
        "main",
        "java",
        "com",
        "blackout",
        "app"
      );
      const resXmlDir = path.join(
        projectRoot,
        "android",
        "app",
        "src",
        "main",
        "res",
        "xml"
      );
      const resValuesDir = path.join(
        projectRoot,
        "android",
        "app",
        "src",
        "main",
        "res",
        "values"
      );

      fs.mkdirSync(androidSrcDir, { recursive: true });
      fs.mkdirSync(resXmlDir, { recursive: true });
      fs.mkdirSync(resValuesDir, { recursive: true });

      // Ensure accessibility_service_description string exists in strings.xml
      const stringsXmlPath = path.join(resValuesDir, "strings.xml");
      const descString = `<string name="accessibility_service_description">Used by Blackout to detect foreground app launches and enforce app lock limits.</string>`;
      if (fs.existsSync(stringsXmlPath)) {
        let existingContent = fs.readFileSync(stringsXmlPath, "utf8");
        if (!existingContent.includes("accessibility_service_description")) {
          existingContent = existingContent.replace(
            "</resources>",
            `    ${descString}\n</resources>`
          );
          fs.writeFileSync(stringsXmlPath, existingContent);
        }
      } else {
        fs.writeFileSync(
          stringsXmlPath,
          `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="app_name">Blackout</string>\n    ${descString}\n</resources>`
        );
      }

      // Create accessibility_service_config.xml
      const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeWindowStateChanged"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:accessibilityFlags="flagDefault"
    android:canRetrieveWindowContent="false"
    android:description="@string/accessibility_service_description"
    android:notificationTimeout="100" />
`;
      fs.writeFileSync(
        path.join(resXmlDir, "accessibility_service_config.xml"),
        xmlContent
      );

      // BlackoutAccessibilityService.kt
      const accessibilityServiceContent = `package com.blackout.app

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.view.accessibility.AccessibilityEvent
import android.util.Log

class BlackoutAccessibilityService : AccessibilityService() {

    companion object {
        var lockedPackages: Set<String> = emptySet()
        var currentForegroundPackage: String = ""
        var instance: BlackoutAccessibilityService? = null
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        Log.d("BlackoutAccessibility", "Accessibility Service Connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val packageName = event.packageName?.toString() ?: return
            if (packageName.startsWith("com.blackout.app") || packageName.contains("launcher") || packageName.contains("systemui")) {
                return
            }
            currentForegroundPackage = packageName

            if (lockedPackages.contains(packageName)) {
                // Launch Blackout overlay/app
                val intent = packageManager.getLaunchIntentForPackage(packageName)
                val blackoutIntent = Intent(applicationContext, MainActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    putExtra("BLOCK_TARGET_PACKAGE", packageName)
                }
                applicationContext.startActivity(blackoutIntent)
            }
        }
    }

    override fun onInterrupt() {
        Log.d("BlackoutAccessibility", "Accessibility Service Interrupted")
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
    }
}
`;
      fs.writeFileSync(
        path.join(androidSrcDir, "BlackoutAccessibilityService.kt"),
        accessibilityServiceContent
      );

      // BlackoutModule.kt
      const blackoutModuleContent = `package com.blackout.app

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
    fun hasUsageStatsPermission(promise: Promise) {
        try {
            val appOps = reactApplicationContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), reactApplicationContext.packageName)
            } else {
                appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), reactApplicationContext.packageName)
            }
            if (mode == AppOpsManager.MODE_ALLOWED) {
                promise.resolve(true)
                return
            }
            val mode2 = appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), reactApplicationContext.packageName)
            promise.resolve(mode2 == AppOpsManager.MODE_ALLOWED)
        } catch (e: Exception) {
            promise.resolve(false)
        }
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
            val pkgName = reactApplicationContext.packageName
            val isEnabled = enabledServices != null && (
                enabledServices.contains("BlackoutAccessibilityService", ignoreCase = true) ||
                enabledServices.contains(pkgName, ignoreCase = true)
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
            val selfPkg = reactApplicationContext.packageName

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

            try {
                val installedAppsList = pm.getInstalledApplications(0)
                for (appInfo in installedAppsList) {
                    val packageName = appInfo.packageName
                    if (packageName != selfPkg && !addedPackages.contains(packageName)) {
                        val launchIntent = pm.getLaunchIntentForPackage(packageName)
                        if (launchIntent != null) {
                            addedPackages.add(packageName)
                            val appName = pm.getApplicationLabel(appInfo).toString()
                            val map = WritableNativeMap().apply {
                                putString("packageName", packageName)
                                putString("appName", appName)
                                putString("category", "Installed App")
                            }
                            array.pushMap(map)
                        }
                    }
                }
            } catch (e: Exception) {
                // ignore secondary list error
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
                    putString("dateStr", "\${dayCal.get(Calendar.MONTH) + 1}/\${dayCal.get(Calendar.DAY_OF_MONTH)}")
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

            val systemIgnores = setOf(
                "com.android.systemui",
                "android",
                "com.google.android.inputmethod.latin",
                reactApplicationContext.packageName
            )

            for ((pkg, timeMs) in packageUsageMap.entries) {
                if (systemIgnores.contains(pkg) || pkg.contains("launcher") || pkg.contains("systemui")) continue
                try {
                    val appInfo = pm.getApplicationInfo(pkg, 0)
                    if (pm.getLaunchIntentForPackage(pkg) == null) continue
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
`;
      fs.writeFileSync(
        path.join(androidSrcDir, "BlackoutModule.kt"),
        blackoutModuleContent
      );

      // BlackoutPackage.kt
      const blackoutPackageContent = `package com.blackout.app

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class BlackoutPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(BlackoutModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
`;
      fs.writeFileSync(
        path.join(androidSrcDir, "BlackoutPackage.kt"),
        blackoutPackageContent
      );

      return config;
    },
  ]);

  // 3. MainApplication changes to register BlackoutPackage
  config = withMainApplication(config, (config) => {
    let contents = config.modResults.contents;
    if (!contents.includes("BlackoutPackage()")) {
      contents = contents.replace(
        "val packages = PackageList(this).packages",
        "val packages = PackageList(this).packages.toMutableList()\n            packages.add(BlackoutPackage())"
      );
      config.modResults.contents = contents;
    }
    return config;
  });

  return config;
};

module.exports = withBlackoutNativeModule;
