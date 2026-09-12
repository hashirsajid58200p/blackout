package com.blackout.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class MidnightResetReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "MidnightResetReceiver"
    }

    override fun onReceive(context: Context, intent: Intent?) {
        Log.d(TAG, "Midnight reset alarm received. Action: ${intent?.action}")
        SecurityHelper.resetMidnightLocks(context)
        // Send daily reset notification
        BlackoutNotificationManager.sendMidnightResetNotification(context, 0)
        // Re-arm the alarm for the next midnight
        SecurityHelper.scheduleMidnightReset(context)
    }
}
