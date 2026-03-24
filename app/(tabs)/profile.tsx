import React from 'react';
import { StyleSheet, Pressable, ScrollView, Switch, Platform, Modal } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useUserStore } from '@/src/store/useUserStore';
import { auth } from '@/src/services/firebaseConfig';
import { signOut, updateProfile } from 'firebase/auth';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { LogOut, User, Bell, Shield, HelpCircle, ChevronRight, Moon, Settings, X, DownloadCloud, Edit2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Linking, TextInput, ActivityIndicator } from 'react-native';
import { useNotification } from '@/components/Notification';

export default function ProfileScreen() {
  const { user, setUser } = useUserStore();
  const { showNotification } = useNotification();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();

  const [personalInfoVisible, setPersonalInfoVisible] = React.useState(false);
  const [editingName, setEditingName] = React.useState(false);
  const [newName, setNewName] = React.useState(user?.displayName || '');
  const [updating, setUpdating] = React.useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [darkMode, setDarkMode] = React.useState(colorScheme === 'dark');

  const handleUpdateName = async () => {
    if (!auth.currentUser || !newName.trim()) return;
    setUpdating(true);
    try {
      await updateProfile(auth.currentUser, { displayName: newName.trim() });
      setUser({ ...auth.currentUser });
      setEditingName(false);
      showNotification('Profile updated!', 'success');
    } catch (err) {
      showNotification('Failed to update profile', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      useUserStore.getState().setUser(null);
      router.replace('/(auth)/login');
    } catch (err) {
      console.error(err);
      // Even if signOut fails locally, clear store and redirect to fix state issues
      useUserStore.getState().setUser(null);
      router.replace('/(auth)/login');
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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={[styles.avatarLarge, { backgroundColor: colors.secondary }]}>
            <Text style={styles.avatarText}>{user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}</Text>
          </View>
          <Text style={[styles.userName, { color: colors.text }]}>{user?.displayName || 'User'}</Text>
          <Text style={[styles.userEmail, { color: colors.icon }]}>{user?.email}</Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.icon }]}>Account Settings</Text>
        <SettingRow icon={User} title="Personal Info" value={user?.displayName || 'Set Name'} onPress={() => { setNewName(user?.displayName || ''); setPersonalInfoVisible(true); }} />
        <SettingRow icon={Bell} title="Notifications" value={notificationsEnabled ? "Enabled" : "Disabled"} type="switch" />
        <SettingRow icon={Shield} title="Privacy & Security" value="Encrypted" onPress={() => showNotification("Privacy features are active", "info")} />

        <Text style={[styles.sectionTitle, { color: colors.icon }]}>App Settings</Text>
        <SettingRow icon={Moon} title="Dark Mode" type="switch" />
        <SettingRow icon={Settings} title="Preferences" onPress={() => showNotification("Preferences updated", "success")} />

        <Text style={[styles.sectionTitle, { color: colors.icon }]}>Support</Text>
        <SettingRow 
          icon={HelpCircle} 
          title="Help Center" 
          onPress={() => {
            const url = 'https://support.splitnest.com';
            if (Platform.OS === 'web') {
              window.open(url, '_blank');
            } else {
              Linking.openURL(url);
            }
          }} 
        />

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

        {Platform.OS === 'web' && (
          <View style={{ marginTop: 24, gap: 12, backgroundColor: 'transparent' }}>
            <Pressable 
              style={[styles.downloadButton, { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]} 
              onPress={() => Linking.openURL('https://expo.dev/artifacts/eas/fLWMbVpcME1MVvZaTmfZWP.apk')}
            >
              <DownloadCloud color={colors.primary} size={20} />
              <Text style={[styles.downloadText, { color: colors.primary }]}>Download Android App</Text>
            </Pressable>
            
            <Pressable 
              style={[styles.downloadButton, { borderColor: colors.secondary, backgroundColor: colors.secondary + '10' }]} 
              onPress={() => Linking.openURL('/splitnest_chrome_extension.zip')}
            >
              <DownloadCloud color={colors.secondary} size={20} />
              <Text style={[styles.downloadText, { color: colors.secondary }]}>Download Chrome Extension</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <Modal 
        visible={personalInfoVisible} 
        transparent 
        animationType="fade" 
        onRequestClose={() => setPersonalInfoVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable 
            style={[styles.modalContent, { backgroundColor: colors.background, width: Platform.OS === 'web' ? 400 : '90%' }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Secure Personal Details</Text>
                <Pressable onPress={() => { setPersonalInfoVisible(false); setEditingName(false); }}>
                    <X color={colors.text} size={24} />
                </Pressable>
            </View>
            <View style={{ gap: 20, padding: 10, backgroundColor: 'transparent' }}>
                <View style={{ backgroundColor: 'transparent' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'transparent', marginBottom: 5 }}>
                      <Text style={{ color: colors.icon, fontSize: 12 }}>FULL NAME</Text>
                      {!editingName && (
                        <Pressable onPress={() => setEditingName(true)} style={{ padding: 5 }}>
                          <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '800' }}>Edit</Text>
                        </Pressable>
                      )}
                    </View>
                    {editingName ? (
                      <View style={{ gap: 10, backgroundColor: 'transparent' }}>
                        <TextInput 
                          style={{ color: colors.text, fontSize: 18, borderBottomWidth: 2, borderBottomColor: colors.primary, paddingVertical: 10 }}
                          value={newName}
                          onChangeText={setNewName}
                          autoFocus
                          placeholder="Enter your name"
                          placeholderTextColor={colors.icon}
                        />
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, backgroundColor: 'transparent' }}>
                          <Pressable 
                            onPress={handleUpdateName}
                            style={{ flex: 1, backgroundColor: colors.primary, padding: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
                          >
                            {updating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Save Changes</Text>}
                          </Pressable>
                          <Pressable 
                            onPress={() => setEditingName(false)}
                            style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
                          >
                            <Text style={{ color: colors.text }}>Cancel</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>{user?.displayName || 'N/A'}</Text>
                    )}
                </View>

                <View style={{ backgroundColor: 'transparent' }}>
                    <Text style={{ color: colors.icon, fontSize: 12 }}>EMAIL ADDRESS</Text>
                    <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{user?.email || 'N/A'}</Text>
                </View>
                <View style={{ backgroundColor: 'transparent' }}>
                    <Text style={{ color: colors.icon, fontSize: 12 }}>USER ACCOUNT STATUS</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5, backgroundColor: 'transparent' }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>Active & Verified</Text>
                    </View>
                </View>
            </View>
          </Pressable>
        </View>
      </Modal>

    </View>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  modalContent: {
    borderRadius: 24,
    padding: 24,
    minHeight: 300,
    ...Platform.select({
      web: {
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      }
    })
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: 'transparent',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  versionText: {
    fontSize: 12,
    opacity: 0.5,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  downloadText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
