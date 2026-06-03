import { supabase } from "../components/supabaseClient.js";

export async function signInEmail(email, password) {
    return supabase.auth.signInWithPassword({ email, password });
}

export async function registrationEmail(email, password, emailRedirectTo) {
    return supabase.auth.signUp({
        email,
        password,
        options: emailRedirectTo ? { emailRedirectTo } : undefined,
    });
}

export async function getSession() {
    return supabase.auth.getSession();
}

export async function signOut() {
    return supabase.auth.signOut();
}

