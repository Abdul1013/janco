import React, { useState, useRef } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../constants/theme/ThemeContext';
import { useAuth } from '../hooks/authContext';
import useChat from '../hooks/useChat';
import AppText from '../components/ui/AppText';
import Skeleton from '../components/ui/Skeleton';

export default function ChatScreen({ route }) {
  const { jobId, role, janitorName, otherName } = route?.params || {};
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors, spacing } = useTheme();
  const { user } = useAuth();
  const { messages, sendMessage, loading } = useChat(jobId);

  const [text, setText] = useState('');
  const flatListRef = useRef(null);

  const isJanitor = role === 'janitor';
  const contactName = otherName || (isJanitor ? 'Customer' : (janitorName || 'Janitor'));

  const handleSend = async () => {
    if (!text.trim()) return;
    const msg = text;
    setText('');
    await sendMessage(msg);
  };

  const renderMessage = ({ item }) => {
    const isMine = item.sender_id === user?.id || String(item.sender_id) === String(user?.id);
    return (
      <View
        style={{
          alignSelf: isMine ? 'flex-end' : 'flex-start',
          maxWidth: '75%',
          backgroundColor: isMine ? colors.primary : colors.surfaceVariant,
          borderRadius: 16,
          borderBottomRightRadius: isMine ? 4 : 16,
          borderBottomLeftRadius: isMine ? 16 : 4,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          marginBottom: spacing.xs,
        }}
      >
        <AppText
          variant="bodyMedium"
          style={{ color: isMine ? colors.onPrimary : colors.onSurface }}
        >
          {item.content || item.text}
        </AppText>
        <AppText
          variant="bodySmall"
          style={{
            color: isMine ? colors.onPrimary : colors.onSurfaceVariant,
            marginTop: 2,
            opacity: 0.7,
            textAlign: 'right',
            fontSize: 11,
          }}
        >
          {item.created_at
            ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : ''}
        </AppText>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={{
        paddingTop: insets.top + 8,
        paddingBottom: 12,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.outlineVariant,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
      }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>

        <View style={{
          width: 36, height: 36, borderRadius: 18,
          backgroundColor: colors.primaryContainer,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <MaterialIcons name="person" size={20} color={colors.onPrimaryContainer} />
        </View>

        <View style={{ flex: 1 }}>
          <AppText variant="titleMedium" style={{ color: colors.onSurface, fontWeight: '700' }}>
            {contactName}
          </AppText>
          <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
            {isJanitor ? 'Customer' : 'Janitor'}
          </AppText>
        </View>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={{ padding: spacing.md }}>
          <Skeleton variant="list" />
        </View>
      ) : messages.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <MaterialIcons name="chat-bubble-outline" size={48} color={colors.onSurfaceVariant} />
          <AppText variant="bodyMedium" style={{ color: colors.onSurfaceVariant, marginTop: spacing.sm, textAlign: 'center' }}>
            No messages yet. Say hello!
          </AppText>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => String(m.id || Math.random())}
          renderItem={renderMessage}
          contentContainerStyle={{
            padding: spacing.md,
            flexGrow: 1,
            justifyContent: 'flex-end',
          }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {/* Input bar */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        paddingBottom: spacing.sm + insets.bottom,
        borderTopWidth: 1,
        borderTopColor: colors.outlineVariant,
        backgroundColor: colors.surface,
        gap: spacing.xs,
      }}>
        <TextInput
          style={{
            flex: 1,
            minHeight: 44,
            maxHeight: 120,
            borderWidth: 1,
            borderColor: colors.outline,
            borderRadius: 22,
            paddingHorizontal: spacing.md,
            paddingTop: Platform.OS === 'ios' ? 12 : 10,
            paddingBottom: Platform.OS === 'ios' ? 12 : 10,
            color: colors.onSurface,
            backgroundColor: colors.background,
            fontSize: 15,
          }}
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          placeholderTextColor={colors.onSurfaceVariant}
          multiline
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!text.trim()}
          style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: text.trim() ? colors.primary : colors.surfaceVariant,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <MaterialIcons
            name="send"
            size={20}
            color={text.trim() ? colors.onPrimary : colors.onSurfaceVariant}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
