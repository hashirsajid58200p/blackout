package com.blackout.app

import android.accessibilityservice.AccessibilityService
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
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
import java.util.Calendar

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

    private fun sendToHome(): Boolean {
        var success = performGlobalAction(GLOBAL_ACTION_HOME)
        if (!success) {
            Log.w(TAG, "performGlobalAction(GLOBAL_ACTION_HOME) returned false, retrying immediately...")
            success = performGlobalAction(GLOBAL_ACTION_HOME)
            if (!success) {
                Log.w(TAG, "performGlobalAction(GLOBAL_ACTION_HOME) retry returned false, launching Home intent fallback")
                try {
                    val homeIntent = Intent(Intent.ACTION_MAIN).apply {
                        addCategory(Intent.CATEGORY_HOME)
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    startActivity(homeIntent)
                    return true
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to launch home intent fallback", e)
                }
            }
        } else {
            Log.i(TAG, "performGlobalAction(GLOBAL_ACTION_HOME) succeeded")
        }
        return success
    }

    private fun enforceBlock(packageName: String) {
        Log.i(TAG, "enforceBlock triggered for package: $packageName")
        removeCountdownOverlay()
        lockedPackages.add(packageName)
        SecurityHelper.markPackageLocked(applicationContext, packageName)
        showOverlay(packageName)
        notifyLockedAppIfApplicable(packageName)

        isTransitioningToHome = true
        lastBlockedPackage = packageName

        // Cancel any pending overlay hide so overlay stays firmly visible
        mainHandler.removeCallbacks(hideOverlayRunnable)

        // Force app to background
        sendToHome()

        // Safety timeout: if no window state change arrives within 5s, dismiss overlay safely
        mainHandler.removeCallbacks(safetyTimeoutRunnable)
        mainHandler.postDelayed(safetyTimeoutRunnable, 5000L)
    }

    private fun isIgnoredPackage(packageName: String): Boolean {
        val lower = packageName.lowercase()
        return lower == "com.blackout.app" ||
                lower.startsWith("com.blackout") ||
                lower.contains("systemui") ||
                lower.contains("navigationbar")
    }

    private fun isLauncherOrHome(packageName: String): Boolean {
        val lower = packageName.lowercase()
        if (lower.contains("launcher") || lower.contains("trebuchet") ||
            lower.contains("quickstep") || lower.contains("nexuslauncher") ||
            lower.contains("shade") || lower.contains("bitpit")) {
            return true
        }
        try {
            val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
            val resolveInfos = packageManager.queryIntentActivities(intent, 0)
            for (info in resolveInfos) {
                if (info.activityInfo?.packageName.equals(packageName, ignoreCase = true)) {
                    return true
                }
            }
        } catch (e: Exception) {
            // Ignore
        }
        return false
    }

    private var isTransitioningToHome = false
    private var lastBlockedPackage: String? = null

    private val hideOverlayRunnable = Runnable {
        Log.i(TAG, "hideOverlayRunnable: dismissing overlay")
        hideOverlay()
        cancelLockedAppNotification()
        isTransitioningToHome = false
        lastBlockedPackage = null
    }

    private val safetyTimeoutRunnable = Runnable {
        Log.w(TAG, "safetyTimeoutRunnable: 5s timeout reached without launcher confirmation, dismissing overlay")
        hideOverlay()
        cancelLockedAppNotification()
        isTransitioningToHome = false
        lastBlockedPackage = null
    }

    private val countdownRunnable = object : Runnable {
        override fun run() {
            if (!isCountdownShowing || countdownPackage == null) return

            countdownSeconds--
            if (countdownSeconds <= 0) {
                val targetPkg = countdownPackage ?: ""
                enforceBlock(targetPkg)
            } else {
                countdownTv?.text = countdownSeconds.toString()
                countdownSubTv?.text = "Daily limit ends in ${countdownSeconds}s"
                mainHandler.postDelayed(this, 1000L)
            }
        }
    }

    // Consolidated safety net: runs at low frequency (every 3s)
    private val safetyNetRunnable = object : Runnable {
        override fun run() {
            try {
                if (!isTransitioningToHome) {
                    val activePkg = rootInActiveWindow?.packageName?.toString() ?: currentForegroundPackage
                    if (activePkg != null && !isIgnoredPackage(activePkg)) {
                        if (isLauncherOrHome(activePkg)) {
                            if (overlayView?.visibility == View.VISIBLE) {
                                hideOverlay()
                                removeCountdownOverlay()
                                cancelLockedAppNotification()
                            }
                        } else if (isAppBlocked(activePkg)) {
                            Log.w(TAG, "Safety net detected active blocked package: $activePkg")
                            enforceBlock(activePkg)
                        } else {
                            checkCountdownIfAboutToBlock(activePkg)
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error in safety net runnable", e)
            }
            mainHandler.postDelayed(this, 3000L)
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
        mainHandler.post(safetyNetRunnable)
        Log.d(TAG, "Blackout Accessibility Service connected successfully")
    }

    fun resetDailyUsage() {
        try {
            currentSessionStartTime = 0L
            currentForegroundPackage = null
            isTransitioningToHome = false
            lastBlockedPackage = null
            mainHandler.removeCallbacks(hideOverlayRunnable)
            mainHandler.removeCallbacks(safetyTimeoutRunnable)
            hideOverlay()
            cancelLockedAppNotification()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val pkg = event.packageName?.toString() ?: return

        Log.i(TAG, "onAccessibilityEvent: pkg=$pkg, isTransitioningToHome=$isTransitioningToHome")

        // 1. If user opened Blackout itself, dismiss overlay if open (unless we are transitioning to home)
        if (pkg == "com.blackout.app" || pkg.startsWith("com.blackout")) {
            if (isTransitioningToHome) {
                Log.d(TAG, "Ignoring com.blackout.app event during transition to home")
                return
            }
            if (overlayView?.visibility == View.VISIBLE) {
                hideOverlay()
                removeCountdownOverlay()
                cancelLockedAppNotification()
                lastBlockedPackage = null
            }
            return
        }

        // 2. Ignore system UI popups (notification shade, gesture bar)
        if (pkg.contains("systemui") || pkg.contains("navigationbar")) return

        currentForegroundPackage = pkg
        currentSessionStartTime = System.currentTimeMillis()

        // 3. User arrived at Launcher/Home
        if (isLauncherOrHome(pkg)) {
            Log.i(TAG, "Arrived at launcher: $pkg, isTransitioningToHome=$isTransitioningToHome")
            if (isTransitioningToHome) {
                // Positive confirmation that blocked app is no longer in foreground
                mainHandler.removeCallbacks(safetyTimeoutRunnable)
                mainHandler.removeCallbacks(hideOverlayRunnable)
                // Brief 400ms delay to let Home window settle cleanly without flashing blocked app
                mainHandler.postDelayed(hideOverlayRunnable, 400L)
            } else if (overlayView?.visibility == View.VISIBLE) {
                hideOverlay()
                removeCountdownOverlay()
                cancelLockedAppNotification()
            }
            return
        }

        // 4. Check if app is blocked
        if (isAppBlocked(pkg)) {
            Log.i(TAG, "App is blocked: $pkg, triggering enforceBlock")
            enforceBlock(pkg)
        } else {
            // Normal unblocked app: hide overlay if previously visible
            if (overlayView?.visibility == View.VISIBLE) {
                hideOverlay()
                cancelLockedAppNotification()
            }
            isTransitioningToHome = false
            lastBlockedPackage = null
            mainHandler.removeCallbacks(hideOverlayRunnable)
            mainHandler.removeCallbacks(safetyTimeoutRunnable)
            checkCountdownIfAboutToBlock(pkg)
        }
    }

    private fun isAppBlocked(packageName: String): Boolean {
        try {
            val now = System.currentTimeMillis()
            val prefs = getSharedPreferences("BlackoutPrefs", Context.MODE_PRIVATE)
            val jsonString = prefs.getString("locked_apps_json", null) ?: return false
            val jsonArray = JSONArray(jsonString)
            for (i in 0 until jsonArray.length()) {
                val itemObj = jsonArray.optJSONObject(i) ?: continue
                val pkg = itemObj.optString("packageName")
                if (pkg == packageName) { // STRICT EQUALITY
                    var lockExpirationTimestamp = itemObj.optLong("lockExpirationTimestamp", 0L)
                    if (lockExpirationTimestamp <= 0L) {
                        val lockDate = itemObj.optString("lockDate", "")
                        if (lockDate.isNotEmpty()) {
                            try {
                                val parts = lockDate.split("-")
                                if (parts.size == 3) {
                                    val cal = Calendar.getInstance().apply {
                                        set(Calendar.YEAR, parts[0].toInt())
                                        set(Calendar.MONTH, parts[1].toInt() - 1)
                                        set(Calendar.DAY_OF_MONTH, parts[2].toInt())
                                        add(Calendar.DAY_OF_YEAR, 1)
                                        set(Calendar.HOUR_OF_DAY, 0)
                                        set(Calendar.MINUTE, 0)
                                        set(Calendar.SECOND, 0)
                                        set(Calendar.MILLISECOND, 0)
                                    }
                                    lockExpirationTimestamp = cal.timeInMillis
                                }
                            } catch (e: Exception) {}
                        }
                    }

                    if (lockExpirationTimestamp > 0L && now >= lockExpirationTimestamp) {
                        // Lock period has expired! App is NOT blocked.
                        Log.d(TAG, "Lock expired for $packageName (now=$now >= expiration=$lockExpirationTimestamp). Allowing access.")
                        lockedPackages.remove(packageName)
                        return false
                    }

                    val isLocked = itemObj.optBoolean("isLocked", false)
                    val dailyLimitMs = itemObj.optDouble("dailyLimitMs", 0.0)
                    var usedTodayMs = itemObj.optDouble("usedTodayMs", 0.0)
                    val initialUsageMs = itemObj.optDouble("initialUsageMs", 0.0)

                    if (dailyLimitMs > 0) {
                        val liveUsage = SecurityHelper.getTodayPackageUsage(this, packageName)
                        val liveElapsed = Math.max(0.0, liveUsage.toDouble() - initialUsageMs)
                        if (liveElapsed > usedTodayMs) {
                            usedTodayMs = liveElapsed
                        }
                    }

                    val currentElapsed = Math.max(0.0, usedTodayMs)
                    if (isLocked || (dailyLimitMs > 0 && currentElapsed >= dailyLimitMs)) {
                        return true
                    } else {
                        lockedPackages.remove(packageName)
                        return false
                    }
                }
            }
            // Package is not tracked/locked in JSON
            lockedPackages.remove(packageName)
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
            setBackgroundColor(Color.parseColor("#12161F")) // Navy Vintage Dark Background
            setPadding(64, 64, 64, 64)
            isClickable = true
            isFocusable = true
            setOnTouchListener { _, _ -> true } // CRITICAL: consume ALL touch events
            visibility = View.GONE
        }

        // Vintage Minimalist Rubber Stamp / Lock Badge
        val iconBox = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            val drawable = android.graphics.drawable.GradientDrawable().apply {
                shape = android.graphics.drawable.GradientDrawable.OVAL
                setColor(Color.parseColor("#1B2030")) // espresso-surface / navy lifted
                setStroke((1.5f * resources.displayMetrics.density).toInt(), Color.parseColor("#B23A2E")) // stamp-red
            }
            background = drawable
            val sizePx = (80 * resources.displayMetrics.density).toInt()
            layoutParams = LinearLayout.LayoutParams(sizePx, sizePx).apply {
                bottomMargin = (32 * resources.displayMetrics.density).toInt()
            }
            rotation = -3f
        }
        val stampText = TextView(this).apply {
            text = "LOCKED"
            setTextColor(Color.parseColor("#B23A2E"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
            typeface = android.graphics.Typeface.MONOSPACE
            gravity = Gravity.CENTER
            letterSpacing = 0.2f
        }
        iconBox.addView(stampText)
        layout.addView(iconBox)

        // Title: BLACKOUT
        val titleText = TextView(this).apply {
            text = "BLACKOUT"
            setTextColor(Color.parseColor("#E6E8EC")) // bone / slate-white
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 28f)
            typeface = android.graphics.Typeface.SERIF
            gravity = Gravity.CENTER
            letterSpacing = 0.15f
        }
        layout.addView(titleText)

        // Subtitle: TARGET APP IS DARK
        appNameTextView = TextView(this).apply {
            text = "APP IS DARK"
            setTextColor(Color.parseColor("#E6E8EC")) // bone / slate-white
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            typeface = android.graphics.Typeface.SERIF
            gravity = Gravity.CENTER
            letterSpacing = 0.08f
            setPadding(0, 16, 0, 8)
        }
        layout.addView(appNameTextView)

        // Warning / Lock explanation
        warningTextView = TextView(this).apply {
            text = "Daily screen time allowance reached.\nApplication is locked until 12:00 AM midnight.\nDiscipline by design."
            setTextColor(Color.parseColor("#8C93A6")) // bone-muted
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            gravity = Gravity.CENTER
            setPadding(0, 8, 0, 40)
            setLineSpacing(12f, 1.1f)
        }
        layout.addView(warningTextView)

        // Action Button: RETURN TO HOME SCREEN
        val homeButton = Button(this).apply {
            text = "RETURN TO HOME SCREEN"
            setTextColor(Color.parseColor("#12161F")) // dark navy
            val btnDrawable = android.graphics.drawable.GradientDrawable().apply {
                shape = android.graphics.drawable.GradientDrawable.RECTANGLE
                cornerRadius = 4f * resources.displayMetrics.density
                setColor(Color.parseColor("#E6E8EC")) // slate-white
                setStroke((1f * resources.displayMetrics.density).toInt(), Color.parseColor("#E6E8EC"))
            }
            background = btnDrawable
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            letterSpacing = 0.08f
            setPadding(32, 20, 32, 20)
            setOnClickListener {
                isTransitioningToHome = true
                sendToHome()
                mainHandler.removeCallbacks(hideOverlayRunnable)
                mainHandler.postDelayed(hideOverlayRunnable, 400L)
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

                    val liveUsageMs = SecurityHelper.getTodayPackageUsage(this, packageName).toDouble()
                    val baseUsage = itemObj.optDouble("usedTodayMs", 0.0)
                    val currentSessionTime = if (packageName == currentForegroundPackage && currentSessionStartTime > 0) {
                        (System.currentTimeMillis() - currentSessionStartTime).toDouble()
                    } else {
                        0.0
                    }
                    val totalUsage = Math.max(liveUsageMs, baseUsage + currentSessionTime)

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
                    setBackgroundColor(Color.parseColor("#EE12161F"))
                    val padH = (24 * resources.displayMetrics.density).toInt()
                    val padV = (16 * resources.displayMetrics.density).toInt()
                    setPadding(padH, padV, padH, padV)
                }

                val tagText = TextView(this).apply {
                    text = "BLACKOUT WARNING"
                    setTextColor(Color.parseColor("#B23A2E"))
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
                    typeface = android.graphics.Typeface.DEFAULT_BOLD
                    gravity = Gravity.CENTER
                    letterSpacing = 0.15f
                }
                layout.addView(tagText)

                val numText = TextView(this).apply {
                    text = countdownSeconds.toString()
                    setTextColor(Color.parseColor("#E6E8EC"))
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 40f)
                    typeface = android.graphics.Typeface.DEFAULT_BOLD
                    gravity = Gravity.CENTER
                    setPadding(0, 4, 0, 4)
                }
                countdownTv = numText
                layout.addView(numText)

                val subText = TextView(this).apply {
                    text = "$targetAppName LOCKS IN ${countdownSeconds}s"
                    setTextColor(Color.parseColor("#8C93A6"))
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
        mainHandler.removeCallbacks(safetyNetRunnable)
        mainHandler.removeCallbacks(hideOverlayRunnable)
        mainHandler.removeCallbacks(safetyTimeoutRunnable)
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
