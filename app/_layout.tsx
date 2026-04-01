import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, View, ActivityIndicator, Alert, Linking } from 'react-native';
import 'react-native-reanimated';
import { useColorScheme } from '@/components/useColorScheme';
import { useUserStore } from '@/src/store/useUserStore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/src/services/firebaseConfig';
import { useExpenseStore } from '@/src/store/useExpenseStore';
import { subscribeToUserExpenses } from '@/src/services/expenseService';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { NotificationProvider } from '@/components/Notification';

import { useNotification } from '@/components/Notification';
import { db } from '@/src/services/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { APP_VERSION } from '@/constants/Version';

export default function RootLayout() {
    useEffect(() => {
        // Font loaded?
    }, []);
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    async function prepare() {
      if (loaded) {
        // Minimum delay for premium feel
        await new Promise(resolve => setTimeout(resolve, 1500));
        await SplashScreen.hideAsync();
      }
    }
    prepare();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <NotificationProvider>
      <RootLayoutNav />
    </NotificationProvider>
  );
}

function RootLayoutNav() {
  const systemScheme = useColorScheme();
  const { user, loading, settings, updateSettings } = useUserStore();
  const { showNotification } = useNotification();

  useEffect(() => {
    checkUpdates();
  }, []);

  const checkUpdates = async () => {
      try {
          const vDoc = await getDoc(doc(db, 'app_config', 'version'));
          if (vDoc.exists()) {
              const { latestVersion, downloadUrl, message, mandatory } = vDoc.data();
              
              // Only show if the version is DIFFERENT from current app version
              if (latestVersion !== APP_VERSION) {
                  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                  const lastIgnored = await AsyncStorage.getItem('last_ignored_version');
                  
                  // Don't show if user already saw this version and it's not mandatory
                  if (lastIgnored === latestVersion && !mandatory) return;

                  Alert.alert(
                      'Update Available 🚀',
                      message || `A new version (${latestVersion}) of SettleStack is available. Upgrade now for the latest features & optimizations!`,
                      [
                          { 
                            text: mandatory ? 'Update Required' : 'Later', 
                            style: 'cancel',
                            onPress: async () => {
                              if (!mandatory) {
                                await AsyncStorage.setItem('last_ignored_version', latestVersion);
                              }
                            }
                          },
                          { 
                            text: 'Upgrade Now', 
                            onPress: () => {
                                if (Platform.OS === 'web') {
                                    window.open(downloadUrl, '_blank');
                                } else {
                                    Linking.openURL(downloadUrl);
                                }
                            }
                          }
                      ],
                      { cancelable: !mandatory }
                  );
              }
          }
      } catch (err) {
          // Ignore silently
      }
  };

  useEffect(() => {
    // Only set initial dark mode if not already set or specifically toggled by user
    if (systemScheme && !settings.darkMode) {
       // We can decide to just default to system for first time or always let settings win
    }
  }, [systemScheme]);

  const isDarkMode = settings.darkMode;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        // Fetch custom profile data (VPA, photoURL) from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const mergedUser = { 
              ...u, 
              ...userData,
              vpa: userData.vpa || '',
              photoURL: userData.photoURL || u.photoURL 
            };
            useUserStore.getState().setUser(mergedUser);
          } else {
            useUserStore.getState().setUser(u);
          }
        } catch (err) {
          console.error("Layout: fetch user error", err);
          useUserStore.getState().setUser(u);
        }
      } else {
        useUserStore.getState().setUser(null);
      }
      useUserStore.getState().setLoading(false);
    });
    return unsub;
  }, []);


  useEffect(() => {
    if (user?.uid) {
      const unsub = subscribeToUserExpenses(user.uid, (data) => {
        useUserStore.getState().setLoading(false);
        useExpenseStore.getState().setActivities(data.expenses);
        useExpenseStore.getState().setBalance(data.balance);
      });
      return unsub;
    }
  }, [user]);

  // While checking auth state, show a clean loader
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <ThemeProvider value={isDarkMode ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        {!user ? (
          // Auth flow: only Login/Register are available
          <Stack.Screen name="(auth)" options={{ headerShown: false, animation: 'fade' }} />
        ) : (
          // Main flow: Dashboard and Modals are available
          <>
            <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          </>
        )}
      </Stack>
    </ThemeProvider>
  );
}




