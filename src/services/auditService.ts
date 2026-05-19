import { db, storage } from './firebaseConfig';
import { collection, getDocs, query, where, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';

/**
 * Automates the auditing of Firestore and Storage to keep data clean and efficient.
 */
export const runSystemAudit = async () => {
    const results = {
        base64Detected: 0,
        orphanedImages: 0,
        mismatchedCycles: 0,
        cleanedItems: 0,
        log: [] as string[]
    };

    try {
        // 1. Audit: Detect Base64 strings in Firestore (Storage waste check)
        const expensesSnap = await getDocs(collection(db, 'expenses'));
        const batch = writeBatch(db);
        let hasChanges = false;

        expensesSnap.forEach(expDoc => {
            const data = expDoc.data();
            if (data.receiptUrl && data.receiptUrl.startsWith('data:image')) {
                results.base64Detected++;
                results.log.push(`EXPENSE_AUDIT: Base64 found in ${expDoc.id}. Clearing to save Firestore space.`);
                batch.update(doc(db, 'expenses', expDoc.id), { receiptUrl: null });
                hasChanges = true;
            }
            if (!data.cycleId && data.groupId !== 'personal') {
                results.mismatchedCycles++;
                results.log.push(`EXPENSE_AUDIT: Expense ${expDoc.id} has no CycleId. Should be audited.`);
            }
        });

        // 2. Audit: Profile Photo Base64 check
        const usersSnap = await getDocs(collection(db, 'users'));
        usersSnap.forEach(userDoc => {
            const data = userDoc.data();
            if (data.photoURL && data.photoURL.startsWith('data:image')) {
                results.base64Detected++;
                results.log.push(`USER_AUDIT: User ${userDoc.id} using Base64 photo. Resetting to default.`);
                batch.update(doc(db, 'users', userDoc.id), { photoURL: null });
                hasChanges = true;
            }
        });

        if (hasChanges) {
            await batch.commit();
            results.log.push(`CLEANUP: Batch executed. Sub-optimal data cleared.`);
            results.cleanedItems = results.base64Detected;
        }

        return results;
    } catch (err: any) {
        console.error("Audit failed:", err);
        throw err;
    }
};

/**
 * Cleanup: Deletes storage objects that are no longer referenced in Firestore.
 * (Advanced logic: careful with performance on large groups)
 */
export const cleanupOrphanedPhotos = async () => {
    // This requires iterating Storage which is complex on client side.
    // Usually handled via Firebase Cloud Functions.
    return { status: 'This requires Cloud Functions for production safety.' };
};
