import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, View as RNView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { useExpenseStore } from '@/src/store/useExpenseStore';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Receipt, TrendingUp, TrendingDown, ChevronRight, Filter } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function ActivityScreen() {
  const { activities } = useExpenseStore();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();

  // Mock data for history if empty
  const displayActivities = activities.length > 0 ? activities : [
    { id: '1', type: 'expense', description: 'Grocery shopping', amount: 450, date: new Date(), paidBy: 'You' },
    { id: '2', type: 'expense', description: 'Movie tickets', amount: 800, date: new Date(Date.now() - 86400000), paidBy: 'Rahul' },
    { id: '3', type: 'settlement', description: 'Settled up with Rahul', amount: 500, date: new Date(Date.now() - 172800000), paidBy: 'You' },
    { id: '4', type: 'expense', description: 'Internet Bill', amount: 1500, date: new Date(Date.now() - 259200000), paidBy: 'You' },
    { id: '5', type: 'expense', description: 'Uber ride', amount: 320, date: new Date(Date.now() - 345600000), paidBy: 'Rahul' },
  ];

  const renderItem = ({ item, index }: { item: any, index: number }) => (
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
          <Text style={[styles.activityDate, { color: colors.icon }]}>{new Date(item.date).toDateString()}</Text>
        </RNView>
        <RNView style={styles.rightInfo}>
          <Text style={[styles.amountText, { color: item.paidBy === 'You' ? colors.gain : colors.debt }]}>
            {item.paidBy === 'You' ? `+₹${item.amount}` : `-₹${item.amount}`}
          </Text>
          <Text style={[styles.paidByText, { color: colors.icon }]}>Paid by {item.paidBy}</Text>
        </RNView>
      </Pressable>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerSubtitle, { color: colors.icon }]}>Detailed history of all your splits.</Text>
      </View>
      
      <FlatList
        data={displayActivities}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
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
});
