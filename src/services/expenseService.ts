import { collection, query, where, getDocs, addDoc, Timestamp, doc, updateDoc, arrayUnion, setDoc } from 'firebase/firestore';
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
  const q = query(collection(db, 'users'), where('phoneNumber', '==', phone), where('isGhost', '==', true));
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
