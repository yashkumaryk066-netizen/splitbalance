import React, { useState } from 'react';
import { StyleSheet, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, View as RNView, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { auth } from '@/src/services/firebaseConfig';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useUserStore } from '@/src/store/useUserStore';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { LogIn, UserPlus, Mail, Lock, DownloadCloud } from 'lucide-react-native';
import { findUserByPhone } from '@/src/services/expenseService';
import { LATEST_APK_URL } from '@/constants/Version';
import { CustomButton } from '@/components/CustomButton';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const setUser = useUserStore((state) => state.setUser);

  const handleLogin = async () => {
    if (!email || !password) {
      alert('Email and password cannot be empty. Please fill them.');
      return;
    }
    setLoading(true);
    let targetEmail = email.trim().toLowerCase();
    
    try {
      // Check if input is a phone number (only digits/plus and >= 10 chars)
      const isPhone = /^[0-9+()-\s]+$/.test(targetEmail) && targetEmail.replace(/[^\d]/g, '').length >= 10;
      
      if (isPhone) {
        const cleanPhone = targetEmail.replace(/[^\d]/g, '').slice(-10);
        const userData = await findUserByPhone(cleanPhone) as any;
        if (userData && userData.email) {
          targetEmail = userData.email;
        } else {
          throw new Error('No account found with this phone number.');
        }
      }

      const userCredential = await signInWithEmailAndPassword(auth, targetEmail, password);
      // Manually set user in store immediately for faster UI sync
      setUser(userCredential.user);
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error(error);
      const msg = error.code === 'auth/user-not-found' ? 'No user found with this email/phone.' : error.message;
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (auth.currentUser) {
      router.replace('/(tabs)');
    }
  }, []);

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
          <LogIn color="#fff" size={32} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Welcome Back</Text>
        <Text style={[styles.subtitle, { color: colors.icon }]}>Securely log in to manage your shared expenses.</Text>
      </View>

      <View style={styles.form}>
        <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
          <Mail size={20} color={colors.icon} style={styles.inputIcon} />
          <TextInput
            placeholder="Email or Phone Number"
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

        <CustomButton 
          title="Sign In" 
          onPress={handleLogin} 
          loading={loading} 
          icon={<LogIn color="#fff" size={20} />} 
        />

        <Pressable 
          style={styles.linkButton} 
          onPress={() => router.push('/(auth)/register')}
        >
          <Text style={[styles.linkText, { color: colors.secondary }]}>
            New to SettleStack? <Text style={{ fontWeight: '700' }}>Create an account</Text>
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
