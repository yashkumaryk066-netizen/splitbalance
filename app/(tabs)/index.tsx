import React, { useEffect } from 'react';
import { StyleSheet, ScrollView, Pressable, FlatList, ListRenderItem, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { useUserStore } from '@/src/store/useUserStore';
import { useExpenseStore } from '@/src/store/useExpenseStore';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Plus, TrendingUp, TrendingDown, Receipt, ArrowRight } from 'lucide-react-native';
import Animated, { FadeInUp, Layout } from 'react-native-reanimated';

export default function HomeDashboard() {
  const { user } = useUserStore();
  const { balance, activities } = useExpenseStore();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();

  const displayActivities = activities;

  const renderActivity: ListRenderItem<any> = ({ item, index }) => {
    const isPaidByMe = item.paidBy === user?.uid;
    const myShare = item.splitDetails?.[user?.uid || ''] || 0;
    const date = item.date?.toDate ? item.date.toDate() : new Date(item.date);
    
    // Calculate how much I am owed (if I paid) or how much I owe (if someone else paid)
    let displayAmount = 0;
    let isPositive = false;

    if (isPaidByMe) {
      displayAmount = item.amount - myShare;
      isPositive = true;
    } else {
      displayAmount = myShare;
      isPositive = false;
    }

    if (displayAmount === 0 && !isPaidByMe) return null; // Not involved

    return (
      <Animated.View 
        entering={FadeInUp.delay(index * 100)} 
        layout={Layout.springify()}
      >
        <Pressable 
          onPress={() => item.groupId ? router.push(`/group/${item.groupId}`) : router.push('/(tabs)/groups')}
          style={({ pressed }) => [styles.activityItem, { backgroundColor: colors.cardBg, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
        >
          <View style={[styles.activityIcon, { backgroundColor: item.type === 'expense' ? colors.primary + '20' : colors.gain + '20' }]}>
            {item.type === 'expense' ? <Receipt size={20} color={colors.primary} /> : <TrendingUp size={20} color={colors.gain} />}
          </View>
          <View style={styles.activityInfo}>
            <Text style={styles.activityTitle}>{item.description}</Text>
            <Text style={[styles.activityDate, { color: colors.icon }]}>{date.toLocaleDateString()}</Text>
          </View>
          <View style={styles.activityAmountContainer}>
            <Text style={[styles.activityAmount, { color: isPositive ? colors.gain : colors.debt }]}>
              {isPositive ? `+₹${displayAmount.toFixed(0)}` : `-₹${displayAmount.toFixed(0)}`}
            </Text>
            <Text style={[styles.activityPaidBy, { color: colors.icon }]}>
              {isPaidByMe ? 'You paid' : 'You owe'}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    );
  };


  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Header Summary Card */}
        <Animated.View entering={FadeInUp.duration(600)} style={[styles.summaryCard, { backgroundColor: colors.primary }]}>
          <Text style={styles.summaryLabel}>Total Net Balance</Text>
          <Text style={styles.summaryValue}>₹{balance.owed - balance.owe}</Text>
          
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <View style={styles.summaryIconContainer}>
                <TrendingUp size={16} color={colors.gain} />
              </View>
              <View style={{ backgroundColor: 'transparent' }}>
                <Text style={styles.summaryItemLabel}>You are owed</Text>
                <Text style={styles.summaryItemValue}>₹{balance.owed || 0}</Text>
              </View>
            </View>
            
            <View style={styles.summaryItem}>
              <View style={styles.summaryIconContainer}>
                <TrendingDown size={16} color={colors.debt} />
              </View>
              <View style={{ backgroundColor: 'transparent' }}>
                <Text style={styles.summaryItemLabel}>You owe</Text>
                <Text style={styles.summaryItemValue}>₹{balance.owe || 0}</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Quick Actions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>
        
        <View style={styles.actionsGrid}>
          <Pressable 
            style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.cardBg, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
            onPress={() => router.push('/modal')}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.primary + '20' }]}>
              <Plus size={24} color={colors.primary} />
            </View>
            <Text style={styles.actionText}>Add Bill</Text>
          </Pressable>
          
          <Pressable 
            style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.cardBg, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
            onPress={() => router.push('/(tabs)/groups')}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.secondary + '20' }]}>
              <TrendingUp size={24} color={colors.secondary} />
            </View>
            <Text style={styles.actionText}>Settle Up</Text>
          </Pressable>
        </View>

        {/* Recent Activity */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <Pressable onPress={() => router.push('/(tabs)/activity')}>
            <Text style={{ color: colors.primary }}>See All</Text>
          </Pressable>
        </View>

        {displayActivities.length > 0 ? (
          <FlatList
            data={displayActivities.slice(0, 5)}
            renderItem={renderActivity}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={styles.activityList}
          />
        ) : (
          <View style={[styles.emptyContainer, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Receipt size={40} color={colors.icon} />
            <Text style={[styles.emptyText, { color: colors.icon }]}>No recent activity</Text>
          </View>
        )}
        
      </ScrollView>
      
      {/* Floating Action Button */}
      <Pressable 
        style={({ pressed }) => [styles.fab, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}
        onPress={() => router.push('/modal')}
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
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  summaryCard: {
    padding: 24,
    borderRadius: 24,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
      web: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      }
    }),
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    marginBottom: 4,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryItemLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  summaryItemValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginVertical: 16,
    backgroundColor: 'transparent',
  },
  actionButton: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontWeight: '600',
  },
  activityList: {
    backgroundColor: 'transparent',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  activityIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  activityInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  activityDate: {
    fontSize: 12,
  },
  activityAmountContainer: {
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
  },
  activityAmount: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  activityPaidBy: {
    fontSize: 10,
  },
  emptyContainer: {
    padding: 40,
    borderRadius: 24,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
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
