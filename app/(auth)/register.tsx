import React, { useState } from 'react';
import { StyleSheet, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { auth, db } from '@/src/services/firebaseConfig';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useUserStore } from '@/src/store/useUserStore';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { UserPlus, Mail, Lock, User, ArrowLeft, DownloadCloud, Smartphone } from 'lucide-react-native';
import { claimGhostUser } from '@/src/services/expenseService';
import { LATEST_APK_URL } from '@/constants/Version';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const setUser = useUserStore((state) => state.setUser);

  const handleRegister = async () => {
    if (!name || !email || !password) return;
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;
      
      await updateProfile(user, { displayName: name });
      
      // Claim any ghost records for this phone number
      const normalizedPhone = phone ? phone.replace(/[^\d+]/g, '') : '';
      if (normalizedPhone) await claimGhostUser(normalizedPhone, user.uid);

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        displayName: name,
        email: email,
        phoneNumber: normalizedPhone,
        createdAt: new Date(),
        totalBalance: 0,
      });

      setUser(user);
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error(error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <ArrowLeft size={24} color={colors.text} />
      </Pressable>

      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: colors.secondary }]}>
          <UserPlus color="#fff" size={32} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Join SettleStack</Text>
        <Text style={[styles.subtitle, { color: colors.icon }]}>Start sharing and splitting expenses transparently.</Text>
      </View>

      <View style={styles.form}>
        <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
          <User size={20} color={colors.icon} style={styles.inputIcon} />
          <TextInput
            placeholder="Full Name"
            placeholderTextColor={colors.icon}
            style={[styles.input, { color: colors.text }]}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            underlineColorAndroid="transparent"
            //@ts-ignore - web only
            outlineStyle="none"
          />
        </View>

        <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
          <Mail size={20} color={colors.icon} style={styles.inputIcon} />
          <TextInput
            placeholder="Email Address"
            placeholderTextColor={colors.icon}
            style={[styles.input, { color: colors.text }]}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            underlineColorAndroid="transparent"
            //@ts-ignore - web only
            outlineStyle="none"
          />
        </View>

        <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
          <Lock size={20} color={colors.icon} style={styles.inputIcon} />
          <TextInput
            placeholder="Password"
            placeholderTextColor={colors.icon}
            style={[styles.input, { color: colors.text }]}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            underlineColorAndroid="transparent"
            //@ts-ignore - web only
            outlineStyle="none"
          />
        </View>

        <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
          <Smartphone size={20} color={colors.icon} style={styles.inputIcon} />
          <TextInput
            placeholder="Phone Number"
            placeholderTextColor={colors.icon}
            style={[styles.input, { color: colors.text }]}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            underlineColorAndroid="transparent"
            //@ts-ignore - web only
            outlineStyle="none"
          />
        </View>

        <Pressable 
          style={({ pressed }) => [
            styles.button, 
            { 
              backgroundColor: pressed ? colors.primary + 'CC' : colors.primary,
              elevation: pressed ? 2 : 4,
            }
          ]} 
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.buttonText}>Sign Up</Text>
              <UserPlus color="#fff" size={20} />
            </>
          )}
        </Pressable>

        <Pressable 
          style={styles.linkButton} 
          onPress={() => router.back()}
        >
          <Text style={[styles.linkText, { color: colors.secondary }]}>
            Already a member? <Text style={{ fontWeight: '700' }}>Login here</Text>
          </Text>
        </Pressable>

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
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 32,
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 64,
    left: 24,
    zIndex: 10,
    backgroundColor: 'transparent',
    padding: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
    backgroundColor: 'transparent',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
      web: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      }
    }),
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  form: {
    backgroundColor: 'transparent',
    gap: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 60,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    height: '100%',
    paddingVertical: 10,
  },
  button: {
    flexDirection: 'row',
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 24,
    backgroundColor: 'transparent',
  },
  linkText: {
    fontSize: 15,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    marginTop: 32,
    borderWidth: 1,
    gap: 10,
  },
  downloadText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
