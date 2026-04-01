import { create } from 'zustand';
import { User } from 'firebase/auth';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UserSettings {
  darkMode: boolean;
  notificationsEnabled: boolean;
  currency: string;
  defaultSplitType: string;
  lastRoastDate?: number;
  lastRoastMessage?: string;
}

interface UserState {
  user: (User & { vpa?: string }) | null;
  loading: boolean;
  settings: UserSettings;
  updateUserField: (field: string, value: any) => void;
  setUser: (user: any | null) => void;
  setLoading: (loading: boolean) => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      loading: true,
      settings: {
        darkMode: false,
        notificationsEnabled: true,
        currency: '₹',
        defaultSplitType: 'Equal',
      },

      updateUserField: (field, value) => set((state) => ({
        user: state.user ? { ...state.user, [field]: value } : null
      })),
      setUser: (user) => set({ user }),
      setLoading: (loading) => set({ loading }),
      updateSettings: (newSettings) => set((state) => ({ 
        settings: { ...state.settings, ...newSettings } 
      })),
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ settings: state.settings }), // only persist settings
    }
  )
);
