// create table messages (
//   id uuid primary key default gen_random_uuid(),
//   job_id uuid references jobs(id) on delete cascade,
//   sender_id uuid references auth.users(id),
//   text text not null,
//   created_at timestamp default now()
// );

// table schema

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../hooks/authContext";
import { supabase } from "../lib/supabase"; // your supabase client
import Header from "../components/Header";
import { Colors, Spacing, Typography } from "../components/theme/Theme";

export default function ChatScreen({ route }) {
  const { jobId, receiverId, role } = route.params;
  // const { jobId, janitorId } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  useEffect(() => {
    //fetch old messages
    loadMessages();

    //subscribe realtime
    const channel = supabase
      .channel(`chat-${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `job_id=eq.${jobId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  async function loadMessages() {
    let { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });
    if (!error) setMessages(data);
  }

  async function sendMessage() {
    if (!text.trim()) return;

    const { error } = await supabase.from("messages").insert([
      {
        job_id: jobId,
        sender_id: user.id,
        receiver_id: receiverId,
        text,
      },
    ]);
    if (!error) setText;
  }

  const renderItem = ({ item }) => (
    <View
      style={[
          styles.message,
        item.sender_id === user.id ? styles.myMessage : styles.theirMessage,
      ]}
    >
      <Text style={Colors.dark.white}>{item.text}</Text>
    </View>
  );

  return (
    <SafeAreaView style={Typography.container}>
      <Header title={role === "user" ? "Chat with Janitor" : "Chat with Customer"} />
      <FlatList
        data={messages}
        renderItem={renderItem}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: Spacing.md }}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message....."
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
          <Text style={Colors.dark.white}>Send</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// const styles = StyleSheet.create({
//   msgBubble: {
//     padding: 10,
//     borderRadius: 8,
//     marginVertical: 4,
//     maxWidth: "70%",
//   },
//   mine: { backgroundColor: "#00A86B", alignSelf: "flex-end" },
//   theirs: { backgroundColor: "#666", alignSelf: "flex-start" },
//   inputRow: {
//     flexDirection: "row",
//     padding: 10,
//     borderTopWidth: 1,
//     borderColor: "#ddd",
//   },
//   input: { flex: 1, borderWidth: 1, borderColor: "#ccc", borderRadius: 20, paddingHorizontal: 12 },
//   sendBtn: { backgroundColor: "#00A86B", padding: 12, borderRadius: 20, marginLeft: 8 },
// });

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f8f8" },
  message: {
    padding: 10,
    borderRadius: 10,
    marginVertical: 4,
    maxWidth: "75%",
  },
  myMessage: {
    backgroundColor: "#00A86B",
    alignSelf: "flex-end",
  },
  theirMessage: {
    backgroundColor: "#666",
    alignSelf: "flex-start",
  },
  msgText: { color: "#fff", fontSize: 15 },
  inputRow: {
    flexDirection: "row",
    padding: 10,
    borderTopWidth: 1,
    borderColor: "#ddd",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 25,
    paddingHorizontal: 12,
  },
  sendBtn: {
    backgroundColor: "#00A86B",
    paddingHorizontal: 20,
    justifyContent: "center",
    borderRadius: 25,
    marginLeft: 8,
  },
});