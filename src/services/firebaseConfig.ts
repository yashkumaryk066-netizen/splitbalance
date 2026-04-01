import { initializeApp } from 'firebase/app';
import { initializeAuth, getAuth } from 'firebase/auth';
// @ts-ignore
import { getReactNativePersistence } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';
// @ts-ignore - for react-native persistence
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyB3ASP-dHS0OryBlWdl3CaPvtEkB_i-ZXs",
  authDomain: "splitbalance-b552b.firebaseapp.com",
  projectId: "splitbalance-b552b",
  storageBucket: "splitbalance-b552b.firebasestorage.app",
  messagingSenderId: "40872959188",
  appId: "1:40872959188:web:0bb467c35685a44ac5ef41",
  measurementId: "G-ZCPR6WVZN3"
};

const app = initializeApp(firebaseConfig);

export const auth = Platform.OS === 'web' 
  ? getAuth(app) 
  : initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage)
    });

// Advanced: Initialize Firestore with persistent storage to keep it FAST and FREE (reduces reads)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: Platform.OS === 'web' ? persistentMultipleTabManager() : undefined
  })
});

export const storage = getStorage(app);

export default app;
