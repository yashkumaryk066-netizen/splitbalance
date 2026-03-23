/**
 * SplitNest Premium Theme Palette
 * Focused on high-contrast accessibility and modern glassmorphism compatibility.
 */

const tintColorLight = '#4F46E5'; // Indigo
const tintColorDark = '#818CF8';  // Light Indigo

export default {
  light: {
    text: '#11181C',
    background: '#FFFFFF',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    accent: '#10B981', // Emerald
    debt: '#EF4444',   // Red
    gain: '#10B981',   // Green
    cardBg: '#F8FAFC',
    border: '#E2E8F0',
    primary: '#4F46E5',
    secondary: '#F59E0B', // Amber
  },
  dark: {
    text: '#ECEDEE',
    background: '#0F172A', // Slate 900
    tint: tintColorDark,
    icon: '#94A3B8',
    tabIconDefault: '#94A3B8',
    tabIconSelected: tintColorDark,
    accent: '#34D399', // Emerald 400
    debt: '#F87171',   // Red 400
    gain: '#34D399',
    cardBg: '#1E293B', // Slate 800
    border: '#334155',
    primary: '#6366F1',
    secondary: '#FBBF24',
  },
};
