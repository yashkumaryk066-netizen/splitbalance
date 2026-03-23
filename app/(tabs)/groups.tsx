import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, Pressable, RefreshControl, TextInput, Modal, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { useUserStore } from '@/src/store/useUserStore';
import { getGroups, createGroup } from '@/src/services/expenseService';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Users, Plus, ChevronRight, X, Contact } from 'lucide-react-native';
import Animated, { FadeInRight, Layout } from 'react-native-reanimated';

export default function GroupsScreen() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  
  const { user } = useUserStore();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();

  useEffect(() => {
    if (user) loadGroups();
  }, [user]);

  const loadGroups = async () => {
    try {
      const g = await getGroups(user!.uid);
      setGroups(g);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName) return;
    try {
      await createGroup(newGroupName, [user!.uid]);
      setNewGroupName('');
      setModalVisible(false);
      loadGroups();
    } catch (err) {
      console.error(err);
      alert('Failed to create group');
    }
  };

  const renderGroup = ({ item, index }: { item: any, index: number }) => (
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
        <ChevronRight color={colors.icon} size={20} />
      </Pressable>
    </Animated.View>
  );

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
    fontSize: 14,
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
