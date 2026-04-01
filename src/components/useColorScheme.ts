import { useUserStore } from '@/src/store/useUserStore';

export const useColorScheme = () => {
  const settings = useUserStore(state => state.settings);
  return settings.darkMode ? 'dark' : 'light';
};

