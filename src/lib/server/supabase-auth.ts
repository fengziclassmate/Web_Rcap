import "server-only";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export type AuthenticatedSupabase = {
  supabase: SupabaseClient;
  user: User;
};

export type AuthenticatedSupabaseResult =
  | (AuthenticatedSupabase & { error?: never })
  | { error: NextResponse; supabase?: never; user?: never };

function authError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function getAuthenticatedSupabase(request: Request): Promise<AuthenticatedSupabaseResult> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return { error: authError("Authentication required.", 401) };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return { error: authError("Supabase environment variables are missing.", 500) };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { error: authError("Invalid or expired session.", 401) };

  return { supabase, user: data.user };
}
