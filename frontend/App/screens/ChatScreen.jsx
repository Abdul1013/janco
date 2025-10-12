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
  const { jobId, janitorId } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  useEffect(() => {
    //fetch old messages
    loadMessages();

    //subscribe realtime
    const channel = supabase
      .channel(`messages-job-${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
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

  async function sendMessages() {
    if (!text.trim()) return;

    const { error } = await supabase.from("messages").insert([
      {
        job_id: jobId,
        sender_id: user.id,
        text,
      },
    ]);
    if (!error) setText("");
  }

  const renderItem = ({ item }) => (
    <View
      style={[
        styles.msgBubble,
        item.sender_id === user.id ? styles.mine : styles.theirs,
      ]}
    >
      <Text style={Colors.dark.white}>{item.text}</Text>{" "}
    </View>
  );

  return (
    <SafeAreaView style={Typography.container}>
      <Header title={"Chat with Janitor"} />
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
        <TouchableOpacity style={styles.sendBtn}>
          <Text style={Colors.dark.white}>Send</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  msgBubble: {
    padding: 10,
    borderRadius: 8,
    marginVertical: 4,
    maxWidth: "70%",
  },
  mine: { backgroundColor: "#00A86B", alignSelf: "flex-end" },
  theirs: { backgroundColor: "#666", alignSelf: "flex-start" },
  inputRow: {
    flexDirection: "row",
    padding: 10,
    borderTopWidth: 1,
    borderColor: "#ddd",
  },
  input: { flex: 1, borderWidth: 1, borderColor: "#ccc", borderRadius: 20, paddingHorizontal: 12 },
  sendBtn: { backgroundColor: "#00A86B", padding: 12, borderRadius: 20, marginLeft: 8 },
});
