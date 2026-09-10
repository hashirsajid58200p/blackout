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
        var lockedPackages: Set<String> = emptySet()
        var currentForegroundPackage: String = ""
        var instance: BlackoutAccessibilityService? = null
    }

    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private var isOverlayShowing = false
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        SecurityHelper.scheduleMidnightReset(this)
        Log.d(TAG, "Blackout Accessibility Service connected successfully")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val packageName = event.packageName?.toString() ?: return
            currentForegroundPackage = packageName

            // Never block Blackout itself
            if (packageName == applicationContext.packageName) {
                removeOverlay()
                return
            }

            // Check if app is blocked
            if (isAppBlocked(packageName)) {
                Log.d(TAG, "Intercepted blocked package: $packageName")
                performGlobalAction(GLOBAL_ACTION_HOME)
                showOverlay(packageName)
                return
            }

            // Anti-uninstall protection: Prevent opening Settings or Package Installer while ANY app is locked
            if (packageName == "com.android.settings" ||
                packageName == "com.google.android.packageinstaller" ||
                packageName == "com.android.packageinstaller") {
                if (SecurityHelper.hasActiveLocks(this)) {
                    Log.w(TAG, "Anti-uninstall protection triggered: Settings/PackageInstaller blocked while apps are locked")
                    performGlobalAction(GLOBAL_ACTION_BACK)
                    showOverlay(packageName, "Modifying Settings is blocked while apps are locked.")
                    return
                }
            }

            // If navigating to home or an allowed non-systemui app, dismiss overlay
            if (isLauncherOrSystemUI(packageName) || !isAppBlocked(packageName)) {
                removeOverlay()
            }
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
        return SecurityHelper.isPackageBlocked(this, packageName)
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

    override fun onInterrupt() {
        Log.d(TAG, "Accessibility service interrupted")
        removeOverlay()
    }

    override fun onDestroy() {
        super.onDestroy()
        removeOverlay()
        instance = null
        Log.d(TAG, "Accessibility service destroyed")
    }
}
