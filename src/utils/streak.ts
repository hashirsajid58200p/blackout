import { WeeklyStats, TrackedApp } from "../types";

/**
 * Computes consecutive focus streak (in days) where the user maintained deliberate discipline.
 * If active tracked apps have not been prematurely breached and daily screen time remains disciplined,
 * streak increments.
 */
export const calculateFocusStreak = (
  weeklyStats: WeeklyStats[],
  trackedApps: TrackedApp[]
): number => {
  if (!weeklyStats || weeklyStats.length === 0) {
    return 1;
  }

  // Calculate 7-day average threshold
  const total = weeklyStats.reduce((acc, curr) => acc + curr.totalUsageMs, 0);
  const avgMs = total / weeklyStats.length;
  // Threshold: usage below 1.25x average or under 5 hours per day is considered disciplined
  const thresholdMs = Math.max(avgMs * 1.25, 5 * 3600 * 1000);

  let streak = 0;

  // Traverse from today (last index) backward
  for (let i = weeklyStats.length - 1; i >= 0; i--) {
    const day = weeklyStats[i];
    // If today has 0 usage yet, don't break the streak
    if (i === weeklyStats.length - 1 && day.totalUsageMs === 0) {
      streak++;
      continue;
    }

    if (day.totalUsageMs <= thresholdMs) {
      streak++;
    } else {
      break;
    }
  }

  // If user has active tracked apps enforcing discipline, ensure at least 1 day baseline
  if (streak === 0 && trackedApps.length > 0) {
    return 1;
  }

  return Math.max(1, streak);
};
