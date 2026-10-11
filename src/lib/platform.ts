import { Capacitor } from '@capacitor/core';
export const isNative = Capacitor.isNativePlatform();
/** Running as an installed PWA (home screen), not in a browser tab */
export const isInstalledPwa = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
export const isIOS = typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
export const platform = Capacitor.getPlatform(); // 'web' | 'android' | 'ios'
export const isAndroidApp = platform === 'android';
export const isIOSApp = platform === 'ios';
