import React, { useState, useEffect, createContext, useContext } from 'react';
import { StyleSheet, View as RNView, Text as RNText, Animated, Dimensions, Platform } from 'react-native';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react-native';

const { width } = Dimensions.get('window');

type NotificationType = 'success' | 'error' | 'info';

interface NotificationContextType {
  showNotification: (message: string, type?: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification must be used within a NotificationProvider');
  return context;
};

import { useUserStore } from '@/src/store/useUserStore';

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [message, setMessage] = useState('');
  const [type, setType] = useState<NotificationType>('info');
  const [visible, setVisible] = useState(false);
  const [translateY] = useState(new Animated.Value(-100));

  const showNotification = (msg: string, t: NotificationType = 'info') => {
    // Access latest settings from store
    const { settings } = useUserStore.getState();
    
    // If notifications are OFF, don't show the toast
    if (!settings.notificationsEnabled) {
      console.log('Notification suppressed (settings: OFF):', msg);
      return;
    }

    setMessage(msg);
    setType(t);

    setVisible(true);
    Animated.spring(translateY, {
      toValue: 60,
      useNativeDriver: true,
      tension: 40,
      friction: 8,
    }).start();

    setTimeout(() => {
      hideNotification();
    }, 4000);
  };

  const hideNotification = () => {
    Animated.timing(translateY, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  };

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      {visible && (
        <Animated.View style={[
          styles.container, 
          { 
            transform: [{ translateY }],
            backgroundColor: type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#6366f1'
          }
        ]}>
          <RNView style={styles.content}>
            {type === 'success' && <CheckCircle color="#fff" size={20} />}
            {type === 'error' && <AlertCircle color="#fff" size={20} />}
            {type === 'info' && <Info color="#fff" size={20} />}
            <RNText style={styles.text}>{message}</RNText>
          </RNView>
        </Animated.View>
      )}
    </NotificationContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 16,
    zIndex: 9999,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
      web: {
        maxWidth: 400,
        alignSelf: 'center',
        left: undefined,
        right: undefined,
        width: '90%',
      }
    }),
  },

  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  text: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
});
