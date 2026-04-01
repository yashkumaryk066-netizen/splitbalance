# SettleStack - Advanced Expense Sharing App

SettleStack is a premium, high-performance mobile application for tracking shared expenses, managing group debts, and simplifying financial transparency between friends, roommates, and travel groups.

## 🚀 Key Features
- **Smart Auth:** Secure email/password authentication via Firebase.
- **Group Management:** Effortlessly create groups and manage members.
- **Advanced Splitting:** Add expenses with automatic equal splitting (ready for extension to exact/percentage).
- **Premium Dashboard:** Real-time balance summaries (You are owed vs You owe) with activity tracking.
- **Modern UI/UX:**
  - Glassmorphism effects and subtle gradients.
  - Native performance with React Native Reanimated.
  - Full Dark/Light mode support.
  - Vector icons via Lucide React Native.
- **Offline Ready:** Built-in persistence via Firestore local caching.

## 🛠 Tech Stack
- **Framework:** Expo (React Native)
- **Navigation:** Expo Router (File-based routing)
- **Database/Auth:** Firebase (Firestore, Auth)
- **State:** Zustand
- **Animations:** React Native Reanimated
- **Icons:** Lucide React Native

## 📋 Setup Instructions

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Firebase:**
   - Create a project on [Firebase Console](https://console.firebase.google.com/).
   - Enable **Authentication** (Email/Password) and **Firestore Database**.
   - Copy your Firebase config and paste it into `src/services/firebaseConfig.ts`.

3. **Run Locally:**
   - For Android/iOS (requires physical device or emulator):
     ```bash
     npx expo start
     ```
   - For Web:
     ```bash
     npx expo start --web
     ```

## 🏗 Project Structure
- `app/`: Routing and screens (Tabs, Auth, Modals).
- `src/services/`: Firestore and Auth logic.
- `src/store/`: Zustand state management.
- `src/hooks/`: Custom hooks (Auth, Logic).
- `constants/`: Theme, Colors, and Global Constants.
- `components/`: Reusable UI components.

---
*Created with ❤️ by Antigravity AI*
