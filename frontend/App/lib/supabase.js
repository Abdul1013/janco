import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hnrrbunjbqynpzbjrwaj.supabase.co'
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhucnJidW5qYnF5bnB6Ympyd2FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2NDgxNDIsImV4cCI6MjA2NzIyNDE0Mn0.1_TzrBKxWDcs319U1mJOLDZmWD2qlLMcFo_tleC0SUI"

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // important for React Native
  },
});