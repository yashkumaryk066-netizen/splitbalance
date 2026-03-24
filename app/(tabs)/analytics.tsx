import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, ScrollViewProps, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useUserStore } from '@/src/store/useUserStore';
import { db } from '@/src/services/firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { TrendingUp, PieChart, BarChart3, Receipt, Wallet, Download } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { generateGroupReport } from '@/src/services/pdfService';
import Animated, { FadeInUp } from 'react-native-reanimated';

export default function AnalyticsScreen() {
  const [loading, setLoading] = useState(true);
  const [totalSpent, setTotalSpent] = useState(0);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  
  const { user } = useUserStore();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  useEffect(() => {
    if (user) {
      loadAnalytics();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadAnalytics = async () => {
    if (!user || !user.uid) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const q = query(collection(db, 'expenses'), where('paidBy', '==', user.uid));
      const qSnap = await getDocs(q);
      const expenses = qSnap.docs.map(doc => doc.data());

      // Process Data
      let total = 0;
      const cats: { [key: string]: number } = {};
      expenses.forEach(e => {
        total += e.amount;
        cats[e.category || 'General'] = (cats[e.category || 'General'] || 0) + e.amount;
      });

      setTotalSpent(total);
      setCategoryData(Object.keys(cats).map(name => ({ x: name, y: cats[name] })));
      
      // Mock Monthly Data
      setMonthlyData([
        { x: 'Jan', y: 1200 },
        { x: 'Feb', y: 2500 },
        { x: 'Mar', y: 1800 },
        { x: 'Apr', y: total > 0 ? total : 2200 },
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadMonthly = async () => {
    if (!user?.uid) return;
    try {
      // Create detailed report for current month
      await generateGroupReport('Monthly Personal Report', [{ id: user.uid, displayName: 'You' }], [{ amount: totalSpent, description: 'Personal Spending', date: { toDate: () => new Date() }, paidBy: user.uid }]);
    } catch (err) {
      alert('Failed to generate report');
    }
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      
      <Animated.View entering={FadeInUp.duration(600)} style={[styles.summaryCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        <View style={[styles.iconBox, { backgroundColor: colors.primary + '15' }]}>
          <Wallet color={colors.primary} size={24} />
        </View>
        <Text style={[styles.summaryLabel, { color: colors.icon }]}>Total Spend (Past 30 Days)</Text>
        <Text style={styles.summaryValue}>₹{totalSpent.toLocaleString()}</Text>
        <View style={styles.trendRow}>
          <TrendingUp size={16} color={colors.gain} />
          <Text style={[styles.trendText, { color: colors.gain }]}>8% more than last month</Text>
        </View>
        <Pressable onPress={handleDownloadMonthly} style={[styles.downloadReportBtn, { backgroundColor: colors.primary }]}>
           <Download size={16} color="#fff" />
           <Text style={styles.downloadReportText}>Download Monthly Report (PDF)</Text>
        </Pressable>
      </Animated.View>

      <Text style={[styles.sectionTitle, { color: colors.icon }]}>Spending Breakdown</Text>
      <View style={[styles.chartCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
         {categoryData.length > 0 ? categoryData.map(c => (
           <View key={c.x} style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingVertical: 10 }}>
             <Text style={{ color: colors.text }}>{c.x}</Text>
             <Text style={{ color: colors.primary, fontWeight: 'bold' }}>₹{c.y}</Text>
           </View>
         )) : (
           <Text style={{ color: colors.icon }}>No category data available yet.</Text>
         )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCard: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 32,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'transparent',
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  chartCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  downloadReportText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
