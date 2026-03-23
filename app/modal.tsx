import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator, Platform, KeyboardAvoidingView } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { useUserStore } from '@/src/store/useUserStore';
import { useExpenseStore } from '@/src/store/useExpenseStore';
import { db } from '@/src/services/firebaseConfig';
import { getGroups, addExpense } from '@/src/services/expenseService';
import { doc, getDoc } from 'firebase/firestore';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { X, Receipt, Tag, Users, Wallet, Check } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';

import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon } from 'lucide-react-native';

const CATEGORIES = [
  { label: 'Food & Drink', icon: 'utensils' },
  { label: 'Transport', icon: 'car' },
  { label: 'Entertainment', icon: 'film' },
  { label: 'Rent', icon: 'home' },
  { label: 'Groceries', icon: 'shopping-cart' },
  { label: 'General', icon: 'box' },
];

export default function AddExpenseModal() {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [groupId, setGroupId] = useState('');
  const [category, setCategory] = useState('General');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);
  const [image, setImage] = useState<string | null>(null);
  
  const [splitType, setSplitType] = useState<'Equal' | 'Exact' | 'Percentage' | 'Shares'>('Equal');
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [splitDetails, setSplitDetails] = useState<{ [key: string]: number }>({});

  const { user } = useUserStore();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  useEffect(() => {
    if (user) {
      loadGroups();
    }
  }, [user]);

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
        const mIds = gDoc.data().members;
        const mData: any[] = [];
        const initialDetails: { [key: string]: number } = {};
        for (const mId of mIds) {
          const mDoc = await getDoc(doc(db, 'users', mId));
          if (mDoc.exists()) {
            mData.push({ id: mId, ...mDoc.data() });
            initialDetails[mId] = 0;
          }
        }
        setGroupMembers(mData);
        setSplitDetails(initialDetails);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const loadGroups = async () => {
    try {
      const g = await getGroups(user!.uid);
      setGroups(g);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    if (!amount || !description) return;
    const total = parseFloat(amount);
    
    // Validation
    if (splitType === 'Exact') {
      const sum = Object.values(splitDetails).reduce((a, b) => a + b, 0);
      if (Math.abs(sum - total) > 0.1) {
        alert(`Total must be ₹${total}. Current sum: ₹${sum}`);
        return;
      }
    } else if (splitType === 'Percentage') {
      const sum = Object.values(splitDetails).reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 100) > 0.1) {
        alert('Total percentage must be 100%');
        return;
      }
    }

    setLoading(true);
    try {
      const expenseData = {
        amount: parseFloat(amount),
        description,
        groupId,
        category,
        paymentMethod,
        paidBy: user!.uid,
        date: new Date(),
        receiptUrl: image,
        splitType,
        splitDetails,
      };
      await addExpense(expenseData);
      router.back();
    } catch (err) {
      console.error(err);
      alert('Failed to save expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.closeButton}>
          <X size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Add Expense</Text>
        <Pressable onPress={handleSave} disabled={loading} style={styles.doneButton}>
          {loading ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={[styles.doneText, { color: colors.primary }]}>Done</Text>}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.form}>
        <View style={styles.amountSection}>
          <Text style={[styles.label, { color: colors.icon }]}>How much was it?</Text>
          <View style={styles.amountInputContainer}>
            <Text style={[styles.currency, { color: colors.text }]}>₹</Text>
            <TextInput
              style={[styles.amountInput, { color: colors.text }]}
              placeholder="0.00"
              placeholderTextColor={colors.icon}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              autoFocus
            />
          </View>
        </View>

        <View style={styles.inputCard}>
          <View style={[styles.inputRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <Receipt size={20} color={colors.icon} style={styles.inputIcon} />
            <TextInput
              style={[styles.textInput, { color: colors.text }]}
              placeholder="What was it for?"
              placeholderTextColor={colors.icon}
              value={description}
              onChangeText={setDescription}
            />
          </View>
          
          <Pressable onPress={pickImage} style={styles.inputRow}>
            <Camera size={20} color={colors.icon} style={styles.inputIcon} />
            <Text style={{ color: image ? colors.primary : colors.icon, fontSize: 16 }}>
              {image ? 'Receipt Attached ✓' : 'Add Bill Photo'}
            </Text>
          </Pressable>

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
                  <Text style={[styles.categoryText, { color: category === cat.label ? '#fff' : colors.text }]}>
                    {cat.label}
                  </Text>
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

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.icon }]}>Paid By & Split</Text>
          <View style={[styles.inputCard, { padding: 16 }]}>
            <View style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>You</Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: '500', marginLeft: 12 }}>Paid by you</Text>
            </View>
            
            <View style={{ marginTop: 16, backgroundColor: 'transparent' }}>
              <Text style={[styles.label, { fontSize: 14, color: colors.icon }]}>Split Options:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
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
            </View>

            {splitType !== 'Equal' && groupMembers.length > 0 && (
              <View style={{ marginTop: 20, backgroundColor: 'transparent' }}>
                <Text style={[styles.label, { fontSize: 14, color: colors.icon, marginBottom: 12 }]}>
                  Specify {splitType === 'Exact' ? 'Amounts' : splitType === 'Percentage' ? 'Percentages' : 'Shares'}:
                </Text>
                {groupMembers.map((member) => (
                  <View key={member.id} style={[styles.splitMemberRow, { borderBottomColor: colors.border }]}>
                    <Text style={{ color: colors.text, flex: 1 }}>{member.displayName}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent' }}>
                      <Text style={{ color: colors.text, marginRight: 4 }}>
                        {splitType === 'Exact' ? '₹' : ''}
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
                      <Text style={{ color: colors.text, marginLeft: 4 }}>
                        {splitType === 'Percentage' ? '%' : splitType === 'Shares' ? 'sh' : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.icon }]}>Group</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Pressable 
              onPress={() => setGroupId('')}
              style={[
                styles.categoryChip, 
                { 
                  backgroundColor: groupId === '' ? colors.secondary : colors.cardBg,
                  borderColor: colors.border 
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
});
