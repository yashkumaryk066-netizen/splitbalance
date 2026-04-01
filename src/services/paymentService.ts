import { Linking, Platform } from 'react-native';

export interface UPIOptions {
  vpa: string;
  name: string;
  amount: number;
  note?: string;
}

/**
 * Generates a standard UPI deep link string.
 * Format: upi://pay?pa=VPA&pn=NAME&am=AMOUNT&cu=INR&tn=NOTE
 */
export const generateUPILink = (options: UPIOptions) => {
  const { vpa, name, amount, note = 'Settlement via SplitBalance' } = options;
  const encodedName = encodeURIComponent(name);
  const encodedNote = encodeURIComponent(note);
  
  return `upi://pay?pa=${vpa}&pn=${encodedName}&am=${amount.toFixed(2)}&cu=INR&tn=${encodedNote}`;
};

/**
 * Attempts to open the UPI payment link in a compatible app.
 */
export const openUPIPayment = async (options: UPIOptions) => {
  const link = generateUPILink(options);
  try {
    const supported = await Linking.canOpenURL(link);
    if (supported || Platform.OS !== 'web') {
      await Linking.openURL(link);
      return true;
    } else {
      console.warn('UPI links are not supported on this device/browser');
      return false;
    }
  } catch (err) {
    console.error('Failed to open UPI link:', err);
    return false;
  }
};
