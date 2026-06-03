import {initDynamicNavbar} from "./components/dynamic_navbar.js";
import {supabase} from "./components/supabaseClient.js";
import {initLoadingUpperPart} from "./main_logic/loadingUpperPart.js";
import {initCacheFromDB, startSavedProductsCacheSync} from "./main_logic/loadingCacheFromDB.js";
import {getSession} from "./main_logic/auth.js";

async function loadTimeOfLastScrape() {

    const span = document.getElementById("lastScrapeDateTime");
    if (!span) return;

    const { data, error } = await supabase
        .from("runs")
        .select("imported_at")
        .order("imported_at", { ascending: false })
        .limit(1);

    if (error) {
        console.error("Runs Supabase error:", error);
        span.textContent = "nedostupná";
        return;
    }

    const importedAt = data?.[0]?.imported_at;
    if (!importedAt) {
        span.textContent = "nenájdená";
        return;
    }

    const dt = new Date(importedAt);
    const formatted = Number.isNaN(dt.getTime())
        ? String(importedAt)
        : dt.toLocaleString("sk-SK");

    span.textContent = `${formatted}`;
}



window.addEventListener("DOMContentLoaded", async() => {
    await initLoadingUpperPart();
    await initDynamicNavbar();
    await loadTimeOfLastScrape();

    const { data, error } = await getSession();
    if (error) return;
    if (!data.session) return;

    const userId = data.session.user.id;

    if (sessionStorage.getItem(`first_load_${userId}`)) return;

    const ok = await initCacheFromDB();
    if (ok) sessionStorage.setItem(`first_load_${userId}`, "true");

    await startSavedProductsCacheSync();
});