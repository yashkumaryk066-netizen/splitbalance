import { useNotification } from '@/components/Notification';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { getPhoneContacts, MobileContact } from '@/src/services/contactService';
import { addMemberToGroup, addPayment, createGhostUser, deleteExpense, deleteGroup, findUserByEmail, findUserByPhone, removeMemberFromGroup } from '@/src/services/expenseService';
import { calculateGroupMetrics } from '@/src/utils/expenseUtils';
import { db } from '@/src/services/firebaseConfig';
import { generateGroupReport } from '@/src/services/pdfService';
import { openUPIPayment } from '@/src/services/paymentService';
import { useUserStore } from '@/src/store/useUserStore';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, where, updateDoc, arrayUnion } from 'firebase/firestore';
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
  const [selectedPayee, setSelectedPayee] = useState<any>(null);
  const [settling, setSettling] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
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
    if (!selectedPayee || !settleAmount || parseFloat(settleAmount) <= 0) {
      showNotification('Please enter a valid amount', 'error');
      return;
    }
    setSettling(true);
    try {
      await addPayment(user!.uid, selectedPayee.id, parseFloat(settleAmount), id as string, user!.displayName || 'You', selectedPayee.displayName);
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

    const optimized: { from: string, to: string, amount: number, toId: string, toVpa?: string }[] = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const amount = Math.min(debtors[i].balance, creditors[j].balance);
      optimized.push({ 
        from: debtors[i].displayName, 
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
    const unsubGroup = onSnapshot(doc(db, 'groups', id as string), async (gSnap) => {
      if (gSnap.exists()) {
        const gData = gSnap.data();
        setGroup(gData);
        
        // Fetch full member details
        const memberIds = gData.members || [];
        const memberData: any[] = [];
        
        // Use Promise.all for faster member fetching
        const mDocs = await Promise.all(
          memberIds.map((mId: string) => getDoc(doc(db, 'users', mId)))
        );
        
        mDocs.forEach((mDoc, index) => {
          if (mDoc.exists()) {
            memberData.push({ id: memberIds[index], ...mDoc.data() });
          } else {
            // Placeholder for missing users
            memberData.push({ id: memberIds[index], displayName: 'Unknown User' });
          }
        });
        setMembers(memberData);
      }
      setLoading(false);
    }, (err) => {
      console.error("Group listen error:", err);
      setLoading(false);
    });

    // 2. Real-time Expenses Listen
    const q = query(collection(db, 'expenses'), where('groupId', '==', id), orderBy('date', 'desc'));
    const unsubExpenses = onSnapshot(q, (qSnap) => {
      setExpenses(qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error("Expense listen error:", err);
    });

    return () => {
      unsubGroup();
      unsubExpenses();
    };
  }, [id]);

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
                {payerName} paid <Text style={{ fontWeight: '700', color: colors.text }}>{settings.currency}{item.amount}</Text>

              </Text>
            </View>
            {item.splitType && (
              <Text style={{ fontSize: 10, color: colors.icon, marginTop: 2, fontStyle: 'italic' }}>
                Split: {item.splitType}
              </Text>
            )}
          </View>
          <View style={styles.expenseStatus}>
            <Text style={[styles.expenseStatusText, { color: statusColor, fontSize: 10 }]}>
              {statusText}
            </Text>
            <Text style={[styles.expenseStatusAmount, { color: statusColor, fontSize: 16 }]}>
              {statusAmount > 0 ? `${settings.currency}${statusAmount.toFixed(0)}` : statusText === 'Not involved' ? '-' : `${settings.currency}0`}

            </Text>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  const handleSettleUpMain = async () => { // Renamed to avoid conflict with modal's handleSettleUp
    const metrics = calculateGroupMetrics(expenses, members);
    const myNet = metrics[user?.uid || ''] || 0;
    
    if (Math.abs(myNet) < 1) {
      showNotification('You are already settled up!', 'info');
      return;
    }

    setLoading(true);
    try {
      // Create a settlement record
      const isOwed = myNet > 0;
      const amount = Math.abs(myNet);
      
      const settlementData = {
        amount,
        description: isOwed ? `Received Payment` : `Paid Group Dues`,
        groupId: id,
        category: 'Settlement',
        paidBy: isOwed ? (members.find(m => m.id !== user?.uid)?.id || 'Other') : user?.uid,
        date: new Date(),
        type: 'settlement',
        splitDetails: {
          [user?.uid || '']: isOwed ? amount : 0,
          // If I was owed 100, the "paidBy" member paid me 100.
          // So the "payer" gets +100 and I (splitDetails) get -100.
          // This balances out.
        }
      };

      await addDoc(collection(db, 'expenses'), settlementData);
      showNotification('Balance Settled!', 'success');
    } catch (err) {
      console.error(err);
      showNotification('Failed to settle up', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async () => {
    try {
      await generateGroupReport(group?.name || 'Group', members, expenses);
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
          <Pressable onPress={() => router.back()} style={{ marginRight: 16 }}>
            <ArrowLeft color={colors.text} size={24} />
          </Pressable>
        ),
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent' }}>
            <Pressable onPress={() => {
              Alert.alert(
                'Group Settings',
                'What would you like to do?',
                [
                  { text: 'Delete Group', style: 'destructive', onPress: () => {
                    Alert.alert(
                      'Delete Group',
                      'Are you sure? This will delete all expenses in this group permanently.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: async () => {
                          try {
                            await deleteGroup(id as string);
                            showNotification('Group deleted', 'success');
                            router.replace('/(tabs)/groups');
                          } catch (err) {
                            showNotification('Failed to delete group', 'error');
                          }
                        }}
                      ]
                    );
                  }},
                  { text: 'Cancel', style: 'cancel' }
                ]
              );
            }}>
              <Filter color={colors.icon} size={24} style={{ marginRight: 16 }} />
            </Pressable>
            <Pressable onPress={() => router.push(`/group/${id}/chat`)}>
              <MessageSquare color={colors.primary} size={24} style={{ marginRight: 16 }} />
            </Pressable>
          </View>
        )
      }} />

      {/* Group Balance Header */}
      <View style={[styles.balanceSection, { borderBottomColor: colors.border }]}>
        <View style={styles.totalRow}>
          <View style={styles.totalItem}>
            <Text style={[styles.totalLabel, { color: colors.icon }]}>Group Total Spend</Text>
            <Text style={styles.totalValue}>{settings.currency}{expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0).toFixed(0)}</Text>

          </View>
          <Pressable onPress={handleSettleUpMain} style={[styles.settleButton, { backgroundColor: colors.primary }]}>
            <Text style={styles.settleText}>Settle Up</Text>
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
                  {myNet >= 0 ? `You are owed ${settings.currency}${myNet.toFixed(0)}` : `You owe ${settings.currency}${Math.abs(myNet).toFixed(0)}`}

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
          <Pressable 
            onPress={() => setSettleModalVisible(true)}
            style={[styles.actionButton, { backgroundColor: colors.gain }]}
          >
            <TrendingUp size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Settle Up</Text>
          </Pressable>
          <Pressable 
            onPress={handleInvite}
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
          >
            <Smartphone size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Invite</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={expenses.filter(e => e.description.toLowerCase().includes(searchQuery.toLowerCase()))}
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
                          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.gain }}>{settings.currency}{d.amount.toFixed(0)}</Text>
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
            <Text style={[styles.emptyText, { color: colors.icon }]}>No expenses yet. Tap "+" to start sharing!</Text>
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
              <Text style={styles.modalTitle}>Record a Payment</Text>
              <Pressable onPress={() => setSettleModalVisible(false)}>
                <X color={colors.text} size={24} />
              </Pressable>
            </View>
            <View style={styles.modalBody}>
              <Text style={[styles.listTitle, { color: colors.icon, marginBottom: 12 }]}>Who are you paying?</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                {members.filter(m => m.id !== user?.uid).map((m) => (
                  <Pressable
                    key={m.id}
                    onPress={() => setSelectedPayee(m)}
                    style={[
                      styles.payeeChip,
                      {
                        backgroundColor: selectedPayee?.id === m.id ? colors.primary : colors.cardBg,
                        borderColor: selectedPayee?.id === m.id ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: selectedPayee?.id === m.id ? '#fff' : colors.text, fontWeight: '600' }}>
                      {m.displayName}
                    </Text>
                    {selectedPayee?.id === m.id && <X size={16} color="#fff" />}
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={[styles.listTitle, { color: colors.icon, marginBottom: 12 }]}>Amount</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Enter amount"
                placeholderTextColor={colors.icon}
                keyboardType="numeric"
                value={settleAmount}
                onChangeText={setSettleAmount}
              />

              <Pressable
                style={[styles.actionButton, { backgroundColor: colors.primary }]}
                onPress={handleSettleUp}
                disabled={settling || !selectedPayee || !settleAmount}
              >
                {settling ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>Record Payment</Text>}
              </Pressable>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
