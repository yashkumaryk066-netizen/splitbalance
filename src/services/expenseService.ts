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
  const normalized = phone.replace(/[^\d]/g, '');
  // Try to match the last 10 digits or exact match
  const q = query(collection(db, 'users'), where('phoneNumber', '>=', normalized.slice(-10)));
  const querySnapshot = await getDocs(q);
  const found = querySnapshot.docs.find(d => {
    const dPhone = d.data().phoneNumber?.replace(/[^\d]/g, '') || '';
    return dPhone.endsWith(normalized.slice(-10));
  });
  return found ? { id: found.id, ...found.data() } : null;
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
  const cleanPhone = phone.replace(/[^\d]/g, '').slice(-10);
  // Search for any ghost user with this phone number suffix
  const q = query(collection(db, 'users'), where('isGhost', '==', true));
  const qSnap = await getDocs(q);
  
  const ghost = qSnap.docs.find(d => (d.data().phoneNumber || '').replace(/[^\d]/g, '').endsWith(cleanPhone));
  
  if (ghost) {
    const ghostId = ghost.id;
    console.log(`Claiming ghost user ${ghostId} for new UID ${newUid}`);

    // 1. Update Groups
    const groupsQ = query(collection(db, 'groups'), where('members', 'array-contains', ghostId));
    const groupsSnap = await getDocs(groupsQ);
    for (const groupDoc of groupsSnap.docs) {
      const gData = groupDoc.data();
      const newMembers = (gData.members || []).map((m: string) => m === ghostId ? newUid : m);
      await updateDoc(doc(db, 'groups', groupDoc.id), { members: newMembers });
    }
    
    // 2. Update Expenses (paidBy)
    const paidByQ = query(collection(db, 'expenses'), where('paidBy', '==', ghostId));
    const paidBySnap = await getDocs(paidByQ);
    for (const expDoc of paidBySnap.docs) {
      await updateDoc(doc(db, 'expenses', expDoc.id), { paidBy: newUid });
    }

    // 3. Update Expense Split Details (rename keys)
    // Firestore doesn't support searching by map keys directly in a simple query for splitting.
    // We need to fetch expenses in groups where the ghost was a member.
    const groupIds = groupsSnap.docs.map(d => d.id);
    if (groupIds.length > 0) {
      const chunks = [];
      for (let i = 0; i < groupIds.length; i += 10) {
        chunks.push(groupIds.slice(i, i + 10));
      }

      for (const chunk of chunks) {
        const splitQ = query(collection(db, 'expenses'), where('groupId', 'in', chunk));
        const splitSnap = await getDocs(splitQ);
        for (const expDoc of splitSnap.docs) {
          const eData = expDoc.data();
          if (eData.splitDetails && eData.splitDetails[ghostId] !== undefined) {
            const newSplits = { ...eData.splitDetails };
            newSplits[newUid] = newSplits[ghostId];
            delete newSplits[ghostId];
            await updateDoc(doc(db, 'expenses', expDoc.id), { splitDetails: newSplits });
          }
        }
      }
    }

    // 4. Delete the ghost user document
    await setDoc(doc(db, 'users', ghostId), { isClaimed: true, claimedBy: newUid }, { merge: true });
  }
};

export const subscribeToUserExpenses = (userId: string, onUpdate: (data: { expenses: any[], balance: any }) => void) => {
  let unsubExpenses: (() => void) | null = null;
  const groupsQ = query(collection(db, 'groups'), where('members', 'array-contains', userId));
  
  const unsubGroups = onSnapshot(groupsQ, (groupSnap) => {
    // Stop previous expenses listener if it exists
    if (unsubExpenses) {
      unsubExpenses();
      unsubExpenses = null;
    }

    const groupIds = groupSnap.docs.map(d => d.id);
    if (groupIds.length === 0) {
      onUpdate({ expenses: [], balance: { total: 0, owed: 0, owe: 0 } });
      return;
    }

    // Firestore 'in' query supports max 30 elements.
    // However, for Simplicity in real-time, we mostly listen to all expenses
    // and filter them if groupIds list is too large, OR we split queries.
    // For now, let's just handle the first 30 or listen to user-specific expenses.
    const limitedGroupIds = groupIds.slice(0, 30);

    const expensesQ = query(
      collection(db, 'expenses'), 
      where('groupId', 'in', limitedGroupIds),
      orderBy('date', 'desc')
    );

    unsubExpenses = onSnapshot(expensesQ, (expSnap) => {
      const allExpenses = expSnap.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        date: doc.data().date?.toDate ? doc.data().date.toDate() : doc.data().date 
      }));
      
      let totalOwed = 0;
      let totalOwe = 0;

      allExpenses.forEach((e: any) => {
        const isPaidByMe = e.paidBy === userId;
        const splitDetails = e.splitDetails || {};
        
        if (isPaidByMe) {
          Object.keys(splitDetails).forEach(mId => {
            if (mId !== userId) {
              totalOwed += (Number(splitDetails[mId]) || 0);
            }
          });
        } else if (splitDetails[userId] !== undefined) {
          totalOwe += (Number(splitDetails[userId]) || 0);
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
    }, (err) => {
      console.error("Expense snapshot error:", err);
    });
  }, (err) => {
    console.error("Group snapshot error:", err);
  });

  return () => {
    unsubGroups();
    if (unsubExpenses) unsubExpenses();
  };
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

