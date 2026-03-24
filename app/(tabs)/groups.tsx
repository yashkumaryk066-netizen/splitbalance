import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, Pressable, RefreshControl, TextInput, Modal, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { useUserStore } from '@/src/store/useUserStore';
import { getGroups, createGroup } from '@/src/services/expenseService';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Users, Plus, ChevronRight, X, Contact, TrendingUp } from 'lucide-react-native';
import Animated, { FadeInRight, Layout } from 'react-native-reanimated';
import { useExpenseStore } from '@/src/store/useExpenseStore';
import { calculateGroupMetrics } from '@/src/services/expenseService';
import { useNotification } from '@/components/Notification';

export default function GroupsScreen() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  
  const { user } = useUserStore();
  const { activities } = useExpenseStore();
  const { showNotification } = useNotification();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();

  useEffect(() => {
    if (user) {
      loadGroups();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadGroups = async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const g = await getGroups(user.uid);
      setGroups(g);
    } catch (err) {
      console.error("Error loading groups:", err);
      // Fallback or alert
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCreateGroup = async () => {
    // Defensive check: ensure group name and user exist
    if (!newGroupName.trim() || !user?.uid) {
      showNotification('Group name cannot be empty', 'error');
      return;
    }
    try {
      await createGroup(newGroupName.trim(), [user.uid]);
      setNewGroupName('');
      setModalVisible(false);
      showNotification('Group created successfully!', 'success');
      loadGroups(); // Reload groups after successful creation
    } catch (err) {
      console.error("Failed to create group:", err);
      showNotification('Failed to create group', 'error');
    }
  };

  const renderGroup = ({ item, index }: { item: any, index: number }) => {
    // Calculate personal balance for this group
    const groupExpenses = activities.filter(a => a.groupId === item.id);
    // Mock members for metrics if they aren't fully loaded here
    const metrics = calculateGroupMetrics(groupExpenses, item.members.map((mId: string) => ({ id: mId })));
    const myNet = metrics[user?.uid || ''] || 0;

    return (
      <Animated.View 
        entering={FadeInRight.delay(index * 100)}
        layout={Layout.springify()}
      >
        <Pressable 
          style={[styles.groupCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
          onPress={() => router.push(`/group/${item.id}`)}
        >
          <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
            <Users color={colors.primary} size={24} />
          </View>
          <View style={styles.groupInfo}>
            <Text style={styles.groupName}>{item.name}</Text>
            <Text style={[styles.groupSubtitle, { color: colors.icon }]}>
              {item.members.length} member{item.members.length > 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.balanceInfo}>
            {Math.abs(myNet) > 0.1 ? (
              <View style={{ backgroundColor: 'transparent', alignItems: 'flex-end' }}>
                <Text style={[styles.balanceLabel, { color: myNet > 0 ? colors.gain : colors.debt }]}>
                  {myNet > 0 ? 'you are owed' : 'you owe'}
                </Text>
                <Text style={[styles.balanceAmount, { color: myNet > 0 ? colors.gain : colors.debt }]}>
                  ₹{Math.abs(myNet).toFixed(0)}
                </Text>
              </View>
            ) : (
              <Text style={[styles.settledText, { color: colors.icon }]}>settled up</Text>
            )}
            <ChevronRight color={colors.icon} size={16} />
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={groups}
        renderItem={renderGroup}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadGroups(); }} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Users size={64} color={colors.icon} style={{ opacity: 0.3, marginBottom: 16 }} />
              <Text style={[styles.emptyText, { color: colors.icon }]}>No groups yet. Start one to share expenses!</Text>
            </View>
          ) : <ActivityIndicator style={{ marginTop: 40 }} />
        }
      />

      <Pressable 
        style={({ pressed }) => [styles.fab, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}
        onPress={() => setModalVisible(true)}
      >
        <Plus color="#fff" size={28} />
      </Pressable>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Group</Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <X color={colors.text} size={24} />
              </Pressable>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={[styles.label, { color: colors.icon }]}>Group Name</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Ex: Roommates, Trip to Bali"
                placeholderTextColor={colors.icon}
                value={newGroupName}
                onChangeText={setNewGroupName}
                autoFocus
              />
              
              <Pressable 
                style={[styles.createButton, { backgroundColor: colors.primary }]}
                onPress={handleCreateGroup}
              >
                <Text style={styles.createButtonText}>Create Group</Text>
              </Pressable>
            </View>
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
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  groupInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  groupName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  groupSubtitle: {
    fontSize: 12,
  },
  balanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'transparent',
  },
  balanceLabel: {
    fontSize: 10,
    textTransform: 'lowercase',
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  settledText: {
    fontSize: 12,
    opacity: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
    paddingHorizontal: 40,
    backgroundColor: 'transparent',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
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
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 24,
  },
  createButton: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
