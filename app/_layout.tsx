import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';
import { useColorScheme } from '@/components/useColorScheme';
import { useUserStore } from '@/src/store/useUserStore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/src/services/firebaseConfig';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

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

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { user, loading } = useUserStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      useUserStore.getState().setUser(u);
      useUserStore.getState().setLoading(false);
    });
    return unsub;
  }, []);
  
  if (loading) return null; // Added this line to prevent immediate redirect before auth state is known

  const inAuthGroup = segments[0] === '(auth)';
  if (!user && !inAuthGroup) {
    router.replace('/(auth)/login');
  } else if (user && inAuthGroup) {
    router.replace('/(tabs)');
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
