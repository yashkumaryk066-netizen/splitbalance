import React from 'react';
import { StyleSheet, Pressable, ScrollView, Switch, Platform } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useUserStore } from '@/src/store/useUserStore';
import { auth } from '@/src/services/firebaseConfig';
import { signOut } from 'firebase/auth';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { LogOut, User, Bell, Shield, HelpCircle, ChevronRight, Moon, Settings } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const { user, setUser } = useUserStore();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      router.replace('/(auth)/login');
    } catch (err) {
      console.error(err);
    }
  };

  const SettingRow = ({ icon: Icon, title, value, type = 'link', onPress }: { icon: any, title: string, value?: string, type?: 'link' | 'switch', onPress?: () => void }) => (
    <Pressable 
      onPress={onPress}
      style={({ pressed }) => [styles.settingRow, { backgroundColor: colors.cardBg, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={[styles.settingIcon, { backgroundColor: colors.primary + '10' }]}>
        <Icon size={20} color={colors.primary} />
      </View>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        {value && <Text style={[styles.settingValue, { color: colors.icon }]}>{value}</Text>}
      </View>
      {type === 'link' ? (
        <ChevronRight size={20} color={colors.icon} />
      ) : (
        <Switch value={true} trackColor={{ false: colors.border, true: colors.primary }} />
      )}
    </Pressable>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={[styles.avatarLarge, { backgroundColor: colors.secondary }]}>
          <Text style={styles.avatarText}>{user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}</Text>
        </View>
        <Text style={styles.userName}>{user?.displayName || 'User'}</Text>
        <Text style={[styles.userEmail, { color: colors.icon }]}>{user?.email}</Text>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.icon }]}>Account Settings</Text>
      <SettingRow icon={User} title="Personal Info" value={user?.displayName || 'Set Name'} onPress={() => router.push('/(tabs)/profile')} />
      <SettingRow icon={Bell} title="Notifications" value="Enabled" type="switch" />
      <SettingRow icon={Shield} title="Privacy & Security" value="Encrypted" onPress={() => router.push('/(tabs)/profile')} />

      <Text style={[styles.sectionTitle, { color: colors.icon }]}>App Settings</Text>
      <SettingRow icon={Moon} title="Dark Mode" type="switch" />
      <SettingRow icon={Settings} title="Preferences" onPress={() => router.push('/(tabs)/profile')} />

      <Text style={[styles.sectionTitle, { color: colors.icon }]}>Support</Text>
      <SettingRow icon={HelpCircle} title="Help Center" onPress={() => router.push('/(tabs)/profile')} />

      <Pressable 
        style={({ pressed }) => [styles.logoutButton, { backgroundColor: pressed ? colors.debt + '15' : colors.cardBg, borderColor: colors.debt + '50' }]} 
        onPress={handleLogout}
      >
        <LogOut size={20} color={colors.debt} />
        <Text style={[styles.logoutText, { color: colors.debt }]}>Log Out</Text>
      </Pressable>

      <View style={styles.versionContainer}>
        <Text style={[styles.versionText, { color: colors.icon }]}>SplitNest v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 32,
    backgroundColor: 'transparent',
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
      }
    }),
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '800',
    color: '#fff',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 24,
    letterSpacing: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  settingValue: {
    fontSize: 14,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 32,
    gap: 12,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: 40,
    backgroundColor: 'transparent',
  },
  versionText: {
    fontSize: 12,
    opacity: 0.5,
  },
});
