import React from 'react';
import { View, TextInput, StyleSheet, TextInputProps } from 'react-native';
import Colors from '@/src/constants/Colors';
import { useColorScheme } from '@/src/components/useColorScheme';

interface CustomInputProps extends TextInputProps {
  icon?: React.ReactNode;
  containerStyle?: object;
}

export const CustomInput: React.FC<CustomInputProps> = ({ icon, containerStyle, ...props }) => {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View style={[styles.container, { borderColor: colors.border, backgroundColor: colors.cardBg }, containerStyle]}>
      {icon && <View style={styles.icon}>{icon}</View>}
      <TextInput
        style={[styles.input, { color: colors.text }]}
        placeholderTextColor={colors.icon}
        underlineColorAndroid="transparent"
        // @ts-ignore
        outlineStyle="none"
        {...props}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 60,
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    height: '100%',
    paddingVertical: 10,
  },
});
