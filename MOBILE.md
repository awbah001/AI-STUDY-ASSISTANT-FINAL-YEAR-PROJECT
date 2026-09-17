# Cognify native shells (Capacitor)

**Students use the Expo app** in [`mobile/`](./mobile/README.md).

Capacitor in this repo wraps the **staff React web client** (`client/` → `dist/public`). A student who logs into that APK/IPA is sent to `/student-blocked`. Use these projects only if you want a native wrapper for lecturers/admins.

## Staff Capacitor (optional)

Prerequisites: Node.js 18+, pnpm, Android Studio and/or Xcode.

```bash
pnpm install
pnpm cap:sync
pnpm mobile:android   # or pnpm mobile:ios
```

The UI talks to the API on your machine. Default API bases:

| Platform | Default |
|----------|---------|
| Android emulator | `http://10.0.2.2:3000` |
| iOS simulator | `http://localhost:3000` |
| Physical device | PC LAN IP, e.g. `http://192.168.1.10:3000` via `VITE_API_URL` then `pnpm cap:sync` |

Start the backend with `pnpm dev` first.

## Student app (canonical)

```bash
cd mobile
# see mobile/README.md — EXPO_PUBLIC_API_URL, then:
npx expo start
```
