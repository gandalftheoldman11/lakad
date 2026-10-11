import type { PluginListenerHandle } from '@capacitor/core';
import { CapacitorPedometer } from '@capgo/capacitor-pedometer';
import { isNative } from './platform';

/**
 * The phone's built-in hardware step counter (Android app; iOS app if built natively).
 * Far more accurate than accelerometer detection and keeps counting with the screen off.
 * Not available to websites, so the PWA falls back to StepDetector.
 */
export interface Pedometer { start(onSteps: (sinceStart: number) => void): Promise<'on' | 'denied' | 'none'>; stop(): Promise<void> }

export function createPedometer(): Pedometer | null {
  if (!isNative) return null;
  let handle: PluginListenerHandle | null = null;
  return {
    async start(onSteps) {
      try {
        const av = await CapacitorPedometer.isAvailable();
        if (!av.stepCounting) return 'none';
        let p = await CapacitorPedometer.checkPermissions();
        if (p.activityRecognition !== 'granted') p = await CapacitorPedometer.requestPermissions();
        if (p.activityRecognition !== 'granted') return 'denied';
        handle = await CapacitorPedometer.addListener('measurement', m => { if (typeof m.numberOfSteps === 'number') onSteps(m.numberOfSteps); });
        await CapacitorPedometer.startMeasurementUpdates();
        return 'on';
      } catch { return 'none'; }
    },
    async stop() {
      try { await CapacitorPedometer.stopMeasurementUpdates(); } catch { /* noop */ }
      try { await handle?.remove(); } catch { /* noop */ }
      handle = null;
    }
  };
}
