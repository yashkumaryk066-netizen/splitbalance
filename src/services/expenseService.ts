import { collection, query, where, getDocs, addDoc, Timestamp, doc, updateDoc, arrayUnion, setDoc, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from './firebaseConfig';

export interface Group {
  id: string;
  name: string;
  members: string[];
}

export const getGroups = async (userId: string) => {
  const q = query(collection(db, 'groups'), where('members', 'array-contains', userId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
};

export const createGroup = async (name: string, members: string[]) => {
  const docRef = await addDoc(collection(db, 'groups'), {
    name,
    members,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};

export const addExpense = async (expenseData: any) => {
  const docRef = await addDoc(collection(db, 'expenses'), {
    ...expenseData,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};
export const addMemberToGroup = async (groupId: string, userId: string) => {
  const groupRef = doc(db, 'groups', groupId);
  await updateDoc(groupRef, {
    members: arrayUnion(userId)
  });
};

export const findUserByEmail = async (email: string) => {
  const q = query(collection(db, 'users'), where('email', '==', email.toLowerCase()));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return null;
  return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
};

export const findUserByPhone = async (phone: string) => {
  const q = query(collection(db, 'users'), where('phoneNumber', '==', phone));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return null;
  return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
};

export const createGhostUser = async (name: string, phone: string) => {
  const ghostRef = doc(collection(db, 'users'));
  const ghostData = {
    uid: ghostRef.id,
    displayName: name,
    phoneNumber: phone,
    isGhost: true,
    createdAt: Timestamp.now(),
  };
  await setDoc(ghostRef, ghostData);
  return { id: ghostRef.id, ...ghostData };
};

export const claimGhostUser = async (phone: string, newUid: string) => {
  const normalizedSearch = phone.replace(/[^\d+]/g, '');
  const q = query(collection(db, 'users'), where('phoneNumber', '==', normalizedSearch), where('isGhost', '==', true));
  const qSnap = await getDocs(q);
  
  if (!qSnap.empty) {
    const ghostId = qSnap.docs[0].id;
    // Find all groups where the ghost was a member
    const groupsQ = query(collection(db, 'groups'), where('members', 'array-contains', ghostId));
    const groupsSnap = await getDocs(groupsQ);
    
    for (const groupDoc of groupsSnap.docs) {
      const gData = groupDoc.data();
      const newMembers = gData.members.map((m: string) => m === ghostId ? newUid : m);
      await updateDoc(doc(db, 'groups', groupDoc.id), { members: newMembers });
    }
    
    // Similarly update expenses where the ghost paid
    const expQ = query(collection(db, 'expenses'), where('paidBy', '==', ghostId));
    const expSnap = await getDocs(expQ);
    for (const expDoc of expSnap.docs) {
      await updateDoc(doc(db, 'expenses', expDoc.id), { paidBy: newUid });
    }
  }
};

export const subscribeToUserExpenses = (userId: string, onUpdate: (data: { expenses: any[], balance: any }) => void) => {
  // First, we need the group IDs the user belongs to
  const groupsQ = query(collection(db, 'groups'), where('members', 'array-contains', userId));
  
  return onSnapshot(groupsQ, (groupSnap) => {
    const groupIds = groupSnap.docs.map(d => d.id);
    if (groupIds.length === 0) {
      onUpdate({ expenses: [], balance: { total: 0, owed: 0, owe: 0 } });
      return;
    }

    // Now listen only to expenses in these groups
    const expensesQ = query(
      collection(db, 'expenses'), 
      where('groupId', 'in', groupIds),
      orderBy('date', 'desc')
    );

    return onSnapshot(expensesQ, (expSnap) => {
      const allExpenses = expSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      let totalOwed = 0;
      let totalOwe = 0;

      allExpenses.forEach((e: any) => {
        const isPaidByMe = e.paidBy === userId;
        const splitDetails = e.splitDetails || {};
        
        if (isPaidByMe) {
          // I paid, others owe me. 
          // Sum up everything in splitDetails that is NOT from me.
          Object.keys(splitDetails).forEach(mId => {
            if (mId !== userId) {
              totalOwed += (splitDetails[mId] || 0);
            }
          });
        } else if (splitDetails[userId] !== undefined) {
          // Someone else paid, I owe them
          totalOwe += (splitDetails[userId] || 0);
        }
      });

      onUpdate({
        expenses: allExpenses,
        balance: { 
          total: totalOwed - totalOwe, 
          owed: totalOwed, 
          owe: totalOwe 
        }
      });
    });
  });
};

/**
 * Advanced debt engine to calculate balances within a group
 * Returns net balance for each member
 */
export const calculateGroupMetrics = (expenses: any[], members: any[]) => {
  const memberBalances: { [key: string]: number } = {};
  members.forEach(m => memberBalances[m.id] = 0);

  expenses.forEach(e => {
    const paidBy = e.paidBy;
    const amount = e.amount;
    const splits = e.splitDetails || {};

    // Plus the whole amount to the payer
    if (memberBalances[paidBy] !== undefined) {
      memberBalances[paidBy] += amount;
    }

    // Subtract the portion each person owes
    Object.keys(splits).forEach(mId => {
      if (memberBalances[mId] !== undefined) {
        memberBalances[mId] -= splits[mId];
      }
    });
  });

  return memberBalances;
};

