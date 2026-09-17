# Cognify Mobile — Student App

React Native (Expo SDK 54) student-only app for Cognify.  
The web portal (`/client`) is for **lecturers and admins** only.

---

## Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Android: Android Studio + emulator, or a physical Android device
- iOS (Mac only): Xcode + iOS simulator

---

## Setup

```bash
cd mobile
npm install
```

---

## Configure the API URL

Create `mobile/.env`:

```env
# Android emulator (default — maps to host machine localhost)
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000

# Same Web OAuth client ID as VITE_GOOGLE_CLIENT_ID / GOOGLE_CLIENT_ID in the root .env
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=

# Optional native clients for standalone builds
# EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
# EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
```

# Physical device on same Wi-Fi — use your PC's LAN IP (run ipconfig)
# EXPO_PUBLIC_API_URL=http://192.168.x.x:3000

# iOS simulator
# EXPO_PUBLIC_API_URL=http://localhost:3000
```

> **Firewall note:** On Windows, allow inbound TCP port 3000 in Windows Defender Firewall so physical devices can reach the dev server.

---

## Run

Start the backend first (from the project root):

```bash
pnpm dev
```

Then start the mobile app:

```bash
cd mobile
npm start          # Expo Go (quick preview — scan QR code)
npm run android    # Android emulator
npm run ios        # iOS simulator (Mac only)
```

---

## Project Structure

```
mobile/
├── app/
│   ├── _layout.tsx               # Root layout — providers, push notification setup
│   ├── index.tsx                 # Auth redirect entry point
│   ├── flashcard-study.tsx       # SM-2 spaced-repetition study session
│   ├── upload-document.tsx       # Student document upload screen
│   ├── profile.tsx               # Profile (standalone, pushed from dashboard)
│   ├── (auth)/
│   │   ├── login.tsx             # Student login
│   │   └── signup.tsx            # Student registration
│   ├── (tabs)/                   # Bottom tab navigator (5 tabs)
│   │   ├── _layout.tsx           # Tab bar config — center Ask AI FAB
│   │   ├── dashboard.tsx         # Home: daily goal, stats, continue learning
│   │   ├── courses.tsx           # Enrolled courses + enroll by code
│   │   ├── askai.tsx             # General AI chat (Ask AI center tab)
│   │   ├── library.tsx           # Document library + upload FAB
│   │   ├── profile.tsx           # Settings, notifications toggle, sign out
│   │   ├── flashcards.tsx        # Flashcard overview — SM-2 due counts
│   │   ├── progress.tsx          # Progress: streak, real daily chart, topics
│   │   ├── quizzes.tsx           # Quiz list (hidden from tab bar, URL-accessible)
│   │   └── documents.tsx         # Redirect → library (legacy route)
│   ├── course/[id].tsx           # Course detail: materials, quizzes, announcements
│   └── document/[id].tsx         # Document detail: AI chat, flashcards, quiz tabs
├── src/
│   ├── contexts/
│   │   └── AuthContext.tsx       # Auth state, token (SecureStore), push registration
│   ├── lib/
│   │   ├── api.ts                # tRPC client, API_URL, token helpers
│   │   └── notifications.ts      # Push notification helpers (expo-notifications)
│   └── theme/
│       └── colors.ts             # Light theme design tokens
└── assets/                       # App icon, splash screen, logo
```

---

## Key Features

| Feature | Where |
|---|---|
| SM-2 spaced repetition | `flashcards.tsx` + `flashcard-study.tsx` |
| Student document upload | `upload-document.tsx` |
| AI chat per-document | `document/[id].tsx` → Chat tab |
| General Ask AI | `askai.tsx` (no document context needed) |
| Flashcard generation | `document/[id].tsx` → Flashcards tab |
| Quiz generation + submission | `document/[id].tsx` → Quiz tab |
| Real study-time chart | `progress.tsx` (daily data from `studySessions` table) |
| Push notifications | Announcements from lecturers trigger Expo push |
| Course enrollment | `courses.tsx` (6-char code) |

---

## Build for Production

Install EAS CLI: `npm install -g eas-cli`

```bash
eas build --platform android   # APK / AAB
eas build --platform ios        # IPA (Mac only)
```
