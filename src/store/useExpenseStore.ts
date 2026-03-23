import { create } from 'zustand';

interface Balance {
  total: number;
  owed: number; // You are owed
  owe: number;  // You owe
}

interface Activity {
  id: string;
  type: 'expense' | 'settlement';
  description: string;
  amount: number;
  date: Date;
  paidBy: string;
}

interface ExpenseState {
  balance: Balance;
  activities: Activity[];
  setBalance: (balance: Balance) => void;
  setActivities: (activities: Activity[]) => void;
  addActivity: (activity: Activity) => void;
}

export const useExpenseStore = create<ExpenseState>((set) => ({
  balance: { total: 0, owed: 0, owe: 0 },
  activities: [],
  setBalance: (balance) => set({ balance }),
  setActivities: (activities) => set({ activities }),
  addActivity: (activity) => set((state) => ({ activities: [activity, ...state.activities] })),
}));
