import { useNotification } from '@/components/Notification';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { getPhoneContacts, MobileContact } from '@/src/services/contactService';
import { addMemberToGroup, addPayment, closeCurrentCycle, createGhostUser, deleteExpense, deleteGroup, findUserByEmail, findUserByPhone, removeMemberFromGroup, getGroupCycles, reopenCycle } from '@/src/services/expenseService';
import { calculateGroupMetrics } from '@/src/utils/expenseUtils';
import { db } from '@/src/services/firebaseConfig';
import { generateGroupReport } from '@/src/services/pdfService';
import { openUPIPayment } from '@/src/services/paymentService';
import { useUserStore } from '@/src/store/useUserStore';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, where, updateDoc, arrayUnion } from 'firebase/firestore';
import { evaluateAmountString } from '@/src/utils/formatters';
import { ArrowLeft, Contact, CreditCard, Download, Filter, MessageSquare, Plus, Receipt, Smartphone, TrendingUp, UserPlus, Wallet, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Platform, Pressable, FlatList as RNFlatList, ScrollView, StyleSheet, TextInput, Share, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams();
  const [group, setGroup] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addMemberModalVisible, setAddMemberModalVisible] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [phoneContacts, setPhoneContacts] = useState<MobileContact[]>([]);
  const [showContacts, setShowContacts] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [settleModalVisible, setSettleModalVisible] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMode, setSettleMode] = useState<'paying' | 'receiving'>('paying');
  const [selectedPayee, setSelectedPayee] = useState<any>(null);
  const [settling, setSettling] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [closingCycle, setClosingCycle] = useState(false);
  const [viewHistory, setViewHistory] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [cycles, setCycles] = useState<any[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [showCyclePicker, setShowCyclePicker] = useState(false);
  
  const { user, settings } = useUserStore();

  const { showNotification } = useNotification();
  const handleInvite = async () => {
    const url = Platform.OS === 'web' 
      ? `${window.location.origin}/join/${id}`
      : `settlestack://join/${id}`;
    
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(url);
        showNotification('Join link copied to clipboard!', 'success');
      } else {
        await Share.share({
          message: `Join our expense group on SettleStack: ${url}`,
          url: url
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSettleUp = async () => {
    const totalSettleAmount = evaluateAmountString(settleAmount);
    if (!selectedPayee || isNaN(totalSettleAmount) || totalSettleAmount <= 0) {
      showNotification('Please enter a valid amount', 'error');
      return;
    }
    setSettling(true);
    try {
      if (settleMode === 'receiving') {
        await addPayment(selectedPayee.id, user!.uid, totalSettleAmount, id as string, group?.currentCycleId || 'uncategorized', selectedPayee.displayName, user!.displayName || 'You');
      } else {
        await addPayment(user!.uid, selectedPayee.id, totalSettleAmount, id as string, group?.currentCycleId || 'uncategorized', user!.displayName || 'You', selectedPayee.displayName);
      }
      showNotification('Payment recorded!', 'success');
      setSettleModalVisible(false);
      setSettleAmount('');
      setSelectedPayee(null);
    } catch (err) {
      showNotification('Failed to record payment', 'error');
    } finally {
      setSettling(false);
    }
  };

  const calculateDebts = () => {
    const balances = calculateGroupMetrics(expenses, members);
    const debtors: any[] = [];
    const creditors: any[] = [];

    Object.entries(balances).forEach(([mId, bal]) => {
      const member = members.find(m => m.id === mId);
      if (!member) return;
      if (bal < -0.1) debtors.push({ ...member, balance: -bal });
      else if (bal > 0.1) creditors.push({ ...member, balance: bal });
    });

    const optimized: { from: string, fromId: string, to: string, amount: number, toId: string, toVpa?: string }[] = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const amount = Math.min(debtors[i].balance, creditors[j].balance);
      optimized.push({ 
        from: debtors[i].displayName, 
        fromId: debtors[i].id,
        to: creditors[j].displayName, 
        amount,
        toId: creditors[j].id,
        toVpa: creditors[j].vpa
      });
      debtors[i].balance -= amount;
      creditors[j].balance -= amount;
      if (debtors[i].balance < 0.1) i++;
      if (creditors[j].balance < 0.1) j++;
    }
    return optimized;
  };
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!id) return;

    setLoading(true);
    
    // 1. Real-time Group & Members Listen
    let unsubExpenses: (() => void) | null = null;

    const unsubGroup = onSnapshot(doc(db, 'groups', id as string), async (gSnap) => {
      if (gSnap.exists()) {
        const gData = gSnap.data();
        setGroup(gData);
        
        // Fetch full member details
        const memberIds = gData.members || [];
        const mDocs = await Promise.all(
          memberIds.map((mId: string) => getDoc(doc(db, 'users', mId)))
        );
        
        const mData = mDocs.map((mDoc, index) => ({
          id: memberIds[index],
          ...(mDoc.exists() ? mDoc.data() : { displayName: 'Unknown User' })
        }));
        setMembers(mData);

        // Fetch Cycles
        const allCycles = await getGroupCycles(id as string);
        setCycles(allCycles);
        if (!selectedCycleId && !viewHistory) {
          setSelectedCycleId(gData.currentCycleId || null);
        }

        // --- AUTOMATION: Detect if month has changed ---
        const lastCycle = allCycles.length > 0 ? allCycles[0] as any : null; // Sorted desc
        const currentMonthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
        
        if (lastCycle && lastCycle.status === 'OPEN' && lastCycle.name !== currentMonthName) {
           // Auto-suggestion: A new month is detected
           Alert.alert(
             'New Month Detected!',
             `It is now ${currentMonthName}. Would you like to close the cycle for ${lastCycle.name} and carry-forward the balances?`,
             [
               { text: 'Later', style: 'cancel' },
               { text: 'Yes, Close & Carry Dues', onPress: confirmCloseCycle }
             ]
           );
        }
        // ----------------------------------------------

        // 2. Real-time Expenses Listen
        if (unsubExpenses) unsubExpenses();
        
        let expensesRef = collection(db, 'expenses');
        let expenseQuery;
        
        if (viewHistory) {
          expenseQuery = query(expensesRef, where('groupId', '==', id), orderBy('date', 'desc'));
        } else {
          const cycleToUse = selectedCycleId || gData.currentCycleId;
          if (cycleToUse) {
            expenseQuery = query(expensesRef, where('groupId', '==', id), where('cycleId', '==', cycleToUse), orderBy('date', 'desc'));
          } else {
            expenseQuery = query(expensesRef, where('groupId', '==', id), orderBy('date', 'desc'));
          }
        }

        unsubExpenses = onSnapshot(expenseQuery, (qSnap) => {
          setExpenses(qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (err) => {
          console.error("Expense listen error:", err);
        });
      }
      setLoading(false);
    });

    return () => {
      unsubGroup();
      if (unsubExpenses) unsubExpenses();
    };
  }, [id, viewHistory, selectedCycleId]);

  const loadData = () => {
    // Legacy call - listeners handle it now
  };

  const renderExpense = ({ item, index }: { item: any, index: number }) => {
    const isPaidByMe = item.paidBy === user?.uid;
    const payer = members.find(m => m.id === item.paidBy);
    const payerName = isPaidByMe ? 'You' : (payer?.displayName || 'Someone');
    
    // Get how much the CURRENT user owes or is owed for this specific expense
    const myShare = item.splitDetails?.[user?.uid || ''] || 0;
    const isInvolved = item.splitDetails && Object.keys(item.splitDetails).includes(user?.uid || '');
    
    let statusText = '';
    let statusAmount = 0;
    let statusColor = colors.icon;

    if (isPaidByMe) {
      // I paid, so I'm owed the sum of what others owe for this bill
      statusAmount = item.amount - (item.splitDetails?.[user?.uid || ''] || 0);
      statusText = statusAmount > 0 ? 'You are owed' : 'Settled';
      statusColor = colors.gain;
    } else if (isInvolved && myShare > 0) {
      // Someone else paid, and I owe my share
      statusAmount = myShare;
      statusText = 'You owe';
      statusColor = colors.debt;
    } else {
      statusText = 'Not involved';
      statusColor = colors.icon;
    }

    const dateObj = item.date?.toDate ? item.date.toDate() : item.date ? new Date(item.date) : new Date();
    const monthLabel = dateObj.toLocaleString('default', { month: 'short' });
    const dayLabel = dateObj.getDate();

    const handleExpenseOptions = () => {
      Alert.alert(
        'Expense Options',
        'What would you like to do?',
        [
          { text: 'Edit', onPress: () => router.push({ pathname: '/modal', params: { expenseId: item.id } }) },
          { text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              await deleteExpense(item.id);
              showNotification('Expense deleted', 'success');
            } catch (err) {
              showNotification('Failed to delete expense', 'error');
            }
          }},
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    };

    return (
      <Animated.View entering={FadeInUp.delay(index * 100)} style={[styles.expenseCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        <Pressable 
          onLongPress={handleExpenseOptions}
          onPress={() => setSelectedExpense(item)}
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1, backgroundColor: 'transparent' }}
        >
          <View style={[styles.expenseDateContainer, { backgroundColor: colors.primary + '10' }]}>
            <Text style={[styles.expenseDateMonth, { color: colors.primary }]}>{monthLabel}</Text>
            <Text style={styles.expenseDateDay}>{dayLabel}</Text>
          </View>
          <View style={styles.expenseInfo}>
            <Text style={styles.expenseTitle}>{item.description}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent' }}>
              <Text style={[styles.expenseSub, { color: colors.icon }]}>
                 {item.type === 'carryForward' ? (
                   <Text style={{ fontWeight: '500' }}>Balance from previous cycle</Text>
                 ) : (
                   `${payerName} paid `
                 )}
                 {item.type !== 'carryForward' && <Text style={{ fontWeight: '700', color: colors.text }}>{settings.currency}{item.amount}</Text>}
              </Text>
            </View>
            {item.splitType && (
              <Text style={{ fontSize: 10, color: colors.icon, marginTop: 2, fontStyle: 'italic' }}>
                Mode: {item.splitType}
              </Text>
            )}
          </View>
          <View style={styles.expenseStatus}>
            <Text style={[styles.expenseStatusText, { color: statusColor, fontSize: 10 }]}>
              {statusText}
            </Text>
            <Text style={[styles.expenseStatusAmount, { color: statusColor, fontSize: 16 }]}>
              {statusAmount > 0 ? `${settings.currency}${statusAmount.toFixed(2)}` : statusText === 'Not involved' ? '-' : `${settings.currency}0`}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  const handleCloseMonth = () => {
    setShowCloseModal(true);
  };

  const confirmCloseCycle = async () => {
    const cycleName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    setClosingCycle(true);
    try {
      await closeCurrentCycle(id as string, members, expenses, cycleName);
      showNotification('New cycle started! Old dues carried forward.', 'success');
      setShowCloseModal(false);
    } catch (err) {
      showNotification('Failed to close cycle', 'error');
    } finally {
      setClosingCycle(false);
    }
  };

  const handleSettleUpMain = async () => {
    const metrics = calculateGroupMetrics(expenses, members);
    const myNet = metrics[user?.uid || ''] || 0;
    
    if (Math.abs(myNet) < 0.1) {
      showNotification('You are already settled up!', 'info');
      return;
    }

    const mode = myNet > 0 ? 'receiving' : 'paying';
    setSettleMode(mode);

    const myDebts = calculateDebts().filter(d => 
       mode === 'paying' ? d.fromId === user?.uid : d.toId === user?.uid
    );
    
    if (myDebts.length > 0) {
      const highestDebt = myDebts.sort((a, b) => b.amount - a.amount)[0];
      const payee = members.find(m => m.id === (mode === 'paying' ? highestDebt.toId : highestDebt.fromId));
      setSelectedPayee(payee);
      setSettleAmount(highestDebt.amount.toFixed(2));
    } else {
      // Fallback if no direct optimized debt is found (rare)
      setSelectedPayee(members.filter(m => m.id !== user?.uid)[0]);
      setSettleAmount(Math.abs(myNet).toFixed(2));
    }
    setSettleModalVisible(true);
  };

  const handleDownloadReport = async () => {
    try {
      const cycleToReport = cycles.find(c => c.id === selectedCycleId);
      await generateGroupReport(`${group?.name}${cycleToReport ? ' - ' + cycleToReport.name : ''}`, members, expenses, settings.currency);
      showNotification('Report generated!', 'success');
    } catch (err) {
      showNotification('Failed to generate report', 'error');
    }
  };

  const handleAddMember = async () => {
    if (!memberEmail || !group) {
      if (!group) showNotification('Group not loaded', 'error');
      return;
    }
    const input = memberEmail.trim();
    setAddingMember(true);
    
    try {
      let foundUser = null;
      
      // Check if input is likely a phone number
      const isPhone = /^[0-9+()-\s]+$/.test(input) && input.replace(/[^\d]/g, '').length >= 10;
      
      if (isPhone) {
        const cleanPhone = input.replace(/[^\d]/g, '').slice(-10);
        foundUser = await findUserByPhone(cleanPhone);
      } else {
        foundUser = await findUserByEmail(input);
      }

      if (foundUser) {
        const userData = foundUser as any;
        if (group.members.includes(userData.id)) {
          showNotification('User is already a member!', 'info');
        } else {
          await addMemberToGroup(id as string, userData.id);
          showNotification(`${userData.displayName || 'User'} added!`, 'success');
          setAddMemberModalVisible(false);
          setMemberEmail('');
        }
      } else {
        // Handle no user found: Create Ghost
        const displayName = isPhone ? input : input.split('@')[0];
        const ghost = await createGhostUser(displayName, input);
        await addMemberToGroup(id as string, ghost.id);
        showNotification(`${displayName} added as Guest!`, 'success');
        setAddMemberModalVisible(false);
        setMemberEmail('');
      }
    } catch (err) {
      console.error('Add member error:', err);
      showNotification('Could not add member. Please try again.', 'error');
    } finally {
      setAddingMember(false);
    }
  };

  const loadPhoneContacts = async () => {
    if (Platform.OS === 'web') {
      showNotification('Contacts are only available on Android & iOS apps', 'info');
      return;
    }
    setLoading(true);
    const contacts = await getPhoneContacts();
    if (contacts.length === 0) {
      showNotification('No contacts found or permission denied', 'error');
    } else {
      setPhoneContacts(contacts);
      setShowContacts(true);
    }
    setLoading(false);
  };

  const handleAddContact = async (contact: MobileContact) => {
    if (!contact.phoneNumber || !group) {
      if (!group) showNotification('Group not loaded', 'error');
      return;
    }
    
    setAddingMember(true);
    try {
      // Robust phone normalization: keep only last 10 digits
      const cleanPhone = contact.phoneNumber.replace(/[^\d]/g, '').slice(-10);
      let foundUser = await findUserByPhone(cleanPhone);
      
      if (!foundUser) {
        // Create ghost with full number prefix but search was optimized
        foundUser = await createGhostUser(contact.name, contact.phoneNumber);
      }
      
      if (group.members.includes(foundUser.id)) {
        showNotification('User is already a member!', 'info');
        setAddMemberModalVisible(false);
        setShowContacts(false);
      } else {
        await addMemberToGroup(id as string, foundUser.id);
        setShowContacts(false);
        setAddMemberModalVisible(false);
        showNotification(`${contact.name} added!`, 'success');
      }
    } catch (err) {
      console.error('Error adding contact:', err);
      showNotification('Failed to add contact', 'error');
    } finally {
      setAddingMember(false);
    }
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ 
        title: group?.name || 'Group', 
        headerShown: true,
        headerLeft: () => (
          <Pressable onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/groups');
            }
          }} style={{ marginRight: 16 }}>
            <ArrowLeft color={colors.text} size={24} />
          </Pressable>
        ),
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent' }}>
            <Pressable onPress={() => router.push(`/group/${id}/chat`)}>
              <MessageSquare color={colors.primary} size={24} style={{ marginRight: 16 }} />
            </Pressable>
            <Pressable onPress={() => {
              const options = [
                { text: 'Cycle History', onPress: () => setShowCyclePicker(true) },
                { text: 'Download Month Report', onPress: handleDownloadReport },
                { text: 'Invite Member', onPress: handleInvite },
                { text: 'Leave Group', style: 'destructive' as const, onPress: () => {
                  const metrics = calculateGroupMetrics(expenses, members);
                  const myNet = metrics[user?.uid || ''] || 0;
                  if (Math.abs(myNet) > 0.1) {
                    Alert.alert('Cannot Leave', 'Please settle your balances (you owe or are owed money) before leaving the group.');
                    return;
                  }
                  Alert.alert('Leave Group', 'Are you sure you want to leave this group?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Leave', style: 'destructive', onPress: async () => {
                       try {
                         await removeMemberFromGroup(id as string, user!.uid);
                         router.replace('/(tabs)/groups');
                       } catch (e) {
                         showNotification('Failed to leave group', 'error');
                       }
                    }}
                  ]);
                }},
                { text: 'Delete Group', style: 'destructive' as const, onPress: () => {
                  Alert.alert('Delete Group', 'This will erase ALL data, expenses, and cycles. Continue?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: async () => {
                      try {
                        await deleteGroup(id as string);
                        showNotification('Group deleted', 'success');
                        router.replace('/(tabs)/groups');
                      } catch (e) {
                        showNotification('Failed to delete group (Maybe too many expenses, or permissions)', 'error');
                      }
                    }}
                  ]);
                }},
                { text: 'Cancel', style: 'cancel' as const }
              ];
              
              Alert.alert('Group Settings', 'Manage your group', options);
            }}>
              <Filter color={colors.icon} size={24} style={{ marginRight: 16 }} />
            </Pressable>
          </View>
        )
      }} />

      {/* Group Balance Header */}
      <View style={[styles.balanceSection, { borderBottomColor: colors.border }]}>
        <View style={styles.totalRow}>
          <View style={styles.totalItem}>
            <Text style={[styles.totalLabel, { color: colors.icon }]}>Group Total Spend</Text>
            <Text style={styles.totalValue}>{settings.currency}{expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0).toFixed(2)}</Text>
          </View>
          {(() => {
            const metrics = calculateGroupMetrics(expenses, members);
            const myNet = metrics[user?.uid || ''] || 0;
            if (Math.abs(myNet) >= 0.1) {
              return (
                <Pressable onPress={handleSettleUpMain} style={[styles.settleButton, { backgroundColor: colors.primary }]}>
                  <Text style={styles.settleText}>Settle Up</Text>
                </Pressable>
              );
            }
            return null;
          })()}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, backgroundColor: 'transparent' }}>
           <Pressable onPress={() => setShowCyclePicker(true)} style={{ flex: 1 }}>
             <Text style={[styles.totalLabel, { color: colors.icon, marginBottom: 0 }]}>
                {viewHistory ? 'All History' : cycles.find(c => c.id === selectedCycleId)?.name || 'Current Cycle'} ⌄
             </Text>
           </Pressable>
           <Pressable onPress={() => setViewHistory(!viewHistory)} style={{ backgroundColor: colors.primary + '10', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
             <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>{viewHistory ? 'Switch to Cycle' : 'View All Time'}</Text>
           </Pressable>
        </View>
        
        <View style={styles.debtTiles}>
          {(() => {
            const metrics = calculateGroupMetrics(expenses, members);
            const myNet = metrics[user?.uid || ''] || 0;
            return (
              <View style={[styles.debtTile, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                {myNet >= 0 ? <TrendingUp size={16} color={colors.gain} /> : <TrendingUp size={16} color={colors.debt} style={{ transform: [{ rotate: '180deg'}] }} />}
                <Text style={[styles.debtTileText, { color: myNet >= 0 ? colors.gain : colors.debt }]}>
                  {myNet >= 0 ? `You are owed ${settings.currency}${myNet.toFixed(2)}` : `You owe ${settings.currency}${Math.abs(myNet).toFixed(2)}`}

                </Text>
              </View>
            );
          })()}
          <Pressable onPress={handleDownloadReport} style={[styles.debtTile, { backgroundColor: colors.cardBg, borderColor: colors.border, marginLeft: 10 }]}>
            <Download size={16} color={colors.primary} />
            <Text style={[styles.debtTileText, { color: colors.primary }]}>Report</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 20, backgroundColor: 'transparent' }}>
          {(() => {
            const metrics = calculateGroupMetrics(expenses, members);
            const myNet = metrics[user?.uid || ''] || 0;
            if (Math.abs(myNet) >= 0.1) {
               return (
                  <Pressable 
                    onPress={handleSettleUpMain}
                    style={[styles.actionButton, { backgroundColor: myNet >= 0 ? colors.gain : colors.gain }]}
                  >
                    <TrendingUp size={18} color="#fff" />
                    <Text style={styles.actionButtonText}>{myNet >= 0 ? 'Receive Cash' : 'Settle Up'}</Text>
                  </Pressable>
               );
            }
            return null;
          })()}
          <Pressable 
            onPress={handleInvite}
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
          >
            <Smartphone size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Invite</Text>
          </Pressable>
          <Pressable 
            onPress={handleCloseMonth}
            style={[styles.actionButton, { backgroundColor: colors.secondary }]}
            disabled={closingCycle}
          >
            {closingCycle ? <ActivityIndicator color="#fff" size="small" /> : <TrendingUp size={18} color="#fff" />}
            <Text style={styles.actionButtonText}>Close Month</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={expenses.filter(e => {
          const query = searchQuery.toLowerCase();
          const payer = members.find(m => m.id === e.paidBy);
          return (
            e.description.toLowerCase().includes(query) ||
            (payer?.displayName || '').toLowerCase().includes(query) ||
            (e.category || '').toLowerCase().includes(query) ||
            String(e.amount).includes(query)
          );
        })}
        renderItem={renderExpense}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.listHeaderContainer}>
            <View style={[styles.searchContainer, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
               <TextInput 
                 style={[styles.searchInput, { color: colors.text }]}
                 placeholder="Search expenses..."
                 placeholderTextColor={colors.icon}
                 value={searchQuery}
                 onChangeText={setSearchQuery}
               />
               {searchQuery ? <Pressable onPress={() => setSearchQuery('')}><X size={16} color={colors.icon} /></Pressable> : null}
            </View>
            {calculateDebts().length > 0 && (
              <View style={[styles.card, { marginTop: 16, backgroundColor: colors.primary + '08', padding: 16, borderRadius: 16 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, backgroundColor: 'transparent' }}>
                  <TrendingUp size={16} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '800', textTransform: 'uppercase' }}>Simplified Settlement</Text>
                </View>
                {calculateDebts().map((d, i) => {
                  const isViewerDebtor = d.from.toLowerCase() === 'you' || d.from === user?.displayName;
                  return (
                    <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, backgroundColor: 'transparent' }}>
                      <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                        <Text style={{ fontSize: 14, color: colors.text }}>
                          <Text style={{ fontWeight: '700' }}>{d.from}</Text> owes <Text style={{ fontWeight: '700' }}>{d.to}</Text>
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'transparent' }}>
                          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.gain }}>{settings.currency}{d.amount.toFixed(2)}</Text>
                          {d.toVpa && isViewerDebtor && (
                              <Pressable 
                                  onPress={async () => {
                                      const success = await openUPIPayment({
                                          vpa: d.toVpa!,
                                          name: d.to,
                                          amount: d.amount,
                                          note: `Settling in ${group?.name}`
                                      });
                                      if (!success) showNotification('Could not open UPI app', 'error');
                                  }}
                                  style={{ backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
                              >
                                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>PAY UPI</Text>
                              </Pressable>
                          )}
                      </View>
                    </View>
                  );
                })}
                <Text style={{ fontSize: 10, color: colors.icon, marginTop: 4, fontStyle: 'italic' }}>* Calculations minimize the number of required payments.</Text>
              </View>
            )}

            <View style={styles.membersSection}>
              <Text style={[styles.listTitle, { color: colors.icon, marginBottom: 12 }]}>Group Members</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', backgroundColor: 'transparent' }}>
                <Pressable 
                  onPress={() => setAddMemberModalVisible(true)}
                  style={[styles.memberCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary, borderStyle: 'dashed' }]}
                >
                  <UserPlus color={colors.primary} size={20} />
                  <Text style={[styles.memberName, { color: colors.primary, fontSize: 12, marginTop: 4 }]}>Add New</Text>
                </Pressable>
                {members.map((m) => {
                  const displayName = m.displayName || 'Unknown';
                  const isMe = m.id === user?.uid;
                  return (
                    <Pressable 
                      key={m.id} 
                      onLongPress={() => {
                        if (isMe) return; // Can't remove yourself from here (maybe add "Leave Group" later)
                        Alert.alert(
                          'Manage Member',
                          `Remove ${displayName} from group?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Remove', style: 'destructive', onPress: async () => {
                              try {
                                await removeMemberFromGroup(id as string, m.id);
                                showNotification('Member removed', 'success');
                              } catch (err) {
                                showNotification('Failed to remove member', 'error');
                              }
                            }}
                          ]
                        );
                      }}
                      style={styles.memberCard}
                    >
                      <View style={[styles.memberAvatar, { backgroundColor: colors.secondary + '20', overflow: 'hidden' }]}> 
                        {m.photoURL ? (
                          <Image source={{ uri: m.photoURL }} style={{ width: '100%', height: '100%' }} />
                        ) : (
                          <Text style={{ fontWeight: 'bold', color: colors.secondary }}>{displayName[0]}</Text>
                        )}
                      </View>
                      <Text numberOfLines={1} style={[styles.memberName, { color: colors.text, fontSize: 12, marginTop: 4 }]}> 
                        {isMe ? 'You' : `${displayName}${m.isGhost ? ' (Guest)' : ''}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.listHeader}>
              <Text style={[styles.listTitle, { color: colors.icon }]}>Recent Expenses</Text>
              <Filter size={20} color={colors.icon} />
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Receipt size={48} color={colors.icon} style={{ opacity: 0.3, marginBottom: 16 }} />
            <Text style={[styles.emptyText, { color: colors.icon, fontWeight: '700' }]}>
               {searchQuery ? 'No matching expenses found' : 
                viewHistory ? 'No group history found yet' : 
                `New cycle started for ${cycles.find(c => c.id === selectedCycleId)?.name || 'this month'}!`}
            </Text>
            <Text style={[styles.emptyText, { color: colors.icon, fontSize: 12, marginTop: 4 }]}>
               {searchQuery ? 'Try a different search term' : 'Tap the "+" button to record a new expense.'}
            </Text>
          </View>
        }
      />

      <Modal
        animationType="slide"
        transparent={true}
        visible={addMemberModalVisible}
        onRequestClose={() => setAddMemberModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Member by Email</Text>
              <Pressable onPress={() => setAddMemberModalVisible(false)}>
                <X color={colors.text} size={24} />
              </Pressable>
            </View>
            <View style={styles.modalBody}>
              {!showContacts ? (
                <>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                    placeholder="Enter email or phone number"
                    placeholderTextColor={colors.icon}
                    value={memberEmail}
                    onChangeText={setMemberEmail}
                    autoCapitalize="none"
                    autoFocus
                  />
                  <Pressable 
                    style={[styles.actionButton, { backgroundColor: colors.primary, marginBottom: 12 }]}
                    onPress={handleAddMember}
                    disabled={addingMember}
                  >
                    {addingMember ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>Add to Group</Text>}
                  </Pressable>
                  <Pressable 
                    style={[styles.secondaryButton, { borderColor: colors.primary }]}
                    onPress={loadPhoneContacts}
                  >
                    <Contact size={20} color={colors.primary} />
                    <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Select from Contacts</Text>
                  </Pressable>
                </>
              ) : (
                <View style={{ backgroundColor: 'transparent' }}>
                  <TextInput
                    style={[styles.input, { height: 44, marginBottom: 12, fontSize: 14, color: colors.text, borderColor: colors.border }]}
                    placeholder="Search contacts..."
                    placeholderTextColor={colors.icon}
                    value={contactSearch}
                    onChangeText={setContactSearch}
                  />
                  <RNFlatList
                    data={phoneContacts.filter(c => 
                      c.name.toLowerCase().includes(contactSearch.toLowerCase()) || 
                      c.phoneNumber?.includes(contactSearch)
                    )}
                    keyExtractor={item => item.id}
                    style={{ maxHeight: 400 }}
                    renderItem={({ item }) => {
                      // Check if already in group (best effort search)
                      const cleanPhone = item.phoneNumber?.replace(/[^\d]/g, '').slice(-10);
                      const isAlreadyIn = members.some(m => 
                        (m.phoneNumber || '').replace(/[^\d]/g, '').endsWith(cleanPhone || 'NOMATCH')
                      );

                      return (
                        <Pressable 
                          style={[styles.contactRow, { borderBottomColor: colors.border, opacity: isAlreadyIn ? 0.5 : 1 }]}
                          onPress={() => !isAlreadyIn && handleAddContact(item)}
                        >
                          <View style={[styles.memberAvatar, { width: 36, height: 36, marginRight: 12 }]}>
                            <Text style={{ fontSize: 14 }}>{item.name[0]}</Text>
                          </View>
                          <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                            <Text style={{ color: colors.text, fontWeight: '600' }}>{item.name}</Text>
                            <Text style={{ color: colors.icon, fontSize: 12 }}>{item.phoneNumber}</Text>
                          </View>
                          {isAlreadyIn && (
                            <View style={{ backgroundColor: colors.primary + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }}>
                              <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '700' }}>IN GROUP</Text>
                            </View>
                          )}
                        </Pressable>
                      );
                    }}
                    ListHeaderComponent={
                      <Pressable onPress={() => { setShowContacts(false); setContactSearch(''); }} style={{ marginBottom: 16 }}>
                        <Text style={{ color: colors.primary }}>← Back to Manual</Text>
                      </Pressable>
                    }
                  />
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Settle Up Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={settleModalVisible}
        onRequestClose={() => setSettleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{settleMode === 'receiving' ? 'Record a Receipt' : 'Record a Payment'}</Text>
              <Pressable onPress={() => setSettleModalVisible(false)}>
                <X color={colors.text} size={24} />
              </Pressable>
            </View>
            <View style={styles.modalBody}>
              <Text style={[styles.listTitle, { color: colors.icon, marginBottom: 12 }]}>{settleMode === 'receiving' ? 'Who paid you?' : 'Who are you paying?'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                {members.filter(m => m.id !== user?.uid).map((m) => {
                  const debt = calculateDebts().find(d => 
                    settleMode === 'paying' 
                      ? (d.fromId === user?.uid && d.toId === m.id)
                      : (d.toId === user?.uid && d.fromId === m.id)
                  );
                  const suggestion = debt ? debt.amount : 0;
                  
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => {
                        setSelectedPayee(m);
                        if (suggestion > 0) {
                          setSettleAmount(suggestion.toFixed(2));
                        }
                      }}
                      style={[
                        styles.payeeChip,
                        {
                          backgroundColor: selectedPayee?.id === m.id ? colors.primary : colors.cardBg,
                          borderColor: selectedPayee?.id === m.id ? colors.primary : colors.border,
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          paddingVertical: 10,
                          paddingHorizontal: 16
                        },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ color: selectedPayee?.id === m.id ? '#fff' : colors.text, fontWeight: '600' }}>
                          {m.displayName}
                        </Text>
                        {selectedPayee?.id === m.id && <X size={14} color="#fff" />}
                      </View>
                      {suggestion > 0 && (
                        <Text style={{ fontSize: 11, color: selectedPayee?.id === m.id ? '#ffffffCC' : colors.gain, marginTop: 4, fontWeight: '600' }}>
                          {settleMode === 'receiving' ? 'Expect' : 'Owe'}: {settings.currency}{suggestion.toFixed(2)}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text style={[styles.listTitle, { color: colors.icon, marginBottom: 12 }]}>Amount</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Enter amount"
                placeholderTextColor={colors.icon}
                keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
                value={settleAmount}
                onChangeText={setSettleAmount}
              />
              {settleAmount.match(/[+\-*/]/) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary + '10', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 12 }}>
                    <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>Sum: {settings.currency}{evaluateAmountString(settleAmount).toFixed(2)}</Text>
                </View>
              )}

              <Pressable
                style={[styles.actionButton, { backgroundColor: colors.primary }]}
                onPress={handleSettleUp}
                disabled={settling || !selectedPayee || !settleAmount}
              >
                {settling ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>{settleMode === 'receiving' ? 'Record Receipt' : 'Record Payment'}</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cycle Closing Summary Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showCloseModal}
        onRequestClose={() => setShowCloseModal(false)}
      >
        <View style={styles.modalOverlay}>
           <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowCloseModal(false)} />
           <View style={[styles.modalContent, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 24), borderTopLeftRadius: 32, borderTopRightRadius: 32 }]}>
              <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />
              <View style={styles.modalHeader}>
                 <Text style={styles.modalTitle}>Cycle Summary</Text>
                 <Pressable onPress={() => setShowCloseModal(false)} style={{ padding: 8 }}>
                    <X size={24} color={colors.text} />
                 </Pressable>
              </View>

              <ScrollView style={styles.modalBody}>
                 <View style={{ marginBottom: 24, backgroundColor: 'transparent', gap: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'transparent' }}>
                       <Text style={{ color: colors.icon }}>Total Group Spending</Text>
                       <Text style={{ color: colors.text, fontWeight: '700' }}>{settings.currency}{expenses.reduce((a, b) => a + (b.amount || 0), 0).toFixed(2)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'transparent' }}>
                       <Text style={{ color: colors.icon }}>Expenses Tracked</Text>
                       <Text style={{ color: colors.text, fontWeight: '700' }}>{expenses.length}</Text>
                    </View>
                 </View>

                 <Text style={[styles.listTitle, { color: colors.icon, marginBottom: 16 }]}>Carry Forward Dues</Text>
                 <View style={[styles.card, { backgroundColor: colors.primary + '05', borderColor: colors.primary + '20', marginBottom: 24 }]}>
                    {(() => {
                      const metrics = calculateGroupMetrics(expenses, members);
                      const nonZeroMembers = Object.entries(metrics).filter(([_, bal]) => Math.abs(bal) > 0.1);
                      
                      if (nonZeroMembers.length === 0) {
                        return <Text style={{ padding: 12, textAlign: 'center', color: colors.icon }}>Everyone is perfectly settled!</Text>;
                      }

                      return nonZeroMembers.map(([mid, bal]) => {
                        const m = members.find(u => u.id === mid);
                        return (
                          <View key={mid} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border + '20', backgroundColor: 'transparent' }}>
                             <View style={[styles.memberAvatar, { width: 32, height: 32, marginRight: 12, backgroundColor: bal > 0 ? colors.gain + '20' : colors.debt + '20' }]}>
                                <Text style={{ color: bal > 0 ? colors.gain : colors.debt }}>{m?.displayName?.[0]}</Text>
                             </View>
                             <Text style={{ color: colors.text, flex: 1 }}>{m?.displayName}</Text>
                             <Text style={{ fontWeight: '700', color: bal > 0 ? colors.gain : colors.debt }}>
                                {bal > 0 ? '+' : '-'}{settings.currency}{Math.abs(bal).toFixed(2)}
                             </Text>
                          </View>
                        );
                      });
                    })()}
                 </View>

                 <Text style={{ fontSize: 13, color: colors.icon, marginBottom: 24, textAlign: 'center' }}>
                   Closing this month will archive these expenses and start a fresh list. The dues shown above will be carried forward.
                 </Text>

                 <Pressable 
                   style={[styles.actionButton, { backgroundColor: colors.primary, height: 56 }]}
                   onPress={confirmCloseCycle}
                   disabled={closingCycle}
                 >
                   {closingCycle ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>Start New Cycle</Text>}
                 </Pressable>
              </ScrollView>
           </View>
        </View>
      </Modal>

      {/* Expense Detail Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={!!selectedExpense}
        onRequestClose={() => setSelectedExpense(null)}
      >
        <View style={styles.modalOverlay}>
           <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedExpense(null)} />
           <View style={[styles.modalContent, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 24), borderTopLeftRadius: 32, borderTopRightRadius: 32 }]}>
              <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />
              <View style={styles.modalHeader}>
                 <View style={{ backgroundColor: 'transparent' }}>
                   <Text style={styles.modalTitle}>{selectedExpense?.description}</Text>
                   <Text style={{ color: colors.icon }}>{selectedExpense?.date?.toDate ? selectedExpense?.date?.toDate().toLocaleString() : selectedExpense?.date?.toLocaleString()}</Text>
                 </View>
                 <Pressable onPress={() => setSelectedExpense(null)} style={{ padding: 8 }}>
                    <X size={24} color={colors.text} />
                 </Pressable>
              </View>

              <View style={styles.modalBody}>
                 <View style={{ alignItems: 'center', marginBottom: 24, backgroundColor: 'transparent' }}>
                    <Text style={{ fontSize: 42, fontWeight: '800', color: colors.text }}>{settings.currency}{selectedExpense?.amount}</Text>
                    <Text style={{ color: colors.icon }}>Total Spent</Text>
                 </View>

                 <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border, padding: 16 }]}>
                    <Text style={[styles.listTitle, { color: colors.icon, marginBottom: 16 }]}>Who paid?</Text>
                    {(() => {
                        const paidBy = selectedExpense?.paidBy;
                        if (typeof paidBy === 'string') {
                           const payer = members.find(m => m.id === paidBy);
                           return (
                             <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent' }}>
                               <View style={[styles.memberAvatar, { width: 32, height: 32, marginRight: 12 }]}>
                                  <Text>{payer?.displayName?.[0]}</Text>
                               </View>
                               <Text style={{ color: colors.text, flex: 1, fontWeight: '600' }}>{payer?.displayName || 'Unknown'}</Text>
                               <Text style={{ color: colors.text, fontWeight: '700' }}>{settings.currency}{selectedExpense?.amount}</Text>
                             </View>
                           );
                        } else if (typeof paidBy === 'object' && paidBy !== null) {
                           return Object.entries(paidBy).map(([mid, amt]) => {
                              const payer = members.find(m => m.id === mid);
                              return (
                                <View key={mid} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, backgroundColor: 'transparent' }}>
                                  <View style={[styles.memberAvatar, { width: 32, height: 32, marginRight: 12 }]}>
                                     <Text>{payer?.displayName?.[0]}</Text>
                                  </View>
                                  <Text style={{ color: colors.text, flex: 1 }}>{payer?.displayName || 'Unknown'}</Text>
                                  <Text style={{ color: colors.text, fontWeight: '600' }}>{settings.currency}{amt as number}</Text>
                                </View>
                              );
                           });
                        }
                    })()}
                 </View>

                 <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border, padding: 16, marginTop: 16 }]}>
                    <Text style={[styles.listTitle, { color: colors.icon, marginBottom: 16 }]}>Who owes what?</Text>
                    {Object.entries(selectedExpense?.splitDetails || {}).map(([mid, amt]) => {
                        const member = members.find(m => m.id === mid);
                        return (
                          <View key={mid} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, backgroundColor: 'transparent' }}>
                            <View style={[styles.memberAvatar, { width: 32, height: 32, marginRight: 12, backgroundColor: colors.secondary + '10' }]}>
                               <Text style={{ fontSize: 12 }}>{member?.displayName?.[0]}</Text>
                            </View>
                            <Text style={{ color: colors.text, flex: 1 }}>{member?.displayName || 'Unknown'}</Text>
                            <Text style={{ color: colors.text }}>{settings.currency}{Number(amt).toFixed(2)}</Text>
                          </View>
                        );
                    })}
                 </View>
              </View>
           </View>
        </View>
      </Modal>

      <Pressable 
        style={({ pressed }) => [styles.fab, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}
        onPress={() => router.push({ pathname: '/modal', params: { groupId: id } })}
      >
        <Plus color="#fff" size={28} />
      </Pressable>

      {/* Cycle Picker Modal */}
      <Modal visible={showCyclePicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowCyclePicker(false)} />
          <View style={[styles.modalContent, { backgroundColor: colors.background, maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Cycle</Text>
              <Pressable onPress={() => setShowCyclePicker(false)}><X size={24} color={colors.text} /></Pressable>
            </View>
            <FlatList
              data={cycles}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <Pressable 
                  onPress={() => {
                    setSelectedCycleId(item.id);
                    setViewHistory(false);
                    setShowCyclePicker(false);
                  }}
                  style={{ 
                    padding: 16, 
                    borderBottomWidth:1, 
                    borderBottomColor: colors.border,
                    backgroundColor: selectedCycleId === item.id ? colors.primary + '10' : 'transparent',
                    flexDirection: 'row',
                    justifyContent: 'space-between'
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: selectedCycleId === item.id ? '700' : '400' }}>{item.name}</Text>
                  {item.status === 'CLOSED' && (
                    <Pressable 
                      onPress={async () => {
                        Alert.alert('Re-open Cycle', 'Bring archived expenses back to active?', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Re-open', onPress: async () => {
                             await reopenCycle(id as string, item.id);
                             showNotification('Cycle re-opened!', 'success');
                             setShowCyclePicker(false);
                          }}
                        ]);
                      }}
                      style={{ backgroundColor: colors.secondary + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}
                    >
                      <Text style={{ color: colors.secondary, fontSize: 10, fontWeight: '700' }}>RE-OPEN</Text>
                    </Pressable>
                  )}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
    opacity: 0.3,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceSection: {
    padding: 24,
    borderBottomWidth: 1,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  totalItem: {
    backgroundColor: 'transparent',
  },
  totalLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  settleButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  settleText: {
    color: '#fff',
    fontWeight: '700',
  },
  debtTiles: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
  },
  debtTile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  debtTileText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listHeaderContainer: {
    backgroundColor: 'transparent',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  membersSection: {
    marginBottom: 16,
    backgroundColor: 'transparent',
    marginTop: 16,
  },
  memberCard: {
    alignItems: 'center',
    marginRight: 16,
    width: 60,
    backgroundColor: 'transparent',
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  memberName: {
    textAlign: 'center',
    width: '100%',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: 'transparent',
  },
  listTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  expenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  expenseDateContainer: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  expenseDateMonth: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  expenseDateDay: {
    fontSize: 16,
    fontWeight: '800',
  },
  expenseInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  expenseTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  expenseSub: {
    fontSize: 12,
  },
  expenseStatus: {
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
  },
  expenseStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  expenseStatusAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    backgroundColor: 'transparent',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: 'transparent',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalBody: {
    backgroundColor: 'transparent',
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    flex: 1,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryButton: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    backgroundColor: 'transparent',
  },
  payeeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
      }
    }),
  },
});
