import { useNotification } from '@/components/Notification';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { addExpense, deleteExpense, getGroups, updateExpense } from '@/src/services/expenseService';
import { db, storage } from '@/src/services/firebaseConfig';
import { useUserStore } from '@/src/store/useUserStore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { doc, getDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import * as FileSystem from 'expo-file-system';
import { evaluateAmountString } from '@/src/utils/formatters';
import { Receipt, Tag, Wallet, X, Camera, Check, Calendar, Scan, Info } from 'lucide-react-native';
import React, { useEffect, useState, useMemo } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as ImagePicker from 'expo-image-picker';

const CATEGORIES = [
  { label: 'Food & Drink', icon: 'utensils' },
  { label: 'Transport', icon: 'car' },
  { label: 'Entertainment', icon: 'film' },
  { label: 'Rent', icon: 'home' },
  { label: 'Groceries', icon: 'shopping-cart' },
  { label: 'General', icon: 'box' },
];

export default function AddExpenseModal() {
  const { groupId: initialGroupId, expenseId } = useLocalSearchParams<{ groupId?: string, expenseId?: string }>();
  
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [groupId, setGroupId] = useState('');
  const [category, setCategory] = useState('General');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);
  const [image, setImage] = useState<string | null>(null);
  const [initialImage, setInitialImage] = useState<string | null>(null);
  
  const { user, settings } = useUserStore();
  const [splitType, setSplitType] = useState<'Equal' | 'Exact' | 'Percentage' | 'Shares'>(
    (settings.defaultSplitType === 'Percent' ? 'Percentage' : settings.defaultSplitType) as any
  );

  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [splitDetails, setSplitDetails] = useState<{ [key: string]: number }>({});
  const [payerId, setPayerId] = useState<string>('');
  const [multiPayerMode, setMultiPayerMode] = useState(false);
  const [payerDetails, setPayerDetails] = useState<{ [key: string]: number }>({});
  const [date, setDate] = useState(new Date());
  const [scanning, setScanning] = useState(false);
  const [currentCycleId, setCurrentCycleId] = useState<string | null>(null);

  const router = useRouter();

  const { showNotification } = useNotification();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const isValid = useMemo(() => {
    if (!amount || !description) return false;
    const total = evaluateAmountString(amount);
    if (isNaN(total) || total <= 0) return false;

    if (groupId && groupMembers.length > 0) {
      if (multiPayerMode) {
        const sumPayers = Object.values(payerDetails).reduce((a, b) => a + (b || 0), 0);
        if (Math.abs(sumPayers - total) > 0.1) return false;
      }

      if (splitType === 'Equal') {
        const activeMembers = groupMembers.filter(m => splitDetails[m.id] === undefined || splitDetails[m.id] > 0);
        if (activeMembers.length === 0) return false;
      } else if (splitType === 'Exact') {
        const sum = Object.values(splitDetails).reduce((a, b) => a + (b || 0), 0);
        if (Math.abs(sum - total) > 0.1) return false;
      } else if (splitType === 'Percentage') {
        const sum = Object.values(splitDetails).reduce((a, b) => a + (b || 0), 0);
        if (Math.abs(sum - 100) > 0.1) return false;
      } else if (splitType === 'Shares') {
        const totalShares = Object.values(splitDetails).reduce((a, b) => a + (b || 0), 0);
        if (totalShares <= 0) return false;
      }
    }
    return true;
  }, [amount, description, groupId, groupMembers, splitType, splitDetails, multiPayerMode, payerDetails]);


  useEffect(() => {
    if (user) {
      loadGroups();
    }
  }, [user]);

  useEffect(() => {
    if (expenseId) {
      loadExpenseData();
    } else if (initialGroupId) {
      setGroupId(initialGroupId as string);
    }
  }, [expenseId, initialGroupId]);

  const loadExpenseData = async () => {
    try {
      const eDoc = await getDoc(doc(db, 'expenses', expenseId as string));
      if (eDoc.exists()) {
        const data = eDoc.data();
        setAmount(String(data.amount));
        setDescription(data.description);
        setGroupId(data.groupId);
        setCategory(data.category);
        setPaymentMethod(data.paymentMethod);
        setPayerId(typeof data.paidBy === 'string' ? data.paidBy : '');
        if (typeof data.paidBy === 'object' && data.paidBy !== null) {
          setMultiPayerMode(true);
          setPayerDetails(data.paidBy);
        }
        setSplitType(data.splitType);
        setSplitDetails(data.splitDetails || {});
        setImage(data.receiptUrl);
        setInitialImage(data.receiptUrl);
        setIsRecurring(data.isRecurring || false);
        if (data.date) {
          setDate(data.date.toDate ? data.date.toDate() : new Date(data.date));
        }
      }
    } catch (err) {
      showNotification('Failed to load expense details', 'error');
    }
  };

  useEffect(() => {
    if (groupId) {
      loadGroupMembers(groupId);
    } else {
      setGroupMembers([]);
      setSplitDetails({});
    }
  }, [groupId]);

  const loadGroupMembers = async (id: string) => {
    try {
      const gDoc = await getDoc(doc(db, 'groups', id));
      if (gDoc.exists()) {
        const groupData = gDoc.data();
        if (!groupData) return;
        
        setCurrentCycleId(groupData.currentCycleId || null);
        const mIds = groupData.members || [];
        const initialDetails: { [key: string]: number } = {};
        
        // Fetch all members in parallel
        const mDocs = await Promise.all(
          mIds.map((mId: string) => getDoc(doc(db, 'users', mId)))
        );

        const mData = mDocs
          .map((mDoc, index) => {
            if (mDoc.exists()) {
              initialDetails[mIds[index]] = 0;
              return { id: mIds[index], ...mDoc.data() };
            }
            return null;
          })
          .filter(m => m !== null);

        setGroupMembers(mData);
        setSplitDetails(initialDetails);
      }
    } catch (err) {
      console.error("Error loading members:", err);
      showNotification('Failed to load group members', 'error');
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4], // Optimized for vertical receipts
      quality: 0.1, // High compression for base64 storage
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleScanReceipt = async () => {
    if (!image) {
      showNotification('Please attach a photo first', 'info');
      return;
    }
    setScanning(true);
    // Simulate OCR delay - this would normally call a real OCR API
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate different results
    const simulations = [
      { desc: 'Starbucks Coffee', amt: '450', cat: 'Food & Drink' },
      { desc: 'Shell Fuel Station', amt: '2200', cat: 'Transport' },
      { desc: 'Grocery Store #42', amt: '1580', cat: 'Groceries' },
      { desc: 'Cinema Tickets', amt: '800', cat: 'Entertainment' }
    ];
    const result = simulations[Math.floor(Math.random() * simulations.length)];
    
    setDescription(result.desc);
    setAmount(result.amt);
    setCategory(result.cat);
    
    showNotification('Receipt analyzed! Data populated.', 'success');
    setScanning(false);
  };

  useEffect(() => {
    if (user && !payerId) {
      setPayerId(user.uid);
    }
  }, [user]);

  const loadGroups = async () => {
    if (!user?.uid) return;
    try {
      const g = await getGroups(user.uid);
      setGroups(g);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    if (!amount || !description || !user?.uid) return;
    const total = evaluateAmountString(amount);
    if (isNaN(total)) {
      showNotification('Invalid amount formula', 'error');
      return;
    }
    let finalSplits: { [key: string]: number } = {};

    // Calculate split details based on type
    if (splitType === 'Equal') {
      // Filter out members who are explicitly excluded (splitDetails[id] === 0)
      const activeMembers = groupMembers.filter(m => splitDetails[m.id] === undefined || splitDetails[m.id] > 0);
      if (activeMembers.length === 0) {
        showNotification('At least one person must be included in the split', 'error');
        return;
      }
      const perPerson = total / activeMembers.length;
      activeMembers.forEach(m => finalSplits[m.id] = perPerson);
    } else if (splitType === 'Exact') {
      const sum = Object.values(splitDetails).reduce((a: number, b: number) => a + (b || 0), 0);
      if (Math.abs(sum - total) > 0.1) {
        showNotification(`Total must be ${settings.currency}${total}. Current sum: ${settings.currency}${sum}`, 'error');

        return;
      }
      finalSplits = splitDetails as any;
    } else if (splitType === 'Percentage') {
      const sum = Object.values(splitDetails).reduce((a: number, b: number) => a + (b || 0), 0);
      if (Math.abs(sum - 100) > 0.1) {
        showNotification('Total percentage must be 100%', 'error');
        return;
      }
      Object.keys(splitDetails).forEach(mId => {
        if (splitDetails[mId] > 0) {
          finalSplits[mId] = (splitDetails[mId] / 100) * total;
        }
      });
    } else if (splitType === 'Shares') {
      const totalShares = Object.values(splitDetails).reduce((a: number, b: number) => a + (b || 0), 0);
      if (totalShares === 0) {
        showNotification('Total shares must be greater than 0', 'error');
        return;
      }
      Object.keys(splitDetails).forEach(mId => {
        if (splitDetails[mId] > 0) {
          finalSplits[mId] = (splitDetails[mId] / totalShares) * total;
        }
      });
    }

    setLoading(true);
    try {
      let receiptUrl = null;
      
      // Upload image to Firebase Storage if it's a local file
      if (image && !image.startsWith('http') && !image.startsWith('data:')) {
        try {
          const response = await fetch(image);
          const blob = await response.blob();
          const storageRef = ref(storage, `receipts/${user.uid}_${Date.now()}.jpg`);
          await uploadBytes(storageRef, blob);
          receiptUrl = await getDownloadURL(storageRef);
        } catch (err) {
          console.error("Image upload failed:", err);
          showNotification('Image upload failed, saving without receipt.', 'info');
        }
      } else {
        receiptUrl = image;
      }

      const expenseData = {
        amount: total,
        description,
        groupId: groupId || 'personal',
        cycleId: currentCycleId,
        category,
        paymentMethod,
        paidBy: multiPayerMode ? payerDetails : (payerId || user.uid),
        date: date,
        receiptUrl: receiptUrl || null,
        type: 'expense' as const,
        isRecurring: isRecurring,
        splitType,
        splitDetails: finalSplits,
      };
      await addExpense(expenseData);
      showNotification('Expense added!', 'success');
      router.back();
    } catch (err) {
      console.error(err);
      showNotification('Failed to save expense', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!amount || !description || !user?.uid || !expenseId) return;
    const total = evaluateAmountString(amount);
    if (isNaN(total)) {
      showNotification('Invalid amount formula', 'error');
      return;
    }
    let finalSplits: { [key: string]: number } = {};

    // Calculate split details (duplicate of logic in handleSave for now)
    if (splitType === 'Equal') {
      const activeMembers = groupMembers.filter(m => splitDetails[m.id] === undefined || splitDetails[m.id] > 0);
      const perPerson = total / activeMembers.length;
      activeMembers.forEach(m => finalSplits[m.id] = perPerson);
    } else if (splitType === 'Exact') {
      finalSplits = splitDetails as any;
    } else if (splitType === 'Percentage') {
      Object.keys(splitDetails).forEach(mId => {
        if (splitDetails[mId] > 0) finalSplits[mId] = (splitDetails[mId] / 100) * total;
      });
    } else if (splitType === 'Shares') {
      const totalShares = Object.values(splitDetails).reduce((a: number, b: number) => a + (b || 0), 0);
      Object.keys(splitDetails).forEach(mId => {
        if (splitDetails[mId] > 0) finalSplits[mId] = (splitDetails[mId] / totalShares) * total;
      });
    }

    setLoading(true);
    try {
      let receiptUrl = image;
      if (image && !image.startsWith('http') && !image.startsWith('data:')) {
        try {
          const response = await fetch(image);
          const blob = await response.blob();
          const storageRef = ref(storage, `receipts/${user.uid}_${Date.now()}.jpg`);
          await uploadBytes(storageRef, blob);
          receiptUrl = await getDownloadURL(storageRef);
          
          // Delete old image if it was on Storage
          if (initialImage && initialImage.includes('firebasestorage')) {
            try {
              const oldRef = ref(storage, initialImage);
              await deleteObject(oldRef);
            } catch (err) { /* ignore */ }
          }
        } catch (err) {
          console.error("Image upload update failed:", err);
        }
      }

      const expenseData = {
        amount: total,
        description,
        groupId,
        category,
        paymentMethod,
        paidBy: multiPayerMode ? payerDetails : (payerId || user.uid),
        receiptUrl: receiptUrl || null,
        isRecurring: isRecurring,
        splitType,
        splitDetails: finalSplits,
        date: date,
      };
      await updateExpense(expenseId, expenseData);
      showNotification('Expense updated!', 'success');
      router.back();
    } catch (err) {
      console.error(err);
      showNotification('Failed to update expense', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await deleteExpense(expenseId!);
              showNotification('Expense deleted', 'success');
              router.back();
            } catch (err) {
              showNotification('Failed to delete expense', 'error');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };


  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: Math.max(insets.top, 16) }]}>
        <Pressable onPress={() => router.back()} style={styles.closeButton}>
          <X size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{expenseId ? 'Edit Expense' : 'Add Expense'}</Text>
        {isValid ? (
          <Pressable onPress={expenseId ? handleUpdate : handleSave} disabled={loading} style={styles.doneButton}>
            {loading ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={[styles.doneText, { color: colors.primary }]}>Done</Text>}
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.form}>
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.icon }]}>Group</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Pressable 
              onPress={() => setGroupId('')}
              style={[
                styles.categoryChip, 
                { 
                  backgroundColor: groupId === '' ? colors.secondary : colors.cardBg,
                  borderColor: colors.border,
                  opacity: 0.8
                }
              ]}
            >
              <Text style={{ color: groupId === '' ? '#fff' : colors.text }}>No Group</Text>
            </Pressable>
            {groups.map((g) => (
              <Pressable 
                key={g.id} 
                onPress={() => setGroupId(g.id)}
                style={[
                  styles.categoryChip, 
                  { 
                    backgroundColor: groupId === g.id ? colors.secondary : colors.cardBg,
                    borderColor: colors.border 
                  }
                ]}
              >
                <Text style={{ color: groupId === g.id ? '#fff' : colors.text }}>{g.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.amountSection}>
          <Text style={[styles.label, { color: colors.icon }]}>Total Amount</Text>
          <View style={styles.amountInputContainer}>
            <Text style={[styles.currency, { color: colors.text }]}>{settings.currency}</Text>

            <TextInput
              style={[styles.amountInput, { color: colors.text }]}
              placeholder="0.00"
              placeholderTextColor={colors.icon}
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
              value={amount}
              onChangeText={setAmount}
              autoFocus
            />
          </View>
          {amount.match(/[+\-*/]/) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary + '10', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 8 }}>
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>Sum: {settings.currency}{evaluateAmountString(amount).toFixed(2)}</Text>
            </View>
          )}
        </View>

        <View style={styles.inputCard}>
          <View style={[styles.inputRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <Receipt size={20} color={colors.icon} style={styles.inputIcon} />
            <TextInput
              style={[styles.textInput, { color: colors.text }]}
              placeholder="Description"
              placeholderTextColor={colors.icon}
              value={description}
              onChangeText={setDescription}
            />
          </View>
          
          <View style={[styles.inputRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <Camera size={20} color={colors.icon} style={styles.inputIcon} />
            <Pressable onPress={pickImage} style={{ flex: 1 }}>
              <Text style={{ color: image ? colors.primary : colors.icon, fontSize: 16 }}>
                {image ? 'Receipt Attached ✓' : 'Attach Bill Photo'}
              </Text>
            </Pressable>
            {image && (
              <Pressable 
                onPress={handleScanReceipt} 
                style={{ backgroundColor: colors.primary + '20', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                {scanning ? <ActivityIndicator size="small" color={colors.primary} /> : <Scan size={14} color={colors.primary} />}
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>{scanning ? 'Scanning...' : 'Scan OCR'}</Text>
              </Pressable>
            )}
          </View>

          <View style={[styles.inputRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <Calendar size={20} color={colors.icon} style={styles.inputIcon} />
            <TextInput
              style={[styles.textInput, { color: colors.text }]}
              placeholder="YYYY-MM-DD"
              value={date.toISOString().split('T')[0]}
              onChangeText={(val) => {
                const newDate = new Date(val);
                if (!isNaN(newDate.getTime())) setDate(newDate);
              }}
            />
          </View>

          <View style={styles.inputRow}>
            <Tag size={20} color={colors.icon} style={styles.inputIcon} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {CATEGORIES.map((cat) => (
                <Pressable 
                  key={cat.label} 
                  onPress={() => setCategory(cat.label)}
                  style={[
                    styles.categoryChip, 
                    { 
                      backgroundColor: category === cat.label ? colors.primary : colors.cardBg,
                      borderColor: colors.border 
                    }
                  ]}
                >
                  <Text style={{ color: category === cat.label ? '#fff' : colors.text }}>{cat.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <View style={styles.inputRow}>
            <Wallet size={20} color={colors.icon} style={styles.inputIcon} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['Cash', 'Credit Card', 'UPI', 'Bank Transfer'].map((pm) => (
                <Pressable 
                  key={pm} 
                  onPress={() => setPaymentMethod(pm)}
                  style={[
                    styles.categoryChip, 
                    { 
                      backgroundColor: paymentMethod === pm ? colors.primary : colors.cardBg,
                      borderColor: colors.border 
                    }
                  ]}
                >
                  <Text style={[styles.categoryText, { color: paymentMethod === pm ? '#fff' : colors.text }]}>
                    {pm}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>

        {groupId && groupMembers.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.icon }]}>Payer & Split</Text>
            
            {/* Payer Selection */}
            <View style={[styles.inputCard, { padding: 16, marginBottom: 16 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={[styles.label, { fontSize: 14, color: colors.icon, marginBottom: 0 }]}>
                  {multiPayerMode ? 'Contributed By:' : 'Paid By:'}
                </Text>
                <Pressable 
                  onPress={() => setMultiPayerMode(!multiPayerMode)}
                  style={{ backgroundColor: colors.primary + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}
                >
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                    {multiPayerMode ? 'Switch to Single Payer' : 'Multiple Payers?'}
                  </Text>
                </Pressable>
              </View>

              {!multiPayerMode ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {groupMembers.map((member) => (
                    <Pressable 
                      key={member.id}
                      onPress={() => setPayerId(member.id)}
                      style={[
                        styles.payerChip,
                        { 
                          backgroundColor: payerId === member.id ? colors.primary : colors.cardBg,
                          borderColor: colors.border
                        }
                      ]}
                    >
                      <View style={[styles.avatarMini, { backgroundColor: payerId === member.id ? '#ffffff30' : colors.accent }]}>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{member.displayName[0]}</Text>
                      </View>
                      <Text style={{ color: payerId === member.id ? '#fff' : colors.text, fontSize: 12, fontWeight: '600' }}>
                        {member.id === user?.uid ? 'You' : member.displayName}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : (
                <View>
                  {groupMembers.map((member) => (
                    <View key={member.id} style={[styles.splitMemberRow, { borderBottomColor: colors.border + '30', paddingVertical: 8 }]}>
                      <Text style={{ color: colors.text, flex: 1, fontSize: 14 }}>{member.displayName}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ color: colors.text, marginRight: 4, opacity: 0.7 }}>{settings.currency}</Text>
                        <TextInput
                          style={[styles.splitInput, { color: colors.text, borderColor: colors.border, height: 32, width: 90 }]}
                          value={String(payerDetails[member.id] || '')}
                          onChangeText={(val) => {
                            const num = parseFloat(val) || 0;
                            setPayerDetails(prev => ({ ...prev, [member.id]: num }));
                          }}
                          keyboardType="decimal-pad"
                          placeholder="0"
                        />
                      </View>
                    </View>
                  ))}
                  <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
                    {(() => {
                      const totalContributions = Object.values(payerDetails).reduce((a, b) => a + (b || 0), 0);
                      const target = evaluateAmountString(amount) || 0;
                      const diff = target - totalContributions;
                      return (
                        <Text style={{ color: Math.abs(diff) > 0.1 ? colors.debt : colors.gain, fontSize: 13, fontWeight: '600' }}>
                          Contributions: {settings.currency}{totalContributions.toFixed(2)} 
                          {Math.abs(diff) > 0.1 ? ` (${diff > 0 ? 'Short' : 'Over'} by ${settings.currency}${Math.abs(diff).toFixed(2)})` : ' ✓ Perfect'}
                        </Text>
                      );
                    })()}
                  </View>
                </View>
              )}
            </View>

            {/* Split Strategy */}
            <View style={[styles.inputCard, { padding: 16 }]}>
              <Text style={[styles.label, { fontSize: 14, color: colors.icon, marginBottom: 12 }]}>Split Strategy:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {['Equal', 'Exact', 'Percentage', 'Shares'].map((type: any) => (
                  <Pressable 
                    key={type} 
                    onPress={() => setSplitType(type)}
                    style={[
                      styles.categoryChip, 
                      { 
                        backgroundColor: splitType === type ? colors.primary : colors.cardBg,
                        borderColor: colors.border 
                      }
                    ]}
                  >
                    <Text style={{ color: splitType === type ? '#fff' : colors.text }}>{type}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              
              <View style={{ marginTop: 20, backgroundColor: 'transparent' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={[styles.label, { fontSize: 14, color: colors.icon, marginBottom: 0 }]}>
                    {splitType === 'Equal' ? 'Who is included?' : `Specify ${splitType === 'Exact' ? 'Amounts' : splitType === 'Percentage' ? 'Percentages' : 'Shares'}:`}
                  </Text>
                  {splitType !== 'Equal' && splitType !== 'Shares' && (() => {
                    const sum = Object.values(splitDetails).reduce((a, b) => a + (b || 0), 0);
                    const target = splitType === 'Exact' ? (evaluateAmountString(amount) || 0) : 100;
                    const diff = target - sum;
                    return (
                      <Text style={{ fontSize: 12, fontWeight: '700', color: Math.abs(diff) > 0.1 ? colors.debt : colors.gain }}>
                        {splitType === 'Exact' ? 'Left: ' + settings.currency + diff.toFixed(2) : 'Left: ' + diff.toFixed(1) + '%'}
                      </Text>
                    );
                  })()}
                </View>
                {groupMembers.map((member) => (
                  <View key={member.id} style={[styles.splitMemberRow, { borderBottomColor: colors.border }]}>
                    <Text style={{ color: colors.text, flex: 1, fontWeight: '500' }}>{member.displayName}</Text>
                    
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent' }}>
                      {splitType === 'Equal' ? (
                        <Pressable 
                          onPress={() => {
                            setSplitDetails((prev: any) => {
                              const next = { ...prev };
                              // If member is currently included (undefined or > 0), set to 0 (excluded)
                              // If member is currently excluded (0), delete key (included)
                              if (next[member.id] === undefined || next[member.id] > 0) {
                                next[member.id] = 0; // Exclude
                              } else {
                                delete next[member.id]; // Include
                              }
                              return next;
                            });
                          }}
                          style={[
                            styles.checkbox,
                            { backgroundColor: (splitDetails[member.id] === undefined || splitDetails[member.id] > 0) ? colors.primary : 'transparent', borderColor: colors.primary }
                          ]}
                        >
                          {(splitDetails[member.id] === undefined || splitDetails[member.id] > 0) && (
                            <Check size={14} color="#fff" strokeWidth={3} />
                          )}
                        </Pressable>
                      ) : (
                        <>
                          <Text style={{ color: colors.text, marginRight: 4, fontWeight: '600' }}>
                            {splitType === 'Exact' ? settings.currency : ''}

                          </Text>
                          <TextInput
                            style={[styles.splitInput, { color: colors.text, borderColor: colors.border }]}
                            value={String(splitDetails[member.id] || '')}
                            onChangeText={(val) => {
                              const num = parseFloat(val) || 0;
                              setSplitDetails(prev => ({ ...prev, [member.id]: num }));
                            }}
                            keyboardType="decimal-pad"
                            placeholder="0"
                          />
                          <Text style={{ color: colors.text, marginLeft: 4, fontWeight: '600' }}>
                            {splitType === 'Percentage' ? '%' : splitType === 'Shares' ? 'sh' : ''}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {expenseId && (
          <Pressable 
            onPress={handleDelete} 
            disabled={loading}
            style={[styles.deleteButton, { borderColor: colors.debt + '50' }]}
          >
            <Text style={[styles.deleteButtonText, { color: colors.debt }]}>Delete Expense</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  doneButton: {
    padding: 4,
  },
  doneText: {
    fontSize: 18,
    fontWeight: '700',
  },
  form: {
    padding: 20,
  },
  amountSection: {
    alignItems: 'center',
    marginVertical: 32,
    backgroundColor: 'transparent',
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  currency: {
    fontSize: 32,
    fontWeight: '700',
  },
  amountInput: {
    fontSize: 48,
    fontWeight: '800',
    marginLeft: 8,
    minWidth: 100,
  },
  inputCard: {
    borderRadius: 16,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  inputIcon: {
    marginRight: 16,
  },
  textInput: {
    fontSize: 16,
    flex: 1,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    marginTop: 24,
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splitMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    backgroundColor: 'transparent',
  },
  splitInput: {
    width: 80,
    height: 36,
    borderWidth: 1,
    borderRadius: 8,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  payerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    marginRight: 10,
    gap: 8,
  },
  avatarMini: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    marginTop: 40,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
