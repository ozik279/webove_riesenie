//import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0/+esm"

const PROJECT_URL=import.meta.env.VITE_PROJECT_URL;
const SUPABASE_ANON_KEY=import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(PROJECT_URL, SUPABASE_ANON_KEY);