"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

type AuthCtx = { session: Session | null; user: User | null; role: string | null; loading: boolean };
const AuthContext = createContext<AuthCtx>({ session: null, user: null, role: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const activeUidRef = useRef<string | null>(null);
  const roleRequestRef = useRef(0);

  async function fetchRole(uid: string) {
    const requestId = ++roleRequestRef.current;
    const { data, error } = await supabase.from("user_accounts").select("role, is_active").eq("id", uid).single();
    if (requestId !== roleRequestRef.current || activeUidRef.current !== uid) return;
    if (error) {
      setRole(null);
      setLoading(false);
      return;
    }
    if (data && data.is_active === false) {
      setRole("inactive");
      setLoading(false);
      await supabase.auth.signOut();
      return;
    }
    setRole(data?.role ?? "customer");
    setLoading(false);
  }

  useEffect(() => {
    let mounted = true;
    let receivedAuthEvent = false;
    function applySession(s: Session | null) {
      const nextUid = s?.user.id ?? null;
      const accountChanged = activeUidRef.current !== nextUid;
      activeUidRef.current = nextUid;
      setSession(s);
      if (nextUid) {
        if (accountChanged) {
          setRole(null);
          setLoading(true);
        }
        void fetchRole(nextUid);
      } else {
        roleRequestRef.current += 1;
        setRole(null);
        setLoading(false);
      }
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      receivedAuthEvent = true;
      applySession(s);
    });

    // INITIAL_SESSION normally arrives through the listener. Keep getSession
    // as a fallback, without allowing a late response to overwrite a newer event.
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted && !receivedAuthEvent) applySession(data.session);
    });

    return () => {
      mounted = false;
      roleRequestRef.current += 1;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) return;
    const channel = supabase.channel(`account-status-${uid}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "user_accounts",
        filter: `id=eq.${uid}`,
      }, () => { void fetchRole(uid); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [session?.user.id]);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
