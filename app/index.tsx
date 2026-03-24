import { Redirect } from 'expo-router';
import { useUserStore } from '@/src/store/useUserStore';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { user, loading } = useUserStore();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(tabs)" />;
}

