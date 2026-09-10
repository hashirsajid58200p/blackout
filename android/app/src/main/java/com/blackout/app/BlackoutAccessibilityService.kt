package com.blackout.app

import android.accessibilityservice.AccessibilityService
import android.app.NotificationChannel
import android.app.NotificationManager
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
import androidx.core.app.NotificationCompat
import org.json.JSONArray

class BlackoutAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "BlackoutAccessibility"
        const val NOTIFICATION_CHANNEL_ID = "blackout_channel"
        const val NOTIFICATION_ID = 1001

        var lockedPackages: MutableSet<String> = mutableSetOf()
        var instance: BlackoutAccessibilityService? = null

        // Real-time tracking
        var currentForegroundPackage: String? = null
        var currentSessionStartTime: Long = 0L
        var sessionUsageMap: MutableMap<String, Long> = mutableMapOf()
    }

    private var windowManager: WindowManager? = null
    private var overlayView: LinearLayout? = null
    private var overlayParams: WindowManager.LayoutParams? = null
    private var appNameTextView: TextView? = null
    private var warningTextView: TextView? = null
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
                showOverlay(targetPkg)
                notifyLockedAppIfApplicable(targetPkg)
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
            if (pkg != null) {
                if (pkg == "com.blackout.app" || pkg.startsWith("com.blackout") ||
                    pkg.contains("systemui") || pkg.contains("navigationbar")) {
                    // Do nothing
                } else {
                    val isHomeOrLauncher = pkg.contains("launcher") || pkg.contains("home") || 
                                          pkg.contains("trebuchet") || pkg.contains("quickstep") ||
                                          pkg.contains("android.settings") || pkg.contains("packageinstaller")
                    if (isHomeOrLauncher) {
                        hideOverlay()
                        removeCountdownOverlay()
                        cancelLockedAppNotification()
                    } else if (isAppBlocked(pkg)) {
                        removeCountdownOverlay()
                        showOverlay(pkg)
                        notifyLockedAppIfApplicable(pkg)
                        performGlobalAction(GLOBAL_ACTION_HOME)
                        currentForegroundPackage = null
                    } else {
                        hideOverlay()
                        cancelLockedAppNotification()
                        checkCountdownIfAboutToBlock(pkg)
                    }
                }
            }
            mainHandler.postDelayed(this, 1000L)
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        initOverlayView()
        SecurityHelper.scheduleMidnightReset(this)
        mainHandler.post(foregroundMonitorRunnable)
        Log.d(TAG, "Blackout Accessibility Service connected successfully")
    }

    fun resetDailyUsage() {
        try {
            sessionUsageMap.clear()
            currentSessionStartTime = 0L
            currentForegroundPackage = null
            hideOverlay()
            cancelLockedAppNotification()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun isSystemPackage(packageName: String): Boolean {
        return packageName.startsWith("com.blackout.app") ||
                packageName.contains("launcher") ||
                packageName.contains("systemui") ||
                packageName.contains("android.settings") ||
                packageName.contains("packageinstaller") ||
                packageName.contains("navigationbar") ||
                packageName == "android" ||
                packageName == "com.android.systemui" ||
                packageName == "com.android.settings"
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val pkg = event.packageName?.toString() ?: return

        // 1. CRITICAL: Ignore events from our own app to prevent infinite loop
        if (pkg == "com.blackout.app" || pkg.startsWith("com.blackout")) return

        // 2. Ignore System UI
        if (pkg.contains("systemui") || pkg.contains("navigationbar")) return

        // 3. If user goes to Home/Launcher, HIDE overlay and return
        val isHomeOrLauncher = pkg.contains("launcher") || pkg.contains("home") || 
                               pkg.contains("trebuchet") || pkg.contains("quickstep") ||
                               pkg.contains("android.settings") || pkg.contains("packageinstaller")

        if (isHomeOrLauncher) {
            hideOverlay()
            removeCountdownOverlay()
            cancelLockedAppNotification()
            currentForegroundPackage = pkg
            return
        }

        currentForegroundPackage = pkg
        currentSessionStartTime = System.currentTimeMillis()

        // 4. Check if app is locked
        if (isAppBlocked(pkg)) {
            // Show overlay IMMEDIATELY
            showOverlay(pkg)
            notifyLockedAppIfApplicable(pkg)
            removeCountdownOverlay()

            // CRITICAL: Force the user to Home screen so the app stops running in foreground
            // This solves the "app running behind" issue
            performGlobalAction(GLOBAL_ACTION_HOME)
            currentForegroundPackage = null
        } else {
            // If it's a normal app (not locked, not home), hide overlay
            hideOverlay()
            cancelLockedAppNotification()
            checkCountdownIfAboutToBlock(pkg)
        }
    }

    private fun isAppBlocked(packageName: String): Boolean {
        if (lockedPackages.contains(packageName)) return true
        try {
            val prefs = getSharedPreferences("BlackoutPrefs", Context.MODE_PRIVATE)
            val jsonString = prefs.getString("locked_apps_json", null) ?: return false
            val jsonArray = JSONArray(jsonString)
            for (i in 0 until jsonArray.length()) {
                val itemObj = jsonArray.optJSONObject(i) ?: continue
                val pkg = itemObj.optString("packageName")
                if (pkg == packageName) { // STRICT EQUALITY
                    val isLocked = itemObj.optBoolean("isLocked", false)
                    val dailyLimitMs = itemObj.optDouble("dailyLimitMs", 0.0)
                    var usedTodayMs = itemObj.optDouble("usedTodayMs", 0.0)

                    if (dailyLimitMs > 0) {
                        try {
                            val calendar = java.util.Calendar.getInstance(java.util.TimeZone.getDefault()).apply {
                                set(java.util.Calendar.HOUR_OF_DAY, 0)
                                set(java.util.Calendar.MINUTE, 0)
                                set(java.util.Calendar.SECOND, 0)
                                set(java.util.Calendar.MILLISECOND, 0)
                            }
                            val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as? android.app.usage.UsageStatsManager
                            val stats = usageStatsManager?.queryUsageStats(
                                android.app.usage.UsageStatsManager.INTERVAL_DAILY,
                                calendar.timeInMillis,
                                System.currentTimeMillis()
                            )
                            val liveUsage = stats?.find { it.packageName == packageName }?.totalTimeInForeground ?: 0L
                            if (liveUsage > usedTodayMs) {
                                usedTodayMs = liveUsage.toDouble()
                            }
                        } catch (e: Exception) {}
                    }

                    if (isLocked || (dailyLimitMs > 0 && usedTodayMs >= dailyLimitMs)) {
                        return true
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing locked_apps_json", e)
        }
        return false
    }

    private fun initOverlayView() {
        if (overlayView != null) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Log.w(TAG, "Overlay permission not granted")
            return
        }

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
            WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.CENTER
        }
        overlayParams = params

        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.BLACK)
            setPadding(64, 64, 64, 64)
            isClickable = true
            isFocusable = true
            setOnTouchListener { _, _ -> true } // CRITICAL: consume ALL touch events
            visibility = View.GONE
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
        appNameTextView = TextView(this).apply {
            text = "APP IS DARK"
            setTextColor(Color.parseColor("#E4E4E7"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            letterSpacing = 0.08f
            setPadding(0, 16, 0, 8)
        }
        layout.addView(appNameTextView)

        // Warning / Lock explanation
        warningTextView = TextView(this).apply {
            text = "Daily screen time allowance reached.\nApplication is locked until 12:00 AM midnight.\nDiscipline by design."
            setTextColor(Color.parseColor("#A1A1AA"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            gravity = Gravity.CENTER
            setPadding(0, 8, 0, 40)
            setLineSpacing(12f, 1.1f)
        }
        layout.addView(warningTextView)

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
                hideOverlay()
            }
        }
        layout.addView(homeButton)

        try {
            windowManager?.addView(layout, params)
            overlayView = layout
            Log.d(TAG, "Persistent overlay view added to WindowManager (initial: GONE)")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to add persistent overlay view to WindowManager", e)
        }
    }

    private fun showOverlay(packageName: String) {
        val action = Runnable {
            if (overlayView == null) {
                initOverlayView()
            }
            val view = overlayView ?: return@Runnable

            var targetAppName = packageName
            try {
                val appInfo = packageManager.getApplicationInfo(packageName, 0)
                targetAppName = packageManager.getApplicationLabel(appInfo).toString().uppercase()
            } catch (e: Exception) {
                targetAppName = packageName.uppercase()
            }
            appNameTextView?.text = "$targetAppName IS DARK"

            if (view.visibility != View.VISIBLE) {
                overlayParams?.flags = WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                try {
                    windowManager?.updateViewLayout(view, overlayParams)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to update overlay params to visible", e)
                }
                view.visibility = View.VISIBLE
                Log.d(TAG, "Overlay visibility set to VISIBLE for $packageName")
            }
        }
        if (Looper.myLooper() == Looper.getMainLooper()) {
            action.run()
        } else {
            mainHandler.post(action)
        }
    }

    private fun hideOverlay() {
        val action = Runnable {
            val view = overlayView ?: return@Runnable
            if (view.visibility != View.GONE) {
                view.visibility = View.GONE
                overlayParams?.flags = WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                try {
                    windowManager?.updateViewLayout(view, overlayParams)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to update overlay params to gone", e)
                }
                Log.d(TAG, "Overlay visibility set to GONE")
            }
        }
        if (Looper.myLooper() == Looper.getMainLooper()) {
            action.run()
        } else {
            mainHandler.post(action)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "App Locks",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Ongoing notification showing active app lock status and time remaining"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun updateLockedAppNotification(appName: String, usedMs: Long, limitMs: Long) {
        try {
            val progress = if (limitMs > 0) ((usedMs.toDouble() / limitMs) * 100).toInt().coerceIn(0, 100) else 100
            val remainingMs = Math.max(0, limitMs - usedMs)
            val remainingMin = Math.max(0, Math.ceil(remainingMs / 60000.0).toInt())

            val textContent = if (remainingMs <= 0 || progress >= 100) {
                "100% used • Locked until midnight"
            } else {
                "$progress% used • $remainingMin mins remaining"
            }

            val builder = NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setContentTitle("$appName Locked")
                .setContentText(textContent)
                .setProgress(100, progress, false)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)

            val manager = getSystemService(NotificationManager::class.java)
            manager?.notify(NOTIFICATION_ID, builder.build())
        } catch (e: Exception) {
            Log.e(TAG, "Error updating notification", e)
        }
    }

    private fun cancelLockedAppNotification() {
        try {
            val manager = getSystemService(NotificationManager::class.java)
            manager?.cancel(NOTIFICATION_ID)
        } catch (e: Exception) {
            Log.e(TAG, "Error canceling notification", e)
        }
    }

    private fun notifyLockedAppIfApplicable(packageName: String) {
        try {
            var appName = packageName
            try {
                val appInfo = packageManager.getApplicationInfo(packageName, 0)
                appName = packageManager.getApplicationLabel(appInfo).toString()
            } catch (e: Exception) {}

            val prefs = getSharedPreferences("BlackoutPrefs", Context.MODE_PRIVATE)
            val jsonString = prefs.getString("locked_apps_json", null)
            if (jsonString != null) {
                val jsonArray = JSONArray(jsonString)
                for (i in 0 until jsonArray.length()) {
                    val itemObj = jsonArray.optJSONObject(i) ?: continue
                    if (itemObj.optString("packageName") == packageName) {
                        val usedMs = itemObj.optDouble("usedTodayMs", 0.0).toLong()
                        val limitMs = itemObj.optDouble("dailyLimitMs", 0.0).toLong()
                        updateLockedAppNotification(appName, usedMs, limitMs)
                        return
                    }
                }
            }
            updateLockedAppNotification(appName, 100L, 100L)
        } catch (e: Exception) {
            Log.e(TAG, "Error in notifyLockedAppIfApplicable", e)
        }
    }

    private fun checkCountdownIfAboutToBlock(packageName: String) {
        try {
            val prefs = getSharedPreferences("BlackoutPrefs", Context.MODE_PRIVATE)
            val jsonString = prefs.getString("locked_apps_json", null) ?: return
            val jsonArray = JSONArray(jsonString)
            for (i in 0 until jsonArray.length()) {
                val itemObj = jsonArray.optJSONObject(i) ?: continue
                if (itemObj.optString("packageName") == packageName) {
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

    private fun showCountdownOverlay(packageName: String, remainingSecs: Int) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
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
        hideOverlay()
        removeCountdownOverlay()
        cancelLockedAppNotification()
    }

    override fun onDestroy() {
        super.onDestroy()
        mainHandler.removeCallbacks(foregroundMonitorRunnable)
        hideOverlay()
        removeCountdownOverlay()
        cancelLockedAppNotification()
        if (overlayView != null) {
            try {
                windowManager?.removeView(overlayView)
            } catch (e: Exception) {}
            overlayView = null
        }
        instance = null
        Log.d(TAG, "Accessibility service destroyed")
    }
}
