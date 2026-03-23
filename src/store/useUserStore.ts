import { create } from 'zustand';
import { User } from 'firebase/auth';

interface UserState {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
}));
