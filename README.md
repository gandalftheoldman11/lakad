# Lakad

Walk and run tracker. React + TypeScript + Tailwind + Recharts, installable as a PWA, and built into an Android app with Capacitor for screen-off GPS tracking.

| | Web / PWA (Netlify) | Android app (APK) | iPhone app (TestFlight) |
|---|---|---|---|
| GPS tracking with screen on | Yes | Yes | Yes |
| GPS tracking with screen off or app in background | No. Gaps are bridged with a straight line when you return | Yes, with a "Lakad is recording" notification | Yes, with the blue location indicator |
| Steps | Motion sensor, while screen is on | Phone's hardware pedometer, also with screen off | iPhone step counter (Motion & Fitness), also with screen off |
| Spoken km alerts | While screen is on | While screen is on; vibration always | While screen is on; vibration always |
| Live stats on the lock screen | No (browsers can't) | Yes, a silent notification updated every 5 s | Yes, a Live Activity on the lock screen and Dynamic Island |
| Works offline | Yes | Yes | Yes |
| Sync, sign-in, feed | With Supabase | With Supabase | With Supabase |

## Project layout

```
src/
  lib/recorder.ts     recording engine: GPS filtering, pause/auto-pause, elevation, splits, crash recovery
  lib/tracker.ts      GPS source: browser watchPosition, or native background plugin on Android
  lib/metrics.ts      step length, calories (ACSM equations), streaks, totals
  lib/geo.ts          distance, splits, route shapes
  lib/data.ts         local storage (IndexedDB), works with no account
  lib/sync.ts         two-way sync with Supabase (newest change wins)
  lib/feed.ts         shared feed, cheers, leaderboard data
  screens/            Today, Record, Progress, Feed
  dialogs/            activity detail, add/edit, finish, settings, account, daily steps
supabase/schema.sql   database tables and security rules
android/              Capacitor Android project (generated, with icons and signing set up)
ios/                  Capacitor iPhone project, plus the Live Activity widget (ios/App/LakadWidget)
.github/workflows/    builds the Android APK automatically on every push
```

## 1. Run locally

```bash
npm install
npm run dev
```

Open the URL it prints. GPS needs HTTPS or localhost, so test recording on your phone after deploying.

## 2. Set up Supabase (for sign-in, sync and the feed)

Skip this if you only want a single-device app. Lakad works fully without it and hides sign-in and the feed.

1. Create a free project at supabase.com.
2. **SQL Editor → New query**, paste all of `supabase/schema.sql`, click **Run**.
3. **Authentication → Sign In / Providers → Email**: make sure Email is enabled.
4. **Authentication → Emails → Magic Link** template: replace the body so it sends a code instead of a link:
   ```html
   <h2>Your Lakad sign-in code</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   ```
   Codes work in the browser and in the Android app; links don't open the Android app.
5. **Project Settings → API**: copy the **Project URL** and the **anon public** key.

Supabase's built-in email sender is limited to a few emails per hour. Once real people use it, add your own SMTP (Resend, Brevo, etc.) under **Authentication → Emails → SMTP Settings**.

## 3. Deploy the web app to Netlify

1. Push this folder to a new GitHub repository.
2. Netlify: **Add new site → Import an existing project** → pick the repo. Build settings come from `netlify.toml` (build `npm run build`, publish `dist`).
3. **Site configuration → Environment variables**, add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
4. **Deploys → Trigger deploy → Clear cache and deploy site**. Environment variables only apply to new builds.
5. To use your own domain: **Domain management → Add a domain**, then point your DNS as Netlify shows. HTTPS is automatic.

On a phone, open the site and use **Add to Home screen** to install it as an app.

## 4. Build the Android app (background tracking)

You don't need Android Studio. GitHub builds the APK for you.

1. In the GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**, add the same two values: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. Every push to `main` runs **Actions → Build Android APK**. You can also run it by hand from the Actions tab with **Run workflow**.
3. When it finishes (about 5 minutes), open the run and download **lakad-android-N** under Artifacts. Unzip it to get `app-release.apk`.
4. Copy the APK to the phone and open it. Android will ask you to allow installing from that source.
5. On first recording, allow **location** ("While using the app"), **notifications** and **physical activity**. The notification keeps GPS running with the screen off; physical activity lets Lakad use the phone's step counter.

New builds install as updates over the old one, so data on the phone is kept.

**If tracking stops with the screen off:** Xiaomi, Oppo, Vivo, Realme and Samsung phones often kill background apps. Go to **Settings → Apps → Lakad → Battery** and choose **Unrestricted** (or "No restrictions"), and on Xiaomi also enable **Autostart**.

### Building on your own computer instead

Needs Android Studio and JDK 21.

```bash
npm run android      # builds, syncs, and opens Android Studio
```

### Publishing to Google Play later

The APK above is signed with a shared sideload key that's included in the repo, which is fine for installing on your own phones. For Play Store, create your own private key and add these GitHub secrets: `LAKAD_KEYSTORE_FILE` (path of the keystore in the runner), `LAKAD_KEYSTORE_PASSWORD`, `LAKAD_KEY_ALIAS`, `LAKAD_KEY_PASSWORD`. Play Store also requires a privacy policy and a declaration explaining background location use.

## 5. Build the iPhone app (screen-off tracking on iPhone)

Websites can't run on iPhone with the screen locked, so screen-off tracking on iPhone needs the native app in `ios/`. It uses the same code as the website, plus background GPS and the iPhone's own step counter.

Apple only lets you install your own apps through its developer program, so you need:

- An **Apple Developer Program** membership (USD 99 per year), at developer.apple.com.
- No Mac. GitHub builds it on its Mac machines (`.github/workflows/ios-app.yml`).

One-time setup:

1. **App Store Connect → Apps → +  → New App.** Platform iOS, name Lakad, bundle ID `app.lakad.tracker` (register it first under Certificates, Identifiers & Profiles → Identifiers if it isn't listed).
2. **App Store Connect → Users and Access → Integrations → App Store Connect API → +.** Role: App Manager. Download the `.p8` key file (only downloadable once) and note the Key ID and Issuer ID.
3. Find your **Team ID** at developer.apple.com → Account → Membership details.
4. Add these GitHub repository secrets: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` (paste the whole contents of the .p8 file), `APPLE_TEAM_ID`.
5. Push to `main`, or run **Actions → Build iPhone app → Run workflow**. After about 15 minutes the build appears in App Store Connect → TestFlight (Apple processes it for another 5–30 minutes).
6. On your iPhone, install the **TestFlight** app, add yourself as an internal tester in App Store Connect → TestFlight, and install Lakad from TestFlight.

Without the secrets, the workflow still runs and checks that the iPhone app compiles, which is useful for catching errors.

On first recording, allow **Location** (While Using the App), **Motion & Fitness** and **Precise Location**. Live Activities are on by default. Recording keeps going with the screen locked; iPhone shows a blue location indicator in the status bar so you can tap back into Lakad.

### Free option: sideload with a free Apple ID (no developer program)

Every run of **Actions → Build iPhone app** also produces an unsigned app file. You sign and install it yourself with a free Apple ID, using SideStore or AltStore (free, third-party, not made by Apple or Lakad).

1. Push to `main` (or run the workflow by hand). When it finishes, download **lakad-iphone-unsigned-ipa-N** from the run's Artifacts and unzip it to get `Lakad-unsigned.ipa`. Put it on your iPhone (AirDrop, iCloud Drive or Files).
2. Install **SideStore** (sidestore.io) or **AltStore** (altstore.io) by following their own setup guide. It needs a computer once (Windows or Mac) and your Apple ID.
3. On the iPhone, turn on **Settings → Privacy & Security → Developer Mode** and restart when asked.
4. In SideStore/AltStore, tap **+** and choose `Lakad-unsigned.ipa`.
5. Open Lakad, start a walk and allow Location, Motion & Fitness and notifications.

Limits of free Apple IDs:

- The app stops opening after **7 days** unless refreshed. SideStore can refresh from the phone over Wi-Fi; AltStore needs AltServer running on your computer on the same Wi-Fi. Your recorded walks are kept when you refresh.
- At most **3 sideloaded apps** at once, and a limited number of new app IDs per week (Lakad uses 2: the app and its lock-screen widget).
- GitHub's free plan includes Mac build minutes for private repositories at a reduced rate; public repositories build free. A Lakad build takes roughly 10–15 minutes.

Have a Mac? You can skip the developer program for personal testing: run `npx cap open ios`, choose your Apple ID as the team in Xcode, plug in your iPhone and press Run. Apps installed this way stop opening after 7 days and need re-installing.

## Lock-screen live stats

While recording in the **Android** or **iPhone** app, your distance, steps, pace and moving time stay visible on the lock screen. Turn it off in **Settings → Recording**.

- **iPhone (iOS 16.2+):** a Live Activity on the lock screen, and in the Dynamic Island on iPhone 14 Pro and newer. The timer ticks by itself; distance and steps update every 5 seconds. After you finish, the final result stays for 5 minutes. If it doesn't appear, check **iPhone Settings → Lakad → Live Activities**. Code: `ios/App/App/LiveActivityPlugin.swift` (starts and updates it) and `ios/App/LakadWidget/` (draws it).
- **Android:** a silent notification, updated every 5 seconds, that shows on the lock screen. It appears alongside the "Lakad is recording" notification, which Android requires for screen-off GPS. If the numbers are hidden on your lock screen, check **Settings → Notifications → Notifications on lock screen** and allow sensitive content. Code: `src/lib/liveStatus.ts`.
- **Website:** not possible. Browsers can't show anything on the lock screen.

## How accuracy works

### Distance (GPS)

- Fixes worse than 50 m accuracy are ignored (they still show your position on the map).
- Positions are smoothed with a Kalman filter that weighs each fix by its reported accuracy. Smoothing strength follows your actual speed, so jogging with "Walk" selected still measures correctly.
- Movement smaller than twice the filter's remaining uncertainty is treated as GPS wander, not distance.
- Jumps faster than 7 m/s walking or 12 m/s running are rejected, checked on raw fixes with real timestamps. If three fixes in a row agree on a new place, the earlier fix was the bad one and the route restarts there.
- On pause, auto-pause and finish, the last few metres that were still inside GPS uncertainty are added.
- After a manual pause the route starts a new segment, so the gap is never counted.

Measured in simulation (20-minute walks and runs with turns and stops, GPS error modelled as slowly drifting noise plus jitter):

| GPS accuracy | ±5 m | ±10 m | ±20 m | ±35 m | ±50 m |
|---|---|---|---|---|---|
| Previous version, walking | +3% | +13% | +35% | +71% | +112% |
| Now, walking | −0.5% | −1% | −2% | −2.5 to −3% | about −8% |
| Now, running | −0.6% | −0.8% | −1.5% | −2% | about −6% |

Short activities (2 minutes) read a few percent lower because the filter needs time to settle. Rough GPS undercounts on sharp corners. When GPS was weak, the Finish screen offers the step-based distance instead.

### Steps

Lakad uses the best source available, shown as a pill while recording:

1. **Phone pedometer** (Android app): the phone's hardware step counter, the same sensor Google Fit uses. Keeps counting with the screen off. Needs the "Physical activity" permission, asked on the first recording.
2. **Step sensor** (browsers, including iPhone): accelerometer peaks are counted only after 6 steps arrive with a steady rhythm, which filters out taps and phone handling. Used only if it agrees with GPS distance.
3. **Estimated**: GPS distance ÷ your step length.

Step detector on a deliberately messy simulated signal (timing jitter, uneven impacts, sensor noise):

| | Now | Previous |
|---|---|---|
| Phone in pocket | −1% | −6% |
| Phone in hand | −6% | −61% |
| Slow walk (80 steps/min) | −3% | −25% |
| Running | under 1% | −3 to −4% |
| Shaking the phone 30 s | ~50 false steps | ~45 false steps |

Shaking still counts as steps (true of most pedometers). Outdoors, auto-pause stops counting when GPS shows you aren't moving.

### Step length

Starts as an estimate from your height (0.414 × height walking, 0.65 × height running). Each walk or run of at least 400 m with good GPS and counted steps teaches Lakad your real step length (average of up to the last 5). It's shown in **Settings → Step length**, where you can also set it by hand or reset it. Indoor and treadmill distance uses this value.

### Other figures

- **Daily steps:** websites can't read Google Fit, Health Connect or Apple Health, so you can enter the day's total from your phone or watch. Lakad uses whichever is higher: that number or the steps from recorded activities.
- **Calories:** ACSM metabolic equations using your weight, speed and uphill grade.
- **Elevation:** GPS altitude, smoothed, counting only climbs of 3 m or more.

### Limits you should know

- iPhone in Safari or as a home-screen app can't use the iPhone's hardware step counter and stops GPS and steps when the screen locks (an Apple rule for websites). When you unlock, Lakad checks whether you moved: if so the gap becomes a straight line and its steps are estimated; if not, the locked time doesn't count as moving time. Curvy routes walked while locked will read short. Use the iPhone app for screen-off tracking.
- Simulated signals are cleaner than real life, so expect real-world error to be somewhat higher than the tables. The best check is a route of known length, such as 1 lap of a 400 m track.

Re-run the simulations any time with `npm run test:accuracy` (needs Node 22). "A" in the output is the previous algorithm; "K q2 k2" (walking) and "K q4 k2" (running) are the settings Lakad uses.

## Privacy

Activities, daily steps and settings are private to each account (enforced by row-level security in `schema.sql`). Feed posts contain only distance, time, steps, a note, and a normalised route shape with no coordinates, so nobody can see where you walked. Map tiles come from OpenStreetMap.
