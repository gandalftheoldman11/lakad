import { registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
import { isAndroidApp, isNative } from './platform';

export interface Fix {
  lat: number; lng: number; accuracy: number;
  altitude: number | null; altitudeAccuracy: number | null;
  time: number;
}
export type GeoError = 'denied' | 'unavailable';
export interface Tracker { start(onFix: (f: Fix) => void, onError: (e: GeoError) => void): Promise<void>; stop(): Promise<void> }

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

/** Native app: keeps tracking with the screen off via an Android foreground service */
function nativeTracker(): Tracker {
  let id: string | null = null;
  return {
    async start(onFix, onError) {
      // Android 13+ needs notification permission to show the "recording" notification that keeps tracking alive
      if (isAndroidApp) { try { const p = await LocalNotifications.checkPermissions(); if (p.display !== 'granted') await LocalNotifications.requestPermissions(); } catch { /* older Android */ } }
      id = await BackgroundGeolocation.addWatcher(
        // On iPhone this keeps GPS running with the screen locked (blue location indicator in the status bar)
        { backgroundTitle: 'Lakad is recording', backgroundMessage: 'Tracking your route. Open Lakad to pause or finish.', requestPermissions: true, stale: false, distanceFilter: 0 },
        (loc, err) => {
          if (err) { onError(err.code === 'NOT_AUTHORIZED' ? 'denied' : 'unavailable'); return; }
          if (!loc || loc.simulated) return;
          onFix({ lat: loc.latitude, lng: loc.longitude, accuracy: loc.accuracy, altitude: loc.altitude ?? null, altitudeAccuracy: loc.altitudeAccuracy ?? null, time: loc.time ?? Date.now() });
        }
      );
    },
    async stop() { if (id) { await BackgroundGeolocation.removeWatcher({ id }); id = null; } }
  };
}

/** Browser/PWA: only works while the page is visible */
function webTracker(): Tracker {
  let id: number | null = null;
  return {
    async start(onFix, onError) {
      if (!('geolocation' in navigator)) { onError('unavailable'); return; }
      id = navigator.geolocation.watchPosition(
        p => onFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, altitude: p.coords.altitude, altitudeAccuracy: p.coords.altitudeAccuracy, time: p.timestamp }),
        e => onError(e.code === 1 ? 'denied' : 'unavailable'),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
      );
    },
    async stop() { if (id != null) navigator.geolocation.clearWatch(id); id = null; }
  };
}

export const createTracker = (): Tracker => (isNative ? nativeTracker() : webTracker());
export const openLocationSettings = () => (isNative ? BackgroundGeolocation.openSettings() : Promise.resolve());
