import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, View, ActivityIndicator } from 'react-native';
import 'react-native-reanimated';
import { useColorScheme } from '@/components/useColorScheme';
import { useUserStore } from '@/src/store/useUserStore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/src/services/firebaseConfig';
import { useExpenseStore } from '@/src/store/useExpenseStore';
import { subscribeToUserExpenses } from '@/src/services/expenseService';

import { NotificationProvider } from '@/components/Notification';

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) return null;

  return (
    <NotificationProvider>
      <RootLayoutNav />
    </NotificationProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { user, loading } = useUserStore();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      useUserStore.getState().setUser(u);
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colorScheme === 'dark' ? '#0F172A' : '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
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



