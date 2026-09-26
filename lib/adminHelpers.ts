import { supabase } from "@/lib/supabaseClient";

export async function requireRole(allowed: string[]): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;
  const { data } = await supabase.from("user_accounts").select("role").eq("id", session.user.id).single();
  return allowed.includes(data?.role ?? "");
}
