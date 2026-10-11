export type ActivityType = 'walk' | 'run';
/** pedometer = phone's hardware step counter · sensor = accelerometer detection · estimate = distance ÷ step length */
export type StepsSource = 'pedometer' | 'sensor' | 'estimate' | 'manual';
/** [lat, lng, elapsedSeconds] or [lat, lng, elapsedSeconds, 1] where 1 starts a new segment after a pause */
export type RoutePoint = [number, number, number] | [number, number, number, 1];

export interface Activity {
  id: string;
  type: ActivityType;
  start: number;          // ms epoch
  duration: number;       // moving seconds
  distance: number;       // meters
  steps: number;
  stepsSource: StepsSource;
  route: RoutePoint[];
  elevGain: number | null; // meters
  note: string;
  distanceEdited?: boolean;
  indoor?: boolean;       // recorded without GPS (distance from steps)
  updatedAt: number;
  deleted?: boolean;
}

export interface DayEntry { date: number; steps: number; updatedAt: number }

export type Units = 'km' | 'mi';
export interface Settings {
  goal: number;
  units: Units;
  weekGoal: number;   // in chosen units, 0 = off
  height: number;     // cm, 0 = not set
  weight: number;     // kg, 0 = not set
  autoPause: boolean;
  voice: boolean;
  /** show live distance/steps on the lock screen while recording (apps only) */
  lockScreen: boolean;
  /** step length in metres learned from your GPS walks/runs (0 = estimate from height) */
  strideWalk: number;
  strideRun: number;
  /** how many recordings calibrated it; -1 = you set it by hand */
  strideWalkN: number;
  strideRunN: number;
  updatedAt: number;
}

export const DEFAULT_SETTINGS: Settings = {
  goal: 8000, units: 'km', weekGoal: 0, height: 0, weight: 0, autoPause: true, voice: true, lockScreen: true, strideWalk: 0, strideRun: 0, strideWalkN: 0, strideRunN: 0, updatedAt: 0
};

export interface FeedPost {
  id: string;
  user_id: string;
  act_id: string;
  type: ActivityType;
  distance: number;
  duration: number;
  steps: number;
  elev_gain: number | null;
  note: string | null;
  shape: [number, number][];
  start: number;
  created_at: string;
  display_name: string | null;
}
