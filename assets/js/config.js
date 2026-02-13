import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const SUPABASE_URL = "https://wfkqzljiafgstdyiupbi.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_ZNp4awzW-hRIiNMwqg_Ybg_sCb1hTlZ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);