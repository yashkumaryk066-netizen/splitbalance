import { useNotification } from '@/components/Notification';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { getPhoneContacts, MobileContact } from '@/src/services/contactService';
import { addMemberToGroup, calculateGroupMetrics, createGhostUser, findUserByEmail, findUserByPhone } from '@/src/services/expenseService';
import { db } from '@/src/services/firebaseConfig';
import { generateGroupReport } from '@/src/services/pdfService';
import { useUserStore } from '@/src/store/useUserStore';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { ArrowLeft, Contact, CreditCard, Download, Filter, MessageSquare, Plus, Receipt, Smartphone, TrendingUp, UserPlus, Wallet, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, FlatList as RNFlatList, ScrollView, StyleSheet, TextInput } from 'react-native';
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
  
  const { user } = useUserStore();
  const { showNotification } = useNotification();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();

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
    // Get how much the CURRENT user owes or is owed for this specific expense
    const myShare = item.splitDetails?.[user?.uid || ''] || 0;
    
    let statusText = '';
    let statusAmount = 0;
    let statusColor = colors.icon;

    if (isPaidByMe) {
      // I paid, so I'm owed the sum of what others owe for this bill
      statusAmount = item.amount - myShare;
      statusText = statusAmount > 0 ? 'You are owed' : 'No one owes you';
      statusColor = colors.gain;
    } else if (myShare > 0) {
      // Someone else paid, and I owe my share
      statusAmount = myShare;
      statusText = 'You owe';
      statusColor = colors.debt;
    } else {
      statusText = 'Not involved';
    }

    const dateObj = item.date?.toDate ? item.date.toDate() : item.date ? new Date(item.date) : new Date();
    const monthLabel = dateObj.toLocaleString('default', { month: 'short' });
    const dayLabel = dateObj.getDate();

    return (
      <Animated.View entering={FadeInUp.delay(index * 100)} style={[styles.expenseCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        <View style={[styles.expenseDateContainer, { backgroundColor: colors.primary + '10' }]}>
          <Text style={[styles.expenseDateMonth, { color: colors.primary }]}>{monthLabel}</Text>
          <Text style={styles.expenseDateDay}>{dayLabel}</Text>
        </View>
        <View style={styles.expenseInfo}>
          <Text style={styles.expenseTitle}>{item.description}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent' }}>
            {item.paymentMethod === 'Cash' && <Wallet size={12} color={colors.icon} style={{ marginRight: 4 }} />}
            {item.paymentMethod === 'Credit Card' && <CreditCard size={12} color={colors.icon} style={{ marginRight: 4 }} />}
            {item.paymentMethod === 'UPI' && <Smartphone size={12} color={colors.icon} style={{ marginRight: 4 }} />}
            <Text style={[styles.expenseSub, { color: colors.icon }]}>
              {isPaidByMe ? 'You paid' : 'Someone paid'} ₹{item.amount}
            </Text>
          </View>
        </View>
        <View style={styles.expenseStatus}>
          <Text style={[styles.expenseStatusText, { color: statusColor }]}>
            {statusText}
          </Text>
          <Text style={[styles.expenseStatusAmount, { color: statusColor }]}>
            {statusAmount > 0 ? `₹${statusAmount.toFixed(0)}` : '-'}
          </Text>
        </View>
      </Animated.View>
    );
  };

  const handleSettleUp = async () => {
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
          <Pressable onPress={() => router.push(`/group/${id}/chat`)}>
            <MessageSquare color={colors.primary} size={24} style={{ marginRight: 16 }} />
          </Pressable>
        )
      }} />

      {/* Group Balance Header */}
      <View style={[styles.balanceSection, { borderBottomColor: colors.border }]}>
        <View style={styles.totalRow}>
          <View style={styles.totalItem}>
            <Text style={[styles.totalLabel, { color: colors.icon }]}>Group Total Spend</Text>
            <Text style={styles.totalValue}>₹{expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0).toFixed(0)}</Text>
          </View>
          <Pressable onPress={handleSettleUp} style={[styles.settleButton, { backgroundColor: colors.primary }]}>
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
                  {myNet >= 0 ? `You are owed ₹${myNet.toFixed(0)}` : `You owe ₹${Math.abs(myNet).toFixed(0)}`}
                </Text>
              </View>
            );
          })()}
          <Pressable onPress={handleDownloadReport} style={[styles.debtTile, { backgroundColor: colors.cardBg, borderColor: colors.border, marginLeft: 10 }]}>
            <Download size={16} color={colors.primary} />
            <Text style={[styles.debtTileText, { color: colors.primary }]}>Report</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={expenses}
        renderItem={renderExpense}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.listHeaderContainer}>
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
                  return (
                    <View key={m.id} style={styles.memberCard}>
                      <View style={[styles.memberAvatar, { backgroundColor: colors.secondary + '20' }]}> 
                        <Text style={{ fontWeight: 'bold', color: colors.secondary }}>{displayName[0]}</Text>
                      </View>
                      <Text numberOfLines={1} style={[styles.memberName, { color: colors.text, fontSize: 12, marginTop: 4 }]}> 
                        {m.id === user?.uid ? 'You' : `${displayName}${m.isGhost ? ' (Guest)' : ''}`}
                      </Text>
                    </View>
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
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
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
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  listHeaderContainer: {
    backgroundColor: 'transparent',
  },
  membersSection: {
    marginBottom: 16,
    backgroundColor: 'transparent',
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
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
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
});
