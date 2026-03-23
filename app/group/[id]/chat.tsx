import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { useUserStore } from '@/src/store/useUserStore';
import { db } from '@/src/services/firebaseConfig';
import { collection, query, orderBy, onSnapshot, addDoc, Timestamp } from 'firebase/firestore';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Send, ArrowLeft, Info } from 'lucide-react-native';

export default function GroupChatScreen() {
  const { id } = useLocalSearchParams();
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  
  const { user } = useUserStore();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!id) return;
    
    const q = query(
      collection(db, 'groups', id as string, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setLoading(false);
      // Auto scroll to bottom
      setTimeout(() => flatListRef.current?.scrollToEnd(), 200);
    });

    return () => unsubscribe();
  }, [id]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    
    try {
      await addDoc(collection(db, 'groups', id as string, 'messages'), {
        text,
        senderId: user?.uid,
        senderName: user?.displayName || 'Anonymous',
        createdAt: Timestamp.now(),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.senderId === user?.uid;
    return (
      <View style={[styles.messageRow, { justifyContent: isMe ? 'flex-end' : 'flex-start' }]}>
        {!isMe && (
          <View style={[styles.avatarChat, { backgroundColor: colors.accent }]}>
            <Text style={styles.avatarTextChat}>{item.senderName?.charAt(0)}</Text>
          </View>
        )}
        <View style={[
          styles.messageBubble, 
          { 
            backgroundColor: isMe ? colors.primary : colors.cardBg,
            borderBottomRightRadius: isMe ? 4 : 16,
            borderBottomLeftRadius: !isMe ? 4 : 16,
            borderColor: colors.border,
            borderWidth: isMe ? 0 : 1
          }
        ]}>
          {!isMe && <Text style={[styles.senderName, { color: colors.primary }]}>{item.senderName}</Text>}
          <Text style={[styles.messageText, { color: isMe ? '#fff' : colors.text }]}>{item.text}</Text>
          <Text style={[styles.messageTime, { color: isMe ? 'rgba(255,255,255,0.7)' : colors.icon }]}>
            {item.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen options={{ 
        title: 'Group Chat', 
        headerShown: true,
        headerLeft: () => (
          <Pressable onPress={() => router.back()} style={{ marginRight: 16 }}>
            <ArrowLeft color={colors.text} size={24} />
          </Pressable>
        ),
      }} />

      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        />
      )}

      <View style={[styles.inputContainer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <TextInput
          style={[styles.inputChat, { backgroundColor: colors.cardBg, color: colors.text, borderColor: colors.border }]}
          placeholder="Type a message..."
          placeholderTextColor={colors.icon}
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <Pressable 
          style={[styles.sendButton, { backgroundColor: colors.primary }]}
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <Send color="#fff" size={20} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  avatarChat: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  avatarTextChat: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
  },
  senderName: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    gap: 12,
  },
  inputChat: {
    flex: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    borderWidth: 1,
    maxHeight: 120,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});
