import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { isNative } from './platform';

export async function buzz() {
  try {
    if (isNative) { await Haptics.impact({ style: ImpactStyle.Heavy }); setTimeout(() => void Haptics.impact({ style: ImpactStyle.Heavy }), 300); }
    else navigator.vibrate?.([250, 120, 250]);
  } catch { /* not supported */ }
}
/** One light tap of the vibration motor (badge taps, level-ups) */
export async function tapFeel() {
  try {
    if (isNative) await Haptics.impact({ style: ImpactStyle.Light });
    else navigator.vibrate?.(15);
  } catch { /* not supported */ }
}
export function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(text)); } catch { /* not supported */ }
}
/** iOS/Safari only allow speech that was first started from a tap */
export function unlockSpeech() { if ('speechSynthesis' in window) try { speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch { /* noop */ } }
