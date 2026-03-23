import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/src/services/firebaseConfig';
import { useUserStore } from '@/src/store/useUserStore';

export const useAuth = () => {
  const setUser = useUserStore((state) => state.setUser);
  const setLoading = useUserStore((state) => state.setLoading);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);
};
