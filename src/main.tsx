import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { initTheme } from './lib/theme';
import { loadData } from './lib/data';
import { initSync } from './lib/sync';
import { loadPending, persistRecording } from './lib/recorder';
import { isNative } from './lib/platform';
import { initPwa } from './lib/pwa';

if (!isNative) initPwa();
loadPending();
// Clear lock-screen stats left over from a recording that ended while the app was closed
if (isNative) void import('./lib/liveStatus').then(m => m.endLive());
document.addEventListener('visibilitychange', () => persistRecording());

loadData().then(() => { initTheme(); initSync(); void import('./lib/plans').then(m => m.loadPlans()); void import('./lib/offlineArea').then(m => m.loadArea()); void import('./lib/reminders').then(m => m.initReminders()); void import('./lib/phoneSteps').then(m => m.initPhoneSteps()); });

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

// load the map parts in the background soon after start, so maps still open if you go offline later
setTimeout(() => { void import('./components/RouteMap').catch(() => {}); void import('./components/PlanMap').catch(() => {}); }, 800);
