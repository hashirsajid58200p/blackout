package com.blackout.app

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class BlackoutAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "BlackoutAccessibility"
        var lockedPackages: MutableSet<String> = mutableSetOf()
        var instance: BlackoutAccessibilityService? = null

        // Real-time tracking
        var currentForegroundPackage: String? = null
        var currentSessionStartTime: Long = 0L
        var sessionUsageMap: MutableMap<String, Long> = mutableMapOf()
    }

    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private var isOverlayShowing = false
    private val mainHandler = Handler(Looper.getMainLooper())

    // 10-Second Countdown Overlay State
    private var countdownOverlayView: View? = null
    private var isCountdownShowing = false
    private var countdownPackage: String? = null
    private var countdownSeconds = 10
    private var countdownTv: TextView? = null
    private var countdownSubTv: TextView? = null

    private val countdownRunnable = object : Runnable {
        override fun run() {
            if (!isCountdownShowing || countdownPackage == null) return

            countdownSeconds--
            if (countdownSeconds <= 0) {
                val targetPkg = countdownPackage ?: ""
                removeCountdownOverlay()
                lockedPackages.add(targetPkg)
                SecurityHelper.markPackageLocked(applicationContext, targetPkg)
                performGlobalAction(GLOBAL_ACTION_HOME)
                showOverlay(targetPkg)
            } else {
                countdownTv?.text = countdownSeconds.toString()
                countdownSubTv?.text = "Daily limit ends in ${countdownSeconds}s"
                mainHandler.postDelayed(this, 1000L)
            }
        }
    }

    private val foregroundMonitorRunnable = object : Runnable {
        override fun run() {
            val pkg = currentForegroundPackage
            if (pkg != null && currentSessionStartTime > 0) {
                val liveDuration = System.currentTimeMillis() - currentSessionStartTime
                if (liveDuration > 0) {
                    val currentTotal = (sessionUsageMap[pkg] ?: 0L) + liveDuration
                    saveRealTimeUsage(pkg, currentTotal)

                    if (isAppBlocked(pkg)) {
                        removeCountdownOverlay()
                        performGlobalAction(GLOBAL_ACTION_HOME)
                        showOverlay(pkg)
                    } else {
                        checkCountdownIfAboutToBlock(pkg)
                    }
                }
            }
            mainHandler.postDelayed(this, 1000L)
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        SecurityHelper.scheduleMidnightReset(this)
        mainHandler.post(foregroundMonitorRunnable)
        Log.d(TAG, "Blackout Accessibility Service connected successfully")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val packageName = event.packageName?.toString() ?: return

            // Skip system packages
            if (packageName.startsWith("com.blackout.app") ||
                packageName.contains("launcher") ||
                packageName.contains("systemui") ||
                packageName.contains("home") ||
                packageName.contains("trebuchet") ||
                packageName.contains("quickstep") ||
                packageName.contains("navigationbar") ||
                packageName == "android") {
                if (isLauncherOrSystemUI(packageName) || packageName == applicationContext.packageName) {
                    removeOverlay()
                    removeCountdownOverlay()
                }
                return
            }

            // Anti-uninstall protection: Prevent opening Settings or Package Installer while ANY app is locked
            if (packageName == "com.android.settings" ||
                packageName == "com.google.android.packageinstaller" ||
                packageName == "com.android.packageinstaller") {
                if (SecurityHelper.hasActiveLocks(this)) {
                    Log.w(TAG, "Anti-uninstall protection triggered: Settings/PackageInstaller blocked while apps are locked")
                    removeCountdownOverlay()
                    performGlobalAction(GLOBAL_ACTION_BACK)
                    showOverlay(packageName, "Modifying Settings is blocked while apps are locked.")
                    return
                }
            }

            // If same package, ignore (avoid duplicate events)
            if (packageName == currentForegroundPackage) return

            // Calculate time for previous app
            if (currentForegroundPackage != null && currentSessionStartTime > 0) {
                val duration = System.currentTimeMillis() - currentSessionStartTime
                if (duration > 0) {
                    val prev = currentForegroundPackage!!
                    sessionUsageMap[prev] = (sessionUsageMap[prev] ?: 0L) + duration
                    saveRealTimeUsage(prev, sessionUsageMap[prev]!!)
                }
            }

            // Start tracking new app
            currentForegroundPackage = packageName
            currentSessionStartTime = System.currentTimeMillis()

            // Check if app should be blocked
            if (isAppBlocked(packageName)) {
                removeCountdownOverlay()
                performGlobalAction(GLOBAL_ACTION_HOME)
                showOverlay(packageName)
            } else {
                removeOverlay()
                checkCountdownIfAboutToBlock(packageName)
            }
        }
    }

    private fun saveRealTimeUsage(packageName: String, totalMs: Long) {
        try {
            val prefs = getSharedPreferences("BlackoutPrefs", Context.MODE_PRIVATE)
            val key = "realtime_usage_$packageName"
            prefs.edit().putLong(key, totalMs).apply()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun resetDailyUsage() {
        try {
            val prefs = getSharedPreferences("BlackoutPrefs", Context.MODE_PRIVATE)
            val editor = prefs.edit()
            val allEntries = prefs.all
            for ((key, _) in allEntries) {
                if (key.startsWith("realtime_usage_")) {
                    editor.remove(key)
                }
            }
            editor.apply()
            sessionUsageMap.clear()
            currentSessionStartTime = 0L
            currentForegroundPackage = null
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun isLauncherOrSystemUI(packageName: String): Boolean {
        return packageName.contains("launcher", ignoreCase = true) ||
                packageName.contains("systemui", ignoreCase = true) ||
                packageName.contains("home", ignoreCase = true) ||
                packageName.contains("trebuchet", ignoreCase = true) ||
                packageName.contains("quickstep", ignoreCase = true) ||
                packageName == "android"
    }

    private fun isAppBlocked(packageName: String): Boolean {
        // 1. Check in-memory set
        if (lockedPackages.contains(packageName)) {
            return true
        }

        // 2. Read from SharedPreferences
        try {
            val prefs = getSharedPreferences("BlackoutPrefs", Context.MODE_PRIVATE)
            val jsonString = prefs.getString("locked_apps_json", null) ?: return false

            val jsonArray = org.json.JSONArray(jsonString)
            for (i in 0 until jsonArray.length()) {
                val itemObj = jsonArray.optJSONObject(i)
                if (itemObj != null) {
                    val pkg = itemObj.optString("packageName")
                    if (pkg == packageName) {
                        val isLocked = itemObj.optBoolean("isLocked", false)
                        val dailyLimitMs = itemObj.optDouble("dailyLimitMs", 0.0)

                        // Get REAL-TIME usage from Accessibility Service tracking
                        val realTimeKey = "realtime_usage_$packageName"
                        var realTimeUsage = prefs.getLong(realTimeKey, 0L).toDouble()

                        if (packageName == currentForegroundPackage && currentSessionStartTime > 0) {
                            val liveDuration = System.currentTimeMillis() - currentSessionStartTime
                            if (liveDuration > 0) {
                                realTimeUsage = ((sessionUsageMap[packageName] ?: 0L) + liveDuration).toDouble()
                            }
                        }

                        // Also get base usage from queryUsageStats (synced from React Native)
                        val baseUsage = itemObj.optDouble("usedTodayMs", 0.0)

                        // Total = base (from queryUsageStats) + real-time session
                        val totalUsage = baseUsage + realTimeUsage

                        if (isLocked || (dailyLimitMs > 0 && totalUsage >= dailyLimitMs)) {
                            return true
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error checking blocked app status", e)
        }
        return false
    }

    private fun checkCountdownIfAboutToBlock(packageName: String) {
        try {
            val prefs = getSharedPreferences("BlackoutPrefs", Context.MODE_PRIVATE)
            val jsonString = prefs.getString("locked_apps_json", null) ?: return
            val jsonArray = org.json.JSONArray(jsonString)
            for (i in 0 until jsonArray.length()) {
                val itemObj = jsonArray.optJSONObject(i)
                if (itemObj != null && itemObj.optString("packageName") == packageName) {
                    val dailyLimitMs = itemObj.optDouble("dailyLimitMs", 0.0)
                    if (dailyLimitMs <= 0) return

                    val realTimeKey = "realtime_usage_$packageName"
                    var realTimeUsage = prefs.getLong(realTimeKey, 0L).toDouble()
                    if (packageName == currentForegroundPackage && currentSessionStartTime > 0) {
                        val live = System.currentTimeMillis() - currentSessionStartTime
                        if (live > 0) {
                            realTimeUsage = ((sessionUsageMap[packageName] ?: 0L) + live).toDouble()
                        }
                    }
                    val baseUsage = itemObj.optDouble("usedTodayMs", 0.0)
                    val totalUsage = baseUsage + realTimeUsage

                    if (totalUsage >= (dailyLimitMs - 10000.0) && totalUsage < dailyLimitMs) {
                        val remainingMs = (dailyLimitMs - totalUsage).toLong()
                        val remainingSecs = Math.max(1, Math.min(10, ((remainingMs + 999) / 1000).toInt()))
                        showCountdownOverlay(packageName, remainingSecs)
                    } else if (totalUsage < (dailyLimitMs - 10000.0)) {
                        removeCountdownOverlay()
                    }
                    return
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error checking countdown", e)
        }
    }

    private fun showOverlay(blockedPackage: String, customMessage: String? = null) {
        if (isOverlayShowing) return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Log.w(TAG, "Overlay permission not granted. Executing HOME action fallback.")
            performGlobalAction(GLOBAL_ACTION_HOME)
            return
        }

        mainHandler.post {
            try {
                if (isOverlayShowing || overlayView != null) return@post

                var targetAppName = blockedPackage
                try {
                    val appInfo = packageManager.getApplicationInfo(blockedPackage, 0)
                    targetAppName = packageManager.getApplicationLabel(appInfo).toString().uppercase()
                } catch (e: Exception) {
                    targetAppName = blockedPackage.uppercase()
                }

                val layout = LinearLayout(this).apply {
                    orientation = LinearLayout.VERTICAL
                    gravity = Gravity.CENTER
                    setBackgroundColor(Color.BLACK)
                    setPadding(56, 56, 56, 56)
                }

                // Monolith Logo / Icon Box
                val iconBox = LinearLayout(this).apply {
                    orientation = LinearLayout.VERTICAL
                    gravity = Gravity.CENTER
                    setBackgroundColor(Color.BLACK)
                    val sizePx = (72 * resources.displayMetrics.density).toInt()
                    layoutParams = LinearLayout.LayoutParams(sizePx, sizePx).apply {
                        bottomMargin = (32 * resources.displayMetrics.density).toInt()
                    }
                }
                val iconInner = View(this).apply {
                    setBackgroundColor(Color.WHITE)
                    val innerSize = (40 * resources.displayMetrics.density).toInt()
                    layoutParams = LinearLayout.LayoutParams(innerSize, innerSize)
                }
                iconBox.addView(iconInner)
                layout.addView(iconBox)

                // Title: BLACKOUT
                val titleText = TextView(this).apply {
                    text = "BLACKOUT"
                    setTextColor(Color.WHITE)
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 28f)
                    typeface = android.graphics.Typeface.DEFAULT_BOLD
                    gravity = Gravity.CENTER
                    letterSpacing = 0.15f
                }
                layout.addView(titleText)

                // Subtitle: TARGET APP IS DARK
                val appNameText = TextView(this).apply {
                    text = if (customMessage != null) "SECURITY ENFORCEMENT" else "$targetAppName IS DARK"
                    setTextColor(Color.parseColor("#E4E4E7"))
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
                    typeface = android.graphics.Typeface.DEFAULT_BOLD
                    gravity = Gravity.CENTER
                    letterSpacing = 0.08f
                    setPadding(0, 16, 0, 8)
                }
                layout.addView(appNameText)

                // Warning / Lock explanation
                val warningText = TextView(this).apply {
                    text = customMessage ?: "Daily screen time allowance reached.\nApplication is locked until 12:00 AM midnight.\nDiscipline by design."
                    setTextColor(Color.parseColor("#A1A1AA"))
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
                    gravity = Gravity.CENTER
                    setPadding(0, 8, 0, 40)
                    setLineSpacing(12f, 1.1f)
                }
                layout.addView(warningText)

                // Action Button: RETURN TO HOME SCREEN
                val homeButton = Button(this).apply {
                    text = "RETURN TO HOME SCREEN"
                    setTextColor(Color.BLACK)
                    setBackgroundColor(Color.WHITE)
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
                    typeface = android.graphics.Typeface.DEFAULT_BOLD
                    letterSpacing = 0.08f
                    setPadding(32, 20, 32, 20)
                    setOnClickListener {
                        performGlobalAction(GLOBAL_ACTION_HOME)
                        removeOverlay()
                    }
                }
                layout.addView(homeButton)

                val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                } else {
                    @Suppress("DEPRECATION")
                    WindowManager.LayoutParams.TYPE_PHONE
                }

                val params = WindowManager.LayoutParams(
                    WindowManager.LayoutParams.MATCH_PARENT,
                    WindowManager.LayoutParams.MATCH_PARENT,
                    layoutType,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                    PixelFormat.TRANSLUCENT
                ).apply {
                    gravity = Gravity.CENTER
                }

                windowManager?.addView(layout, params)
                overlayView = layout
                isOverlayShowing = true
                Log.d(TAG, "Blackout overlay displayed for $blockedPackage")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to display overlay", e)
                performGlobalAction(GLOBAL_ACTION_HOME)
            }
        }
    }

    private fun removeOverlay() {
        if (isOverlayShowing && overlayView != null) {
            mainHandler.post {
                try {
                    overlayView?.let { windowManager?.removeView(it) }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to remove overlay view", e)
                } finally {
                    overlayView = null
                    isOverlayShowing = false
                }
            }
        }
    }

    private fun showCountdownOverlay(packageName: String, remainingSecs: Int) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Log.w(TAG, "Overlay permission not granted for countdown overlay")
            return
        }

        if (isCountdownShowing && countdownPackage == packageName) {
            countdownSeconds = remainingSecs
            countdownTv?.text = countdownSeconds.toString()
            countdownSubTv?.text = "Daily limit ends in ${countdownSeconds}s"
            return
        }

        mainHandler.post {
            try {
                if (isCountdownShowing || countdownOverlayView != null) {
                    removeCountdownOverlay()
                }

                countdownPackage = packageName
                countdownSeconds = remainingSecs

                var targetAppName = packageName
                try {
                    val appInfo = packageManager.getApplicationInfo(packageName, 0)
                    targetAppName = packageManager.getApplicationLabel(appInfo).toString().uppercase()
                } catch (e: Exception) {
                    targetAppName = packageName.uppercase()
                }

                val layout = LinearLayout(this).apply {
                    orientation = LinearLayout.VERTICAL
                    gravity = Gravity.CENTER
                    setBackgroundColor(Color.parseColor("#EE09090B"))
                    val padH = (24 * resources.displayMetrics.density).toInt()
                    val padV = (16 * resources.displayMetrics.density).toInt()
                    setPadding(padH, padV, padH, padV)
                }

                val tagText = TextView(this).apply {
                    text = "BLACKOUT WARNING"
                    setTextColor(Color.parseColor("#EF4444"))
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
                    typeface = android.graphics.Typeface.DEFAULT_BOLD
                    gravity = Gravity.CENTER
                    letterSpacing = 0.15f
                }
                layout.addView(tagText)

                val numText = TextView(this).apply {
                    text = countdownSeconds.toString()
                    setTextColor(Color.WHITE)
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 40f)
                    typeface = android.graphics.Typeface.DEFAULT_BOLD
                    gravity = Gravity.CENTER
                    setPadding(0, 4, 0, 4)
                }
                countdownTv = numText
                layout.addView(numText)

                val subText = TextView(this).apply {
                    text = "$targetAppName LOCKS IN ${countdownSeconds}s"
                    setTextColor(Color.parseColor("#D4D4D8"))
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
                    typeface = android.graphics.Typeface.DEFAULT_BOLD
                    gravity = Gravity.CENTER
                    letterSpacing = 0.08f
                }
                countdownSubTv = subText
                layout.addView(subText)

                val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                } else {
                    @Suppress("DEPRECATION")
                    WindowManager.LayoutParams.TYPE_PHONE
                }

                val widthPx = (300 * resources.displayMetrics.density).toInt()
                val params = WindowManager.LayoutParams(
                    widthPx,
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    layoutType,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                    PixelFormat.TRANSLUCENT
                ).apply {
                    gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
                    y = (60 * resources.displayMetrics.density).toInt()
                }

                windowManager?.addView(layout, params)
                countdownOverlayView = layout
                isCountdownShowing = true
                mainHandler.postDelayed(countdownRunnable, 1000L)
                Log.d(TAG, "Countdown overlay displayed for $packageName starting at $countdownSeconds s")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to display countdown overlay", e)
            }
        }
    }

    private fun removeCountdownOverlay() {
        mainHandler.removeCallbacks(countdownRunnable)
        if (isCountdownShowing && countdownOverlayView != null) {
            mainHandler.post {
                try {
                    countdownOverlayView?.let { windowManager?.removeView(it) }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to remove countdown overlay", e)
                } finally {
                    countdownOverlayView = null
                    isCountdownShowing = false
                    countdownPackage = null
                    countdownTv = null
                    countdownSubTv = null
                }
            }
        } else {
            countdownOverlayView = null
            countdownPackage = null
            isCountdownShowing = false
            countdownTv = null
            countdownSubTv = null
        }
    }

    override fun onInterrupt() {
        Log.d(TAG, "Accessibility service interrupted")
        removeOverlay()
        removeCountdownOverlay()
    }

    override fun onDestroy() {
        super.onDestroy()
        mainHandler.removeCallbacks(foregroundMonitorRunnable)
        removeOverlay()
        removeCountdownOverlay()
        instance = null
        Log.d(TAG, "Accessibility service destroyed")
    }
}
