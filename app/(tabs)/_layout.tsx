import React from 'react';
import { Tabs } from 'expo-router';
import { Home, Users, History, User, BarChart3 } from 'lucide-react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.icon,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTitleStyle: {
          fontWeight: '700',
          color: colors.text,
        },
        headerShadowVisible: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Groups',
          tabBarIcon: ({ color }) => <Users color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color }) => <BarChart3 color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color }) => <History color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <User color={color} size={24} />,
        }}
      />
    </Tabs>
  );
}
