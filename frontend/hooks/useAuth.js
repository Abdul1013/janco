import React, {useEffect, useState} from "react";
import { supabase } from "../lib/supabase";

export function useAuth( ) {

    const [user, setUser] = useState(null)
    const [loading,setLoading] = useState(true)

    useEffect(() => {
        const getSession = async() => {
            const {data: sessionData, error} = await supabase.auth.getSession()
            if(sessionData?.session?.user){
                
                setUser(sessionData.session?.user)
            }else{
                setUser(null)
            }
            setLoading(false)
        }
        getSession();

        const {data: listener} = supabase.auth.onAuthStateChange((_event, session) =>{
            setUser(session?.user ?? null)
        })

        return ()=>{
            listener.subscription.unsubscribe()
        }
    }, []);

    const logout = async () => {
        await supabase.auth.signOut()
        setUser(null)
    }

   return{ user, loading, logout}
}