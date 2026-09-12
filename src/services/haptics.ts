import { NativeBridge } from "./nativeBridge";

export const HapticsService = {
  /**
   * Light mechanical click for subtle UI feedback (steppers, presets, date carousel, switches).
   */
  tick(): void {
    NativeBridge.triggerHaptic("tick");
  },

  /**
   * Heavy mechanical stamp thud for deliberate commitments ("LOCK IT IN", modal confirm).
   */
  stamp(): void {
    NativeBridge.triggerHaptic("stamp");
  },

  /**
   * High-priority double strike pattern when an application block overlay is enacted.
   */
  strike(): void {
    NativeBridge.triggerHaptic("strike");
  },
};
