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
    private var currentOverlayPackage: String? = null
    private var currentLockedPackage: String? = null
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
                if (!isOverlayShowing || currentLockedPackage != targetPkg) {
                    if (isOverlayShowing) removeOverlay()
                    currentLockedPackage = targetPkg
                    showOverlay(targetPkg)
                }
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
                if (isAppBlocked(pkg)) {
                    removeCountdownOverlay()
                    if (!isOverlayShowing || currentLockedPackage != pkg) {
                        if (isOverlayShowing) removeOverlay()
                        currentLockedPackage = pkg
                        showOverlay(pkg)
                    }
                } else {
                    checkCountdownIfAboutToBlock(pkg)
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
        if (event == null || event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val packageName = event.packageName?.toString() ?: return

        // If event is from our own package (com.blackout.app)
        if (packageName.startsWith("com.blackout.app") || packageName == applicationContext.packageName) {
            val className = event.className?.toString() ?: ""
            // Only dismiss overlay if user actually opened Blackout's MainActivity
            if (className.contains("MainActivity")) {
                if (isOverlayShowing) {
                    removeOverlay()
                    currentLockedPackage = null
                }
                currentForegroundPackage = packageName
                currentSessionStartTime = System.currentTimeMillis()
            }
            // If it's the overlay view itself (e.g. LinearLayout, FrameLayout), ignore it to avoid blinking loop!
            return
        }

        // 1. If user goes to Home/Launcher/SystemUI, ALWAYS remove overlay
        val isSystemOrHome = packageName.contains("launcher", ignoreCase = true) ||
                packageName.contains("systemui", ignoreCase = true) ||
                packageName.contains("home", ignoreCase = true) ||
                packageName.contains("trebuchet", ignoreCase = true) ||
                packageName.contains("quickstep", ignoreCase = true) ||
                packageName.contains("navigationbar", ignoreCase = true) ||
                packageName == "android"

        if (isSystemOrHome) {
            if (isOverlayShowing) {
                removeOverlay()
                currentLockedPackage = null
            }
            removeCountdownOverlay()
            currentForegroundPackage = packageName
            return
        }

        // Anti-uninstall protection: Prevent opening Settings or Package Installer while ANY app is locked
        if (packageName == "com.android.settings" ||
            packageName == "com.google.android.packageinstaller" ||
            packageName == "com.android.packageinstaller") {
            if (SecurityHelper.hasActiveLocks(this)) {
                Log.w(TAG, "Anti-uninstall protection: Settings/PackageInstaller blocked while apps are locked")
                removeCountdownOverlay()
                if (!isOverlayShowing || currentLockedPackage != packageName) {
                    if (isOverlayShowing) removeOverlay()
                    currentLockedPackage = packageName
                    showOverlay(packageName, "Modifying Settings is blocked while apps are locked.")
                }
                return
            }
        }

        // 2. If the current foreground app is blocked
        if (isAppBlocked(packageName)) {
            removeCountdownOverlay()
            // Only show overlay if it's not already showing for THIS specific package
            if (!isOverlayShowing || currentLockedPackage != packageName) {
                if (isOverlayShowing) removeOverlay() // Clean up old overlay
                currentLockedPackage = packageName
                showOverlay(packageName)
            }
        } else {
            // 3. Foreground app is NOT blocked, remove overlay if it's showing
            if (isOverlayShowing) {
                removeOverlay()
                currentLockedPackage = null
            }
            checkCountdownIfAboutToBlock(packageName)
        }

        if (packageName != currentForegroundPackage) {
            currentForegroundPackage = packageName
            currentSessionStartTime = System.currentTimeMillis()
        }
    }

    fun resetDailyUsage() {
        try {
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

                        if (isLocked) return true
                        if (dailyLimitMs <= 0) return false

                        // Base usage from queryUsageStats (synced from React Native)
                        val baseUsage = itemObj.optDouble("usedTodayMs", 0.0)

                        // Calculate current active session time in-memory
                        val currentSessionTime = if (packageName == currentForegroundPackage && currentSessionStartTime > 0) {
                            (System.currentTimeMillis() - currentSessionStartTime).toDouble()
                        } else {
                            0.0
                        }

                        val totalUsage = baseUsage + currentSessionTime

                        if (totalUsage >= dailyLimitMs) {
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

                    val baseUsage = itemObj.optDouble("usedTodayMs", 0.0)
                    val currentSessionTime = if (packageName == currentForegroundPackage && currentSessionStartTime > 0) {
                        (System.currentTimeMillis() - currentSessionStartTime).toDouble()
                    } else {
                        0.0
                    }
                    val totalUsage = baseUsage + currentSessionTime

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
        if (isOverlayShowing && overlayView != null && currentLockedPackage == blockedPackage) {
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Log.w(TAG, "Overlay permission not granted")
            return
        }

        isOverlayShowing = true
        currentLockedPackage = blockedPackage
        currentOverlayPackage = blockedPackage

        mainHandler.post {
            try {
                if (overlayView != null) {
                    try {
                        windowManager?.removeView(overlayView)
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to remove previous overlay", e)
                    }
                    overlayView = null
                }

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
                    isClickable = true
                    isFocusable = true
                    setOnTouchListener { _, _ -> true }
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
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                    PixelFormat.TRANSLUCENT
                ).apply {
                    gravity = Gravity.CENTER
                }

                windowManager?.addView(layout, params)
                overlayView = layout
                Log.d(TAG, "Blackout blocking overlay displayed for $blockedPackage")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to display blocking overlay", e)
                isOverlayShowing = false
                currentLockedPackage = null
                currentOverlayPackage = null
            }
        }
    }

    private fun removeOverlay() {
        currentLockedPackage = null
        currentOverlayPackage = null
        isOverlayShowing = false
        if (overlayView != null) {
            val viewToRemove = overlayView
            overlayView = null
            mainHandler.post {
                try {
                    viewToRemove?.let { windowManager?.removeView(it) }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to remove blocking overlay view", e)
                }
            }
        }
    }

    private fun showBlockingOverlay(pkg: String, msg: String? = null) = showOverlay(pkg, msg)
    private fun removeBlockingOverlay() = removeOverlay()

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
        removeBlockingOverlay()
        removeCountdownOverlay()
    }

    override fun onDestroy() {
        super.onDestroy()
        mainHandler.removeCallbacks(foregroundMonitorRunnable)
        removeBlockingOverlay()
        removeCountdownOverlay()
        instance = null
        Log.d(TAG, "Accessibility service destroyed")
    }
}
