import { useNotification } from '@/components/Notification';
import { useUserStore } from '@/src/store/useUserStore';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Pressable } from 'react-native';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/src/services/firebaseConfig';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { ArrowRight, Users, CheckCircle2 } from 'lucide-react-native';

export default function JoinGroupScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useUserStore();
  const router = useRouter();
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<any>(null);
  const [joined, setJoined] = useState(false);
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  useEffect(() => {
    if (id) {
      fetchGroup();
    }
  }, [id]);

  const fetchGroup = async () => {
    try {
      const gDoc = await getDoc(doc(db, 'groups', id as string));
      if (gDoc.exists()) {
        setGroup(gDoc.data());
      } else {
        showNotification('Group not found', 'error');
        router.replace('/(tabs)/groups');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!user) {
      showNotification('Please login to join the group', 'info');
      router.push('/(auth)/login');
      return;
    }

    setLoading(true);
    try {
      const groupRef = doc(db, 'groups', id as string);
      await updateDoc(groupRef, {
        members: arrayUnion(user.uid)
      });
      setJoined(true);
      showNotification('Joined group successfully!', 'success');
      setTimeout(() => {
        router.replace({ pathname: '/group/[id]', params: { id: id as string } });
      }, 1500);
    } catch (err) {
      showNotification('Failed to join group', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !group) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'Join Group', headerShown: false }} />
      
      <View style={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
            {joined ? <CheckCircle2 size={48} color={colors.gain} /> : <Users size={48} color={colors.primary} />}
          </View>
          
          <Text style={[styles.inviteText, { color: colors.icon }]}>You've been invited to join</Text>
          <Text style={[styles.groupName, { color: colors.text }]}>{group?.name || 'Loading...'}</Text>
          
          <Text style={[styles.description, { color: colors.icon }]}>
            {joined 
              ? "Welcome! You are now a member of this group."
              : "Joining this group allows you to track shared expenses and settle debts with other members."}
          </Text>

          {!joined && (
             <Pressable 
              onPress={handleJoin} 
              disabled={loading}
              style={[styles.button, { backgroundColor: colors.primary }]}
            >
              {loading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Text style={styles.buttonText}>Join SettleStack Group</Text>
                  <ArrowRight size={20} color="#fff" />
                </>
              )}
            </Pressable>
          )}

          {joined && (
            <Pressable 
              onPress={() => router.replace({ pathname: '/group/[id]', params: { id: id as string } })}
              style={[styles.button, { backgroundColor: colors.gain }]}
            >
              <Text style={styles.buttonText}>Go to Group</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  card: {
    width: '100%',
    padding: 32,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  inviteText: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  groupName: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  button: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
