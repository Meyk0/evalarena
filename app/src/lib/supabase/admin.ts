import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseSecret = process.env.SUPABASE_SECRET_KEY ?? "";

if (!supabaseUrl || !supabaseSecret) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
}

if (typeof window !== "undefined") {
  throw new Error("supabaseAdmin should never be used in the browser");
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseSecret, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
