package com.blackout.app

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
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
        var lockedPackages: Set<String> = emptySet()
        var currentForegroundPackage: String = ""
        var instance: BlackoutAccessibilityService? = null
    }

    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private var isOverlayShowing = false

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        Log.d("BlackoutAccessibility", "Accessibility Service Connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val packageName = event.packageName?.toString() ?: return
            if (packageName.startsWith("com.blackout.app") || packageName.contains("launcher") || packageName.contains("systemui")) {
                removeOverlay()
                return
            }
            currentForegroundPackage = packageName

            if (lockedPackages.contains(packageName)) {
                performGlobalAction(GLOBAL_ACTION_HOME)
                showOverlay(packageName)
            } else {
                removeOverlay()
            }
        }
    }

    private fun showOverlay(packageName: String) {
        if (isOverlayShowing) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Log.w("BlackoutAccessibility", "Overlay permission missing, falling back to home screen")
            performGlobalAction(GLOBAL_ACTION_HOME)
            return
        }

        try {
            val layout = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                setBackgroundColor(Color.BLACK)
                setPadding(64, 64, 64, 64)
            }

            // Title: BLACKOUT
            val titleText = TextView(this).apply {
                text = "BLACKOUT"
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 28f)
                typeface = android.graphics.Typeface.DEFAULT_BOLD
                gravity = Gravity.CENTER
                letterSpacing = 0.1f
            }
            layout.addView(titleText)

            // Subtitle / Strict Warning Message
            val warningText = TextView(this).apply {
                text = "This app is blacked out until 12 AM tomorrow."
                setTextColor(Color.parseColor("#A1A1AA"))
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
                gravity = Gravity.CENTER
                setPadding(0, 32, 0, 48)
            }
            layout.addView(warningText)

            // Button: GO TO HOME SCREEN
            val homeButton = Button(this).apply {
                text = "GO TO HOME SCREEN"
                setTextColor(Color.BLACK)
                setBackgroundColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
                typeface = android.graphics.Typeface.DEFAULT_BOLD
                setPadding(32, 16, 32, 16)
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
                        WindowManager.LayoutParams.FLAG_FULLSCREEN or
                        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT
            )
            params.gravity = Gravity.CENTER

            windowManager?.addView(layout, params)
            overlayView = layout
            isOverlayShowing = true
        } catch (e: Exception) {
            Log.e("BlackoutAccessibility", "Failed to add overlay view", e)
            performGlobalAction(GLOBAL_ACTION_HOME)
        }
    }

    private fun removeOverlay() {
        if (isOverlayShowing && overlayView != null) {
            try {
                windowManager?.removeView(overlayView)
            } catch (e: Exception) {
                Log.e("BlackoutAccessibility", "Failed to remove overlay view", e)
            } finally {
                overlayView = null
                isOverlayShowing = false
            }
        }
    }

    override fun onInterrupt() {
        Log.d("BlackoutAccessibility", "Accessibility Service Interrupted")
        removeOverlay()
    }

    override fun onDestroy() {
        super.onDestroy()
        removeOverlay()
        instance = null
    }
}
