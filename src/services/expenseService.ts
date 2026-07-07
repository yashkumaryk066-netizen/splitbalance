import { collection, query, where, getDocs, addDoc, Timestamp, doc, updateDoc, arrayUnion, setDoc, onSnapshot, orderBy, deleteDoc, arrayRemove, writeBatch, getDoc } from 'firebase/firestore';
import { db, storage } from './firebaseConfig';
import { ref, deleteObject } from 'firebase/storage';
import { calculateGroupMetrics } from '../utils/expenseUtils';

export interface Group {
  id: string;
  name: string;
  members: string[];
  currentCycleId?: string;
  createdAt?: any;
}

export interface ExpenseData {
  amount?: number;
  description?: string;
  type?: 'expense' | 'payment' | 'carryForward';
  paidBy?: string | { [key: string]: number };
  paidTo?: string;
  groupId?: string;
  cycleId?: string | null;
  splitDetails?: { [key: string]: number };
  receiptUrl?: string | null;
  date?: any;
  isRecurring?: boolean;
}

export const getGroups = async (userId: string) => {
  const q = query(collection(db, 'groups'), where('members', 'array-contains', userId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
};

export const createGroup = async (name: string, members: string[]) => {
  const cycleRef = doc(collection(db, 'cycles'));
  const cycleId = cycleRef.id;
  
  const docRef = await addDoc(collection(db, 'groups'), {
    name,
    members,
    currentCycleId: cycleId,
    createdAt: Timestamp.now(),
  });
  
  // Create initial cycle
  await setDoc(cycleRef, {
    id: cycleId,
    groupId: docRef.id,
    status: 'OPEN',
    startTime: Timestamp.now(),
    name: 'Initial Month'
  });

  return docRef.id;
};

export const addExpense = async (expenseData: ExpenseData) => {
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

export const addPayment = async (senderId: string, receiverId: string, amount: number, groupId: string, cycleId: string, senderName: string, receiverName: string) => {
  const docRef = await addDoc(collection(db, 'expenses'), {
    amount,
    paidBy: senderId,
    paidTo: receiverId,
    paidByName: senderName,
    paidToName: receiverName,
    groupId,
    cycleId,
    type: 'payment',
    description: 'Settle Up Payment',
    date: Timestamp.now(),
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};

export const removeMemberFromGroup = async (groupId: string, userId: string) => {
  const groupRef = doc(db, 'groups', groupId);
  await updateDoc(groupRef, {
    members: arrayRemove(userId)
  });
};

export const deleteGroup = async (groupId: string) => {
  let batch = writeBatch(db);
  let batchCount = 0;

  const commitBatch = async () => {
    if (batchCount > 0) {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    }
  };

  const addDeleteToBatch = async (ref: any) => {
    batch.delete(ref);
    batchCount++;
    if (batchCount === 400) {
      await commitBatch();
    }
  };
  
  // 1. Delete group document
  await addDeleteToBatch(doc(db, 'groups', groupId));
  
  // 2. Delete all expenses in this group & their photos
  const q = query(collection(db, 'expenses'), where('groupId', '==', groupId));
  const qSnap = await getDocs(q);
  for (const d of qSnap.docs) {
    const data = d.data();
    // Delete photo if exists
    if (data.receiptUrl && data.receiptUrl.includes('firebasestorage')) {
        try {
            const photoRef = ref(storage, data.receiptUrl);
            await deleteObject(photoRef);
        } catch (err) { /* silent fail if already gone */ }
    }
    await addDeleteToBatch(doc(db, 'expenses', d.id));
  }

  // 3. Delete all cycles for this group
  const cyclesQ = query(collection(db, 'cycles'), where('groupId', '==', groupId));
  const cyclesSnap = await getDocs(cyclesQ);
  for (const c of cyclesSnap.docs) {
    await addDeleteToBatch(doc(db, 'cycles', c.id));
  }
  
  await commitBatch();
};

export const clearGroupHistory = async (groupId: string) => {
  let batch = writeBatch(db);
  let batchCount = 0;

  const commitBatch = async () => {
    if (batchCount > 0) {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    }
  };

  const addDeleteToBatch = async (ref: any) => {
    batch.delete(ref);
    batchCount++;
    if (batchCount === 400) {
      await commitBatch();
    }
  };
  
  // 1. Delete all expenses in this group & their photos
  const q = query(collection(db, 'expenses'), where('groupId', '==', groupId));
  const qSnap = await getDocs(q);
  for (const d of qSnap.docs) {
    const data = d.data();
    if (data.receiptUrl && data.receiptUrl.includes('firebasestorage')) {
        try {
            const photoRef = ref(storage, data.receiptUrl);
            await deleteObject(photoRef);
        } catch (err) { /* silent fail if already gone */ }
    }
    await addDeleteToBatch(doc(db, 'expenses', d.id));
  }

  // 2. Delete all cycles for this group
  const cyclesQ = query(collection(db, 'cycles'), where('groupId', '==', groupId));
  const cyclesSnap = await getDocs(cyclesQ);
  for (const c of cyclesSnap.docs) {
    await addDeleteToBatch(doc(db, 'cycles', c.id));
  }
  
  // 3. Reset group's currentCycleId
  batch.update(doc(db, 'groups', groupId), { currentCycleId: null });
  batchCount++;

  await commitBatch();
};

export const updateExpense = async (expenseId: string, expenseData: Partial<ExpenseData>) => {
  const expenseRef = doc(db, 'expenses', expenseId);
  await updateDoc(expenseRef, {
    ...expenseData,
    updatedAt: Timestamp.now(),
  });
};

export const closeCurrentCycle = async (groupId: string, members: any[], expenses: any[], cycleName: string) => {
  const groupRef = doc(db, 'groups', groupId);
  const groupSnap = await getDoc(groupRef);
  if (!groupSnap.exists()) throw new Error("Group does not exist");
  const gData = groupSnap.data() as Group;
  const currentCycleId = gData.currentCycleId;

  // 1. Calculate balances for the current cycle
  const balances = calculateGroupMetrics(expenses, members);

  const batch = writeBatch(db);

  // 2. Mark current cycle as closed
  if (currentCycleId) {
    batch.update(doc(db, 'cycles', currentCycleId), {
      status: 'CLOSED',
      endTime: Timestamp.now(),
      finalBalances: balances
    });
  }

  // 3. Create NEW cycle
  const newCycleRef = doc(collection(db, 'cycles'));
  const newCycleId = newCycleRef.id;
  batch.set(newCycleRef, {
    id: newCycleId,
    groupId,
    status: 'OPEN',
    startTime: Timestamp.now(),
    name: cycleName,
    previousCycleId: currentCycleId || null
  });

  // 4. Update Group with new cycle ID
  batch.update(groupRef, { currentCycleId: newCycleId });

  // 5. Carry Forward non-zero balances
  Object.entries(balances).forEach(([mId, bal]) => {
    if (Math.abs(bal) > 0.1) {
      const isOwed = bal > 0;
      const amount = Math.abs(bal);
      const member = members.find(m => m.id === mId);
      const memberName = member?.displayName || 'User';
      
      const carryForwardRef = doc(collection(db, 'expenses'));
      batch.set(carryForwardRef, {
        amount,
        description: `Carry Forward: ${memberName}'s ${isOwed ? 'Credit' : 'Due'}`,
        groupId,
        cycleId: newCycleId,
        type: 'carryForward',
        paidBy: isOwed ? mId : 'system',
        date: Timestamp.now(),
        createdAt: Timestamp.now(),
        splitDetails: {
           [mId]: isOwed ? 0 : amount
        }
      });
    }
  });

  // 6. Handle Recurring Expenses (Auto-add to new cycle as fresh items)
  const recurringExpenses = expenses.filter(e => e.isRecurring && e.type !== 'carryForward');
  for (const re of recurringExpenses) {
    const reRef = doc(collection(db, 'expenses'));
    batch.set(reRef, {
      ...re,
      cycleId: newCycleId,
      date: Timestamp.now(),
      createdAt: Timestamp.now(),
      id: reRef.id // Ensure unique ID for new record
    });
  }

  await batch.commit();
  return newCycleId;
};

export const deleteExpense = async (expenseId: string) => {
  const eDoc = await getDoc(doc(db, 'expenses', expenseId));
  if (eDoc.exists()) {
    const data = eDoc.data();
    if (data.receiptUrl && data.receiptUrl.includes('firebasestorage')) {
        try {
            const photoRef = ref(storage, data.receiptUrl);
            await deleteObject(photoRef);
        } catch (err) { /* ignore */ }
    }
  }
  await deleteDoc(doc(db, 'expenses', expenseId));
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
  const cleanPhone = phone.replace(/[^\\d]/g, '').slice(-10);
  // Search for any ghost user with this phone number suffix
  const q = query(collection(db, 'users'), where('isGhost', '==', true));
  const qSnap = await getDocs(q);
  
  const ghost = qSnap.docs.find(d => (d.data().phoneNumber || '').replace(/[^\\d]/g, '').endsWith(cleanPhone));
  
  if (ghost) {
    const ghostId = ghost.id;
    console.log(`Claiming ghost user ${ghostId} for new UID ${newUid}`);

    const batch = writeBatch(db);

    // 1. Update Groups
    const groupsQ = query(collection(db, 'groups'), where('members', 'array-contains', ghostId));
    const groupsSnap = await getDocs(groupsQ);
    for (const groupDoc of groupsSnap.docs) {
      const gData = groupDoc.data();
      const newMembers = (gData.members || []).map((m: string) => m === ghostId ? newUid : m);
      batch.update(doc(db, 'groups', groupDoc.id), { members: newMembers });
    }
    
    // 2. Update Expenses (paidBy)
    const paidByQ = query(collection(db, 'expenses'), where('paidBy', '==', ghostId));
    const paidBySnap = await getDocs(paidByQ);
    for (const expDoc of paidBySnap.docs) {
      batch.update(doc(db, 'expenses', expDoc.id), { paidBy: newUid });
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
            batch.update(doc(db, 'expenses', expDoc.id), { splitDetails: newSplits });
          }
        }
      }
    }

    // 4. Mark the ghost user document as claimed
    batch.set(doc(db, 'users', ghostId), { isClaimed: true, claimedBy: newUid }, { merge: true });

    // Commit atomically to avoid orphaned data and maintain db limits
    await batch.commit();
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

      allExpenses.forEach((e: ExpenseData & { id: string }) => {
        const paidBy = e.paidBy;
        const amount = Number(e.amount);
        
        // Calculate what I paid
        let myContribution = 0;
        if (typeof paidBy === 'object' && paidBy !== null) {
          myContribution = Number(paidBy[userId] || 0);
        } else if (paidBy === userId) {
          myContribution = amount;
        }

        if (e.type === 'payment') {
            if (paidBy === userId) {
              totalOwed += amount;
            } else if (e.paidTo === userId) {
              totalOwe += amount;
            }
        } else {
            const splitDetails = e.splitDetails || {};
            const myShare = Number(splitDetails[userId] || 0);
            
            const diff = myContribution - myShare;
            if (diff > 0) {
              totalOwed += diff;
            } else if (diff < 0) {
              totalOwe += Math.abs(diff);
            }
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

export const getGroupCycles = async (groupId: string) => {
  const q = query(collection(db, 'cycles'), where('groupId', '==', groupId), orderBy('startTime', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const reopenCycle = async (groupId: string, cycleId: string) => {
  const batch = writeBatch(db);
  const groupRef = doc(db, 'groups', groupId);
  const cycleRef = doc(db, 'cycles', cycleId);

  // 1. Mark cycle as OPEN
  batch.update(cycleRef, { status: 'OPEN', endTime: null });

  // 2. Update group's currentCycleId
  batch.update(groupRef, { currentCycleId: cycleId });

  // 3. Remove carryForward expenses created when this cycle started (optional but cleaner)
  const carryQ = query(collection(db, 'expenses'), where('groupId', '==', groupId), where('cycleId', '==', cycleId), where('type', '==', 'carryForward'));
  const carrySnap = await getDocs(carryQ);
  carrySnap.docs.forEach(d => batch.delete(d.ref));

  await batch.commit();
};
