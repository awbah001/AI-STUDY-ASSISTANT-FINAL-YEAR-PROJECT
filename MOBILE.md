# Cognify — Mobile (Android & iOS)

The mobile apps use **Capacitor** to wrap the same React web client. No business logic was rewritten.

## Prerequisites

- Node.js 18+ and pnpm
- **Android:** [Android Studio](https://developer.android.com/studio) with SDK
- **iOS (Mac only):** Xcode and CocoaPods (`sudo gem install cocoapods`)

## First-time setup

```bash
pnpm install
pnpm build:web
pnpm exec cap add android
pnpm exec cap add ios
pnpm cap:sync
```

If `android/` and `ios/` already exist, skip the `cap add` steps and only run `pnpm cap:sync`.

## Run the backend (required)

The app UI runs on the device; the **API still runs on your computer or a deployed server**.

```bash
pnpm dev
```

Default API URL inside the native shell:

| Platform | Default API base |
|----------|------------------|
| Android emulator | `http://10.0.2.2:3000` |
| iOS simulator | `http://localhost:3000` |
| Physical phone | Your PC’s LAN IP, e.g. `http://192.168.1.10:3000` |

### Physical device on the same Wi‑Fi

1. Find your PC IP (`ipconfig` on Windows).
2. Create `.env` (or `.env.local`) in the project root:

```env
VITE_API_URL=http://192.168.1.10:3000
```

3. Rebuild and sync:

```bash
pnpm cap:sync
```

4. Start the server bound to all interfaces (already configured): `pnpm dev`

## Open native projects

```bash
pnpm mobile:android   # Android Studio
pnpm mobile:ios       # Xcode (macOS only)
```

Then run from Android Studio / Xcode on an emulator or device.

## Production

1. Deploy the Node server (same `pnpm build` + `pnpm start`).
2. Set `VITE_API_URL` to your HTTPS API, e.g. `https://api.yourschool.com`.
3. Run `pnpm cap:sync` and build release APK/IPA from the IDE.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm build:web` | Build client to `dist/public` |
| `pnpm cap:sync` | Build web + copy into Android/iOS |
| `pnpm mobile:android` | Sync and open Android Studio |
| `pnpm mobile:ios` | Sync and open Xcode |
