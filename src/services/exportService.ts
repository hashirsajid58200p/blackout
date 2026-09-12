import { Share, Platform } from "react-native";
import { TrackedApp, WeeklyStats } from "../types";

export interface LedgerExportData {
  trackedApps: TrackedApp[];
  weeklyUsage: WeeklyStats[];
  streakDays: number;
}

const formatMs = (ms: number): string => {
  const minutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const minsRem = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${minsRem}m`;
  }
  return `${minsRem}m`;
};

export const ExportService = {
  /**
   * Generates a clean, physical-ledger style formatted text report and launches native Share sheet.
   */
  async shareLedger(data: LedgerExportData): Promise<boolean> {
    try {
      const now = new Date();
      const dateStr = now.toISOString().replace("T", " ").substring(0, 16);

      const totalWeeklyMs = data.weeklyUsage.reduce((acc, curr) => acc + curr.totalUsageMs, 0);
      const avgWeeklyMs = Math.round(totalWeeklyMs / Math.max(1, data.weeklyUsage.length));

      let content = `BLACKOUT LEDGER INSTRUMENT // DISCIPLINE RECORD\n`;
      content += `Generated: ${dateStr}\n`;
      content += `Environment: Monolith Offline Engine (Zero Telemetry)\n`;
      content += `====================================================\n\n`;

      content += `[ 1. FOCUS DISCIPLINE METRICS ]\n`;
      content += `Current Discipline Streak: ${data.streakDays} DAYS UNBROKEN\n`;
      content += `7-Day Total Screen Time: ${(totalWeeklyMs / (1000 * 3600)).toFixed(1)}h\n`;
      content += `7-Day Daily Average: ${(avgWeeklyMs / (1000 * 3600)).toFixed(1)}h\n\n`;

      content += `[ 2. 7-DAY USAGE LOG ]\n`;
      data.weeklyUsage.forEach((w) => {
        const hours = (w.totalUsageMs / (1000 * 3600)).toFixed(1);
        content += `• ${w.day.padEnd(4)} (${w.dateStr}): ${hours}h\n`;
      });
      content += `\n`;

      content += `[ 3. ACTIVE MONITORED APPLICATIONS ]\n`;
      if (data.trackedApps.length === 0) {
        content += `• No applications currently tracked under daily limits.\n`;
      } else {
        data.trackedApps.forEach((app) => {
          const status = app.isLocked ? "LOCKED // SEALED" : "ACTIVE // RUNNING";
          content += `• ${app.appName.toUpperCase()}\n`;
          content += `  Allowance: ${formatMs(app.dailyLimitMs)} | Used Today: ${formatMs(app.usedTodayMs)} [${status}]\n`;
        });
      }

      content += `\n====================================================\n`;
      content += `Blackout: Analog-inspired digital wellbeing.\n`;

      const result = await Share.share(
        {
          title: "Blackout Discipline Ledger",
          message: content,
        },
        {
          dialogTitle: "EXPORT BLACKOUT LEDGER",
        }
      );

      return result.action === Share.sharedAction;
    } catch (e) {
      console.error("ExportService.shareLedger error", e);
      return false;
    }
  },
};
