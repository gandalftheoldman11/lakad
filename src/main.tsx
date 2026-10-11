import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
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

loadData().then(() => initSync());

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
