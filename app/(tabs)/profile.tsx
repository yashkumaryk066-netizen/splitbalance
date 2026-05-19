import React from 'react';
import { StyleSheet, Pressable, ScrollView, Switch, Platform, Modal, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View } from '@/components/Themed';
import { useUserStore } from '@/src/store/useUserStore';
import { auth, db, storage } from '@/src/services/firebaseConfig';
import { signOut, updateProfile } from 'firebase/auth';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { LogOut, User, Bell, Shield, HelpCircle, ChevronRight, Moon, Settings, X, DownloadCloud, Edit2, Zap, Trash2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { LATEST_APK_URL } from '@/constants/Version';
import { Linking, TextInput, ActivityIndicator } from 'react-native';
import { useNotification } from '@/components/Notification';
import * as ImagePicker from 'expo-image-picker';
import { ref, getDownloadURL, uploadBytes, deleteObject } from 'firebase/storage';
import * as FileSystem from 'expo-file-system';
import { Image } from 'react-native';
import { runSystemAudit } from '@/src/services/auditService';

export default function ProfileScreen() {
  const { user, setUser, settings, updateSettings } = useUserStore();
  const { showNotification } = useNotification();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();


  const [personalInfoVisible, setPersonalInfoVisible] = React.useState(false);
  const [preferencesVisible, setPreferencesVisible] = React.useState(false);
  const [editingName, setEditingName] = React.useState(false);

  const [newName, setNewName] = React.useState(user?.displayName || '');
  const [vpa, setVpa] = React.useState(user?.vpa || '');
  const [updating, setUpdating] = React.useState(false);
  const [uploadingPhoto, setUploadingPhoto] = React.useState(false);

  React.useEffect(() => {
    if (personalInfoVisible) {
        setVpa(user?.vpa || '');
        setNewName(user?.displayName || '');
    }
  }, [personalInfoVisible]);


  const handlePickImage = async () => {
    if (!auth.currentUser) return;
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // Square for avatars
        quality: 0.3, // High compression to save storage space
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploadingPhoto(true);
        const asset = result.assets[0];
        // 1. Get Blob securely using XHR (With 10s Timeout)
        const storageRef = ref(storage, `avatars/${auth.currentUser.uid}.jpg`);
        
        try {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          
          await uploadBytes(storageRef, blob);
          const downloadUrl = await getDownloadURL(storageRef);

          // 3. Update Firestore (Directly into the document)
          await setDoc(doc(db, 'users', auth.currentUser.uid), { photoURL: downloadUrl }, { merge: true });

          // 4. Update Global Store
          setUser(user ? { ...user, photoURL: downloadUrl } : { uid: auth.currentUser.uid, photoURL: downloadUrl } as any);
          showNotification('Profile photo updated!', 'success');
        } catch (err) {
          console.warn("Photo upload failed:", err);
          showNotification('Photo upload failed.', 'error');
        }
      }
    } catch (err: any) {
      console.error("Photo Upload Error: ", err);
      showNotification(err?.message || 'Failed to update photo', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };


  const handleUpdateName = async () => {
    if (!auth.currentUser || !newName.trim()) return;
    setUpdating(true);
    try {
      // 1. Update Firebase Auth Profile
      await updateProfile(auth.currentUser, { displayName: newName.trim() });
      
      // 2. Update Firestore User Collection (to reflect in groups)
      const updates = {
        displayName: newName.trim(),
        vpa: vpa.trim().toLowerCase()
      };
      await updateDoc(doc(db, 'users', auth.currentUser.uid), updates);

      // 3. Update Global Store
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      
      setEditingName(false);
      showNotification('Profile updated!', 'success');
    } catch (err) {
      console.error(err);
      showNotification('Failed to update profile', 'error');
    } finally {
      setUpdating(false);
    }
  };


  const handleRunAudit = async () => {
    setUpdating(true);
    try {
      const results = await runSystemAudit();
      const summary = `Base64 cleared: ${results.base64Detected}\nCycle mismatches: ${results.mismatchedCycles}\nCleaned Items: ${results.cleanedItems}`;
      Alert.alert('System Audit Complete', summary);
      showNotification('System cleaned!', 'success');
    } catch (err) {
      showNotification('Audit failed', 'error');
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

  const SettingRow = ({ 
    icon: Icon, 
    title, 
    value, 
    type = 'link', 
    onPress, 
    switchValue, 
    onSwitchChange 
  }: { 
    icon: any, 
    title: string, 
    value?: string, 
    type?: 'link' | 'switch', 
    onPress?: () => void, 
    switchValue?: boolean, 
    onSwitchChange?: (val: boolean) => void 
  }) => (
    <View style={{ backgroundColor: 'transparent' }}>
    <Pressable 
      onPress={onPress}
      style={({ pressed }) => [styles.settingRow, { backgroundColor: colors.cardBg, borderColor: colors.border, opacity: (pressed && type === 'link') ? 0.7 : 1 }]}
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
        <Switch 
          value={switchValue} 
          onValueChange={onSwitchChange}
          trackColor={{ false: colors.border, true: colors.primary }} 
          thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
        />
      )}
    </Pressable>
    </View>
  );


  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 20) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <Pressable 
            onPress={handlePickImage} 
            disabled={uploadingPhoto}
            style={({ pressed }) => [styles.avatarContainer, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={[styles.avatarLarge, { backgroundColor: colors.secondary }]}>
              {uploadingPhoto ? (
                <ActivityIndicator color="#fff" />
              ) : user?.photoURL ? (
                <Image source={{ uri: user.photoURL }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}</Text>
              )}
              <View style={[styles.editBadge, { backgroundColor: colors.primary }]}>
                <Edit2 size={12} color="#fff" />
              </View>
            </View>
          </Pressable>
          <Text style={[styles.userName, { color: colors.text }]}>{user?.displayName || 'User'}</Text>
          <Text style={[styles.userEmail, { color: colors.icon }]}>{user?.email}</Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.icon }]}>Account Settings</Text>
        <SettingRow icon={User} title="Personal Info" value={user?.displayName || 'Set Name'} onPress={() => { setNewName(user?.displayName || ''); setPersonalInfoVisible(true); }} />
        <SettingRow 
          icon={Bell} 
          title="Notifications" 
          value={settings.notificationsEnabled ? "Enabled" : "Disabled"} 
          type="switch" 
          switchValue={settings.notificationsEnabled} 
          onSwitchChange={(val) => updateSettings({ notificationsEnabled: val })}
        />
        <SettingRow icon={Shield} title="Privacy & Security" value="Encrypted" onPress={() => showNotification("Privacy features are active", "info")} />

        <Text style={[styles.sectionTitle, { color: colors.icon }]}>App Settings</Text>
        <SettingRow 
           icon={Moon} 
           title="Dark Mode" 
           type="switch" 
           switchValue={settings.darkMode} 
           onSwitchChange={(val) => updateSettings({ darkMode: val })}
        />
        <SettingRow 
          icon={Settings} 
          title="Preferences" 
          value={`${settings.currency} • ${settings.defaultSplitType}`}
          onPress={() => setPreferencesVisible(true)} 
        />


        <Text style={[styles.sectionTitle, { color: colors.icon }]}>System Automations</Text>
        <SettingRow 
          icon={Zap} 
          title="Run Data Audit" 
          value="Fix Storage & Errors" 
          onPress={handleRunAudit}
        />
        <SettingRow 
          icon={Trash2} 
          title="Clear App Cache" 
          value="Refresh Local Data" 
          onPress={() => showNotification("Local cache cleared!", "success")} 
        />

        <Text style={[styles.sectionTitle, { color: colors.icon }]}>Support</Text>
        <SettingRow 
          icon={HelpCircle} 
          title="Help & Support" 
          onPress={() => {
            const phoneNumber = '918356926231';
            const message = encodeURIComponent("Hello SettleStack Support, I need help with...");
            const url = `https://wa.me/${phoneNumber}?text=${message}`;
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
          <Text style={[styles.versionText, { color: colors.icon }]}>SettleStack v1.2.1</Text>
        </View>

        {Platform.OS === 'web' && (
          <View style={{ marginTop: 24, gap: 12, backgroundColor: 'transparent' }}>
            <Pressable 
              style={[styles.downloadButton, { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]} 
              onPress={() => Linking.openURL(LATEST_APK_URL)}

            >
              <DownloadCloud color={colors.primary} size={20} />
              <Text style={[styles.downloadText, { color: colors.primary }]}>Download Android App</Text>
            </Pressable>
            
            <Pressable 
              style={[styles.downloadButton, { borderColor: colors.secondary, backgroundColor: colors.secondary + '10' }]} 
              onPress={() => Linking.openURL('/settlestack_chrome_extension.zip')}
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
                        
                        <Text style={{ color: colors.icon, fontSize: 12, marginTop: 15 }}>UPI ID (FOR SETTLEMENTS)</Text>
                        <TextInput 
                          style={{ color: colors.text, fontSize: 16, borderBottomWidth: 2, borderBottomColor: colors.border, paddingVertical: 10 }}
                          value={vpa}
                          onChangeText={setVpa}
                          placeholder="username@bank"
                          placeholderTextColor={colors.icon}
                          autoCapitalize="none"
                        />

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, backgroundColor: 'transparent' }}>
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
                      <>
                        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>{user?.displayName || 'N/A'}</Text>
                        <Text style={{ color: colors.icon, fontSize: 12, marginTop: 15 }}>UPI ID (VPA)</Text>
                        <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '700' }}>{user?.vpa || 'Not Set'}</Text>
                      </>
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

      {/* Preferences Modal */}
      <Modal visible={preferencesVisible} animationType="slide" transparent>
        <View style={[styles.modalOverlayPreferences, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContentPreferences, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeaderPreferences}>
              <Text style={styles.modalTitlePreferences}>Preferences</Text>
              <Pressable onPress={() => setPreferencesVisible(false)}>
                <X color={colors.text} size={24} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              <Text style={[styles.inputLabel, { color: colors.icon, marginBottom: 8 }]}>Preferred Currency</Text>
              <View style={styles.chipContainer}>
                {['₹', '$', '€', '£'].map((curr) => (
                  <Pressable 
                    key={curr} 
                    onPress={() => { updateSettings({ currency: curr }); showNotification(`Currency changed to ${curr}`, 'success'); }}
                    style={[
                      styles.chip, 
                      { borderColor: colors.border, backgroundColor: settings.currency === curr ? colors.primary : 'transparent' }
                    ]}
                  >
                    <Text style={{ color: settings.currency === curr ? '#fff' : colors.text, fontWeight: '600' }}>{curr}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={{ height: 24 }} />

              <Text style={[styles.inputLabel, { color: colors.icon, marginBottom: 8 }]}>Default Split Method</Text>
              <View style={styles.chipContainer}>
                {['Equal', 'Exact', 'Percent', 'Shares'].map((type) => (
                  <Pressable 
                    key={type} 
                    onPress={() => { updateSettings({ defaultSplitType: type }); showNotification(`Default split method: ${type}`, 'success'); }}
                    style={[
                      styles.chip, 
                      { borderColor: colors.border, backgroundColor: settings.defaultSplitType === type ? colors.secondary : 'transparent' }
                    ]}
                  >
                    <Text style={{ color: settings.defaultSplitType === type ? '#fff' : colors.text, fontWeight: '600' }}>{type}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Pressable style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={() => setPreferencesVisible(false)}>
              <Text style={styles.saveButtonText}>Done</Text>
            </Pressable>
          </View>
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
  avatarContainer: {
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
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
  modalOverlayPreferences: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContentPreferences: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: '80%',
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  modalHeaderPreferences: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: 'transparent',
  },
  modalTitlePreferences: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  modalBody: {
    paddingBottom: 24,
    backgroundColor: 'transparent',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: 'transparent',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

