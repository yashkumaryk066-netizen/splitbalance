import * as Contacts from 'expo-contacts';
import { Platform } from 'react-native';

export interface MobileContact {
  id: string;
  name: string;
  phoneNumber?: string;
  image?: string;
}

export const getPhoneContacts = async (): Promise<MobileContact[]> => {
  if (Platform.OS === 'web') return [];

  try {
    if (!Contacts?.requestPermissionsAsync) return [];
    const { status } = await Contacts.requestPermissionsAsync();
    if (status === 'granted') {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Image],
      });

      if (data.length > 0) {
        return data.map(contact => {
          // Normalize phone number: remove all non-numeric except leading +
          let phone = contact.phoneNumbers?.[0]?.number || '';
          const normalizedPhone = phone.replace(/[^\d+]/g, '');
          
          return {
            id: contact.id || Math.random().toString(),
            name: contact.name || 'Unknown',
            phoneNumber: normalizedPhone,
            image: contact.imageAvailable ? contact.image?.uri : undefined,
          };
        }).filter(c => !!c.phoneNumber);
      }
    }
  } catch (err) {
    console.log('Contacts service not available');
  }
  return [];
};
