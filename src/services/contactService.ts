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
        return data.map(contact => ({
          id: contact.id || Math.random().toString(),
          name: contact.name || 'Unknown',
          phoneNumber: contact.phoneNumbers?.[0]?.number || '',
          image: contact.imageAvailable ? contact.image?.uri : undefined,
        })).filter(c => !!c.phoneNumber);
      }
    }
  } catch (err) {
    console.log('Contacts service not available');
  }
  return [];
};
