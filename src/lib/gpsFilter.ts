/**
 * Kalman smoothing for GPS positions (no imports, so it can be unit-tested on its own).
 * Each fix is weighted by its reported accuracy; between fixes the uncertainty grows
 * with the expected movement speed. This removes most GPS zig-zag, which otherwise
 * inflates distance, without lagging behind real movement.
 */
export class KalmanLatLng {
  private lat = 0;
  private lng = 0;
  private variance = -1; // metres², negative = not initialised
  private t = 0;
  private q: number; // process noise, metres per second
  constructor(q: number) { this.q = q; }

  setSpeed(q: number) { this.q = q; }
  reset() { this.variance = -1; }

  process(lat: number, lng: number, accuracy: number, tMs: number) {
    const acc = Math.max(accuracy, 1);
    if (this.variance < 0) {
      this.lat = lat; this.lng = lng; this.variance = acc * acc; this.t = tMs;
    } else {
      const dt = Math.max(0, (tMs - this.t) / 1000);
      if (dt > 0) { this.variance += dt * this.q * this.q; this.t = tMs; }
      const k = this.variance / (this.variance + acc * acc);
      this.lat += k * (lat - this.lat);
      this.lng += k * (lng - this.lng);
      this.variance = (1 - k) * this.variance;
    }
    return { lat: this.lat, lng: this.lng, sigma: Math.sqrt(this.variance) };
  }
}

export function havM(a: readonly number[], b: readonly number[]) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
