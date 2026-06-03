import "../components/InfoCard.js"
import {initFilter} from "../components/filter.js";
import {initDynamicNavbar} from "../components/dynamic_navbar.js";
import {filterByPrice} from "../components/filterByPrice.js";
import {initLoadingUpperPart} from "../main_logic/loadingUpperPart.js";
import {getSession} from "../main_logic/auth.js";
import { supabase } from "../components/supabaseClient.js";
import {reverse} from "../main_logic/renderCardsChunk.js";
import {initCacheFromDB, startSavedProductsCacheSync} from "../main_logic/loadingCacheFromDB.js";
import {initSearchBarForSavedProducts} from "../components/searchBarForSavedProducts.js";
import {normalizeSearchTerm} from "../main_logic/fetchProductsFromDB.js";
import {fromSiteRoot} from "../components/paths.js";

let saved = [];

async function loadSavedCardsFromDb() {
    const { data, error } = await getSession();
    if (error) return [];
    if (!data.session) return [];

    const { data: rows, error: rpcErr } = await supabase.rpc("fetch_saved_products");

    if (rpcErr) {
        console.error("Load saved cards RPC error:", rpcErr);
        return [];
    }

    return rows ?? [];
}

function renderCards(data) {
    const cardContainer = document.getElementById("card-container");
    cardContainer.innerHTML = "";

    if (!data.length) {
        const msg = document.createElement("p");
        msg.id = "no-saved-cards-msg";
        msg.textContent = "Nemáte žiadne uložené produkty.";
        msg.style.fontSize = "0.9rem";
        msg.style.color = "rgb(108, 117, 125)";
        cardContainer.appendChild(msg);
        return;
    }

    data.forEach((card) => {
        const cardElement = document.createElement("info-card");
        cardElement.setAttribute("name", card.name);
        cardElement.setAttribute("price", card.price);
        cardElement.setAttribute("discount_start", reverse(card.discount_start));
        cardElement.setAttribute("discount_end", reverse(card.discount_end));
        cardElement.setAttribute("supermarket", card.supermarket);
        cardElement.setAttribute("image_of_product", card.image_of_product);
        cardElement.setAttribute("type", card.type);
        cardElement.setAttribute("sub_category", card.sub_category);
        cardElement.setAttribute("category", card.category);
        cardElement.setAttribute("group", card.group);
        cardElement.setAttribute("product_id", card.discounted_product_id ?? card.product_id ?? "");

        cardContainer.appendChild(cardElement);
    });
}

function readUiFilters() {
    const read = (id) => {
        const el = document.getElementById(id);
        const v = String(el?.value ?? "");
        return v && v !== "Všetky" ? v : null;
    };

    const sub_category = read("filter-sub_category");
    const type = read("filter-type");
    const supermarket = read("filter-supermarket");

    const priceEl = document.querySelector("#price-filter-container select");
    const priceRaw = String(priceEl?.value ?? "");
    const priceSort = priceRaw === "asc" || priceRaw === "desc" ? priceRaw : null;

    const searchEl = document.getElementById("saved-search-input");
    const searchRaw = String(searchEl?.value ?? "").trim();
    const search = searchRaw ? normalizeSearchTerm(searchRaw) : null;

    return {sub_category, type, supermarket, priceSort, search};
}

function applySavedFilters(rows, { sub_category, type, supermarket, priceSort, search }) {
    let out = Array.isArray(rows) ? rows.slice() : [];

    if (sub_category) out = out.filter((r) => String(r?.sub_category ?? "") === String(sub_category));
    if (type) out = out.filter((r) => String(r?.type ?? "") === String(type));
    if (supermarket) out = out.filter((r) => String(r?.supermarket ?? "") === String(supermarket));

    if (search) {
        const tokens = String(search).split(/\s+/).filter(Boolean)
        out = out.filter((r) => {
            const name = String(r?.normalized_name ?? "");
            return tokens?.every((t) => name.includes(t));
        });
    }

    if (priceSort === "asc") out.sort((a, b) => Number(a?.price ?? 0) - Number(b?.price ?? 0));
    if (priceSort === "desc") out.sort((a, b) => Number(b?.price ?? 0) - Number(a?.price ?? 0));

    return out;
}

function snapshotFilterSelections() {
    const ids = ["filter-sub_category", "filter-type", "filter-supermarket"];
    const snap = {};
    ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) snap[id] = String(el.value ?? "Všetky");
    });
    return snap;
}

function restoreFilterSelections(snap) {
    if (!snap) return;

    Object.entries(snap).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (!el) return;

        const hasOption = Array.from(el.options).some((o) => String(o.value) === String(value));
        el.value = hasOption ? value : "Všetky";

        // triggers filter.js listener to refresh counts and emit filters:changed
        el.dispatchEvent(new Event("change", { bubbles: true }));
    });
}

function rebuildFilters(saved, prevSelections = null) {
    const container = document.getElementById("search-filter-container");
    if (!container) return;

    // remove previously rendered filter bars (leave other UI alone)
    container.querySelectorAll(".filter-bar").forEach((el) => el.remove());

    // rebuild options \+ counts based on latest saved dataset
    initFilter(saved, "sub_category");
    initFilter(saved, "type");
    initFilter(saved, "supermarket");

    restoreFilterSelections(prevSelections);
}

window.addEventListener("DOMContentLoaded", async() => {
    const {data, error} = await getSession();
    if (error) return null;
    if (!data?.session) {
        window.location.href = fromSiteRoot("html/prihlasenie.html");
        return;
    }

    await initLoadingUpperPart();
    await initDynamicNavbar();

    saved = await loadSavedCardsFromDb();

    const main = document.getElementById("title-and-quick-search")

    const title = document.createElement("h3");
    title.id = "page-title";
    title.classList.add("center-item-grid");
    title.textContent = "Vaše uložené produkty:";

    main.appendChild(title);

    initSearchBarForSavedProducts();

    filterByPrice();
    rebuildFilters(saved);

    renderCards(applySavedFilters(saved, readUiFilters()));

    // No DB re-fetch here: update local `saved` and re-render
    window.addEventListener("saved:removed", (e) => {
        const removedId = String(e?.detail ?? "");
        if (!removedId) return;

        const prevSelections = snapshotFilterSelections();

        saved = (saved ?? []).filter((r) => String(r?.discounted_product_id ?? r?.product_id ?? "") !== removedId);

        rebuildFilters(saved, prevSelections);
        renderCards(applySavedFilters(saved, readUiFilters()));
    });

    window.addEventListener("filters:changed", async () => {
        renderCards(applySavedFilters(saved, readUiFilters()));
    });

    const userId = data.session.user.id;

    if (!sessionStorage.getItem(`first_load_${userId}`)) {
        const ok = await initCacheFromDB();
        if (ok) sessionStorage.setItem(`first_load_${userId}`, "true");
    }

    await startSavedProductsCacheSync();
});

