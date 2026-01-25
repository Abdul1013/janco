import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  //user profile
  const getUserProfile = async (userId) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.log("profile fetch error: ", error);
      return null;
    }
    setProfile(data);
    return data;
  };
  // useEffect(() => {
  //     const getSession = async() => {
  //         const {data: sessionData, error} = await supabase.auth.getSession()
  //         if(sessionData?.session?.user){

  //             setUser(sessionData.session?.user)
  //         }else{
  //             setUser(null)
  //         }
  //         setLoading(false)
  //     }
  //     getSession();

  //     const {data: listener} = supabase.auth.onAuthStateChange((_event, session) =>{
  //         setUser(session?.user ?? null)
  //     })

  //     return ()=>{
  //         listener.subscription.unsubscribe()
  //     }

  // }, []);

  useEffect(() => {
    //persist session to avoid re login 
    const getSession = async () => {
      try {
        const { data: sessionData, error } = await supabase.auth.getSession();
        const currentUser = sessionData?.session?.user;

        setUser(currentUser);
        if (currentUser) {
          const userProfile = await getUserProfile(currentUser.id);
          setProfile(userProfile);
        }
      } catch (error) {
        console.error("Session fetch error:", error);
        setUser(null);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          const userProfile = await getUserProfile(currentUser.id);
          setProfile(userProfile);
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      listener?.subscription?.unsubscribe?.(); // fallback safe unsubscribe
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return { user, loading, profile, getUserProfile, logout };
}
