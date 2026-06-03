import {getSession} from "./auth.js";
import {supabase} from "../components/supabaseClient.js";

async function loadSavedCardsFromDb() {
    const { data, error } = await getSession();
    if (error) return { ok: false, userId: null, rows: [] };
    if (!data.session) return { ok: false, userId: null, rows: [] };

    const userId = data.session.user.id;

    const { data: rows, error: err } = await supabase
        .from("saved_products")
        .select("discounted_product_id, discounted_products!inner(discount_end)")
        .eq("user_id", userId)
        .gte("discounted_products.discount_end", new Date().toISOString().slice(0, 10));

    if (err) {
        console.error("Load saved on-sale product IDs for cache error:", err);
        return { ok: false, userId, rows: [] };
    }

    return { ok: true, userId, rows: rows ?? [] };
}

export async function initCacheFromDB() {
    const { ok, userId, rows } = await loadSavedCardsFromDb();
    if (!ok || !userId) return false;

    // Success even if empty: means DB call worked and we have "truth".
    if (!Array.isArray(rows) || rows.length === 0) return true;

    rows.forEach((row) => {
        const productId = String(row?.discounted_product_id ?? "");
        if (!productId) return;

        const payload = {
            product_id: productId,
            is_saved: true,
        };

        sessionStorage.setItem(`card_${userId}_${productId}`, JSON.stringify(payload));
    });

    return true;
}

//TODO subscripiton to supabase channel naucit/ chache sync-in

let _savedProductsSync = { channel: null, userId: null };

export async function startSavedProductsCacheSync() {
    const { data, error } = await getSession();
    if (error || !data?.session?.user?.id) return { ok: false, stop() {} };

    const userId = data.session.user.id;

    // Already running for this user -> do nothing
    if (_savedProductsSync.channel && _savedProductsSync.userId === userId) {
        return {
            ok: true,
            stop() {},
        };
    }

    // If running for a different user, stop it first
    if (_savedProductsSync.channel) {
        supabase.removeChannel(_savedProductsSync.channel);
        _savedProductsSync = { channel: null, userId: null };
    }

    const channel = supabase
        .channel(`saved_products_cache_${userId}`)
        .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "saved_products", filter: `user_id=eq.${userId}` },
            (payload) => {
                const productId = payload?.new?.discounted_product_id;
                if (!productId) return;
                sessionStorage.setItem(
                    `card_${userId}_${productId}`,
                    JSON.stringify({ product_id: String(productId), is_saved: true })
                );
            }
        )
        .on(
            "postgres_changes",
            { event: "DELETE", schema: "public", table: "saved_products", filter: `user_id=eq.${userId}` },
            (payload) => {
                const productId = payload?.old?.discounted_product_id;
                if (!productId) return;
                sessionStorage.removeItem(`card_${userId}_${productId}`);
            }
        )
        .subscribe((status, err) => {
            console.log(`[realtime:saved_products_cache_${userId}] status:`, status, err ?? "");
        });

    _savedProductsSync = { channel, userId };

    return {
        ok: true,
        stop() {
            supabase.removeChannel(channel);
            if (_savedProductsSync.channel === channel) _savedProductsSync = { channel: null, userId: null };
        },
    };
}