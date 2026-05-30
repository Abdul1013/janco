import React from 'react';
import ChatScreen from '../ChatScreen';

export default function JanitorChatScreen({ route }) {
  return <ChatScreen route={{ params: { ...(route?.params || {}), role: 'janitor' } }} />;
}
