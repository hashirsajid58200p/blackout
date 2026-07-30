package com.blackout.app

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
