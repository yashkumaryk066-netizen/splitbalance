import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, View as RNView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { useUserStore } from '@/src/store/useUserStore';
import { useExpenseStore } from '@/src/store/useExpenseStore';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Receipt, TrendingUp, TrendingDown, ChevronRight, Filter } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function ActivityScreen() {
  const { user } = useUserStore();
  const { activities } = useExpenseStore();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();
  const displayActivities = activities;

  const renderItem = ({ item, index }: { item: any, index: number }) => {
    const isPaidByMe = item.paidBy === user?.uid || item.paidBy === 'You';
    const date = item.date?.toDate ? item.date.toDate() : new Date(item.date);

    return (
      <Animated.View 
        entering={FadeInDown.delay(index * 50)} 
      >
        <Pressable 
          onPress={() => item.groupId ? router.push(`/group/${item.groupId}`) : null}
          style={({ pressed }) => [styles.activityRow, { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
        >
          <RNView style={[styles.iconBox, { backgroundColor: item.type === 'expense' ? colors.primary + '15' : colors.gain + '15' }]}>
            {item.type === 'expense' ? <Receipt size={20} color={colors.primary} /> : <TrendingUp size={20} color={colors.gain} />}
          </RNView>
          <RNView style={styles.mainInfo}>
            <Text style={styles.activityTitle}>{item.description}</Text>
            <Text style={[styles.activityDate, { color: colors.icon }]}>{date.toDateString()}</Text>
          </RNView>
          <RNView style={styles.rightInfo}>
            <Text style={[styles.amountText, { color: isPaidByMe ? colors.gain : colors.debt }]}>
              {isPaidByMe ? `+₹${item.amount}` : `-₹${item.amount}`}
            </Text>
            <Text style={[styles.paidByText, { color: colors.icon }]}>Paid by {isPaidByMe ? 'You' : 'Others'}</Text>
          </RNView>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerSubtitle, { color: colors.icon }]}>Detailed history of all your splits.</Text>
      </View>
      
      {displayActivities.length > 0 ? (
        <FlatList
          data={displayActivities}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Receipt size={64} color={colors.icon} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No activities yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.icon }]}>Expenses you add will appear here.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: 'transparent',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    backgroundColor: 'transparent',
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  mainInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  activityDate: {
    fontSize: 12,
  },
  rightInfo: {
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  paidByText: {
    fontSize: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
});
