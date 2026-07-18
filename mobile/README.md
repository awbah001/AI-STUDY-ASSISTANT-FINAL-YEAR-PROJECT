# Cognify Mobile — Student App

This is the **student-only** React Native (Expo) mobile app for Cognify.  
The web portal (`/client`) is for **lecturers and admins** only.

## Prerequisites

- Node.js 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/): `npm install -g expo-cli`
- For Android: Android Studio + emulator, or a physical Android device
- For iOS (Mac only): Xcode + iOS simulator

## Setup

```bash
cd mobile
npm install
```

## Configure the API URL

By default the app connects to `http://10.0.2.2:5000` (Android emulator default for localhost).

Create `mobile/.env` and set:

```env
# Android emulator
EXPO_PUBLIC_API_URL=http://10.0.2.2:5000

# iOS simulator
# EXPO_PUBLIC_API_URL=http://localhost:5000

# Physical device (same Wi-Fi) — use your PC's LAN IP
# EXPO_PUBLIC_API_URL=http://192.168.1.x:5000

# Production
# EXPO_PUBLIC_API_URL=https://your-api-domain.com
```

## Run

Start your backend server first:
```bash
# From the project root
pnpm dev
```

Then run the mobile app:
```bash
cd mobile

# Expo Go (quick preview)
npm start

# Android emulator
npm run android

# iOS simulator
npm run ios
```

## Project Structure

```
mobile/
├── app/
│   ├── _layout.tsx           # Root layout (providers)
│   ├── index.tsx             # Auth redirect entry point
│   ├── (auth)/
│   │   ├── login.tsx         # Student login screen
│   │   └── signup.tsx        # Student registration
│   ├── (tabs)/
│   │   ├── dashboard.tsx     # Home/dashboard
│   │   ├── courses.tsx       # Enrolled courses
│   │   ├── documents.tsx     # Document library
│   │   ├── flashcards.tsx    # Flashcard study
│   │   └── progress.tsx      # Progress analytics
│   ├── course/[id].tsx       # Course detail (materials + announcements)
│   ├── document/[id].tsx     # Document detail (AI chat, flashcards, quiz)
│   └── profile.tsx           # User profile
├── src/
│   ├── contexts/
│   │   └── AuthContext.tsx   # Auth state management
│   ├── lib/
│   │   └── api.ts            # tRPC client + token helpers
│   └── theme/
│       └── colors.ts         # Design tokens
└── assets/                   # App icons and splash screen
```

## Build for Production

Install EAS CLI: `npm install -g eas-cli`

```bash
eas build --platform android  # APK / AAB
eas build --platform ios      # IPA (Mac only)
```
