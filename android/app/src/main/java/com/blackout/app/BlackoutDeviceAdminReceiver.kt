package com.blackout.app

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import android.widget.Toast

class BlackoutDeviceAdminReceiver : DeviceAdminReceiver() {
    companion object {
        private const val TAG = "BlackoutAdmin"
    }

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Log.d(TAG, "Blackout Device Protection Enabled")
        Toast.makeText(context, "Blackout Device Protection Enabled", Toast.LENGTH_SHORT).show()
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        Log.d(TAG, "Blackout Device Protection Disabled")
        Toast.makeText(context, "Blackout Device Protection Disabled", Toast.LENGTH_SHORT).show()
    }

    override fun onDisableRequested(context: Context, intent: Intent): CharSequence? {
        Log.d(TAG, "Blackout Device Protection disable requested")
        val hasActiveLock = SecurityHelper.hasActiveLocks(context)
        if (hasActiveLock) {
            val warning = "CRITICAL: Active app limits are enforced until 12:00 AM midnight. Blackout Device Admin protection CANNOT be deactivated while locks are active."
            Log.w(TAG, "Rejecting Device Admin deactivation: $warning")
            Toast.makeText(context, warning, Toast.LENGTH_LONG).show()
            return warning
        }
        return null
    }
}
