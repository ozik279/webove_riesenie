import "../components/InfoCard.js";
import {keywords } from "../components/keywords.js";
import {initFilter} from "../components/filter.js";
import {initDynamicNavbar } from "../components/dynamic_navbar.js";
import {fetchProductsFromDb} from "../main_logic/fetchProductsFromDB.js";
import {noResultMessageInit} from "../components/noResultMessage.js";
import {renderCardsChunk } from "../main_logic/renderCardsChunk.js";
import {filterByPrice} from "../components/filterByPrice.js";
import {initLoadingUpperPart} from "../main_logic/loadingUpperPart.js";
import {initCacheFromDB, startSavedProductsCacheSync} from "../main_logic/loadingCacheFromDB.js";
import {getSession} from "../main_logic/auth.js";
import {fromSiteRoot} from "../components/paths.js";


// Make failures visible
window.addEventListener("error", (e) => console.error("Runtime error:", e.error || e.message));
window.addEventListener("unhandledrejection", (e) =>
    console.error("Unhandled promise rejection:", e.reason)
);

function createLoadMoreUI(cardContainer) {
    const wrap = document.createElement("div");
    wrap.id = "load-more-wrap";
    wrap.style.display = "flex";
    wrap.style.justifyContent = "center";
    wrap.style.margin = "1rem 0";
    wrap.style.display = "none";

    const btn = document.createElement("button");
    btn.id = "load-more-btn";
    btn.type = "button";
    btn.className = "btn btn-outline-primary";
    btn.textContent = "Načítať viac";

    wrap.appendChild(btn);
    cardContainer.insertAdjacentElement("afterend", wrap);

    return { wrap, btn };
}

function readUiFilters() {
    const read = (id) => {
        const el = document.getElementById(id);
        const v = String(el?.value ?? "");
        return v && v !== "Všetky" ? v : null;
    };

    const type = read("filter-type");
    const supermarket = read("filter-supermarket");

    const priceEl = document.querySelector("#price-filter-container select");
    const priceRaw = String(priceEl?.value ?? "");
    const priceSort = priceRaw === "asc" || priceRaw === "desc" ? priceRaw : null;

    return { type, supermarket, priceSort};
}

async function loadCardsFromDb() {
    const params = new URLSearchParams(window.location.search);
    const group = params.get("group") || null;
    const category = params.get("category") || null;
    const subCategory = params.get("sub_category") || null;
    const q = params.get("q") || null;

    const hasAllTaxonomy = !!group && !!category && !!subCategory;
    const hasAnyTaxonomy = !!group || !!category || !!subCategory;

    const hasQ = !!q;
    const isOnlyQ = hasQ && !hasAnyTaxonomy;

    // valid only when (all taxonomy present) OR (only q present)
    if (!(hasAllTaxonomy || isOnlyQ)) {
        window.location.replace(fromSiteRoot("index.html"));
        return false;
    }

    const cardContainer = document.getElementById("card-container");
    if (!cardContainer) return;

    cardContainer.innerHTML = "";

    const msg = noResultMessageInit();
    cardContainer.appendChild(msg);
    msg.style.display = "none";

    await initLoadingUpperPart();
    await initDynamicNavbar();

    // Small initial fetch just to build filter dropdown options.
    const seed = await fetchProductsFromDb({
        group,
        category,
        subCategory,
        searchTerm: q,
        from: 0,
        to: 500,
    });

    filterByPrice();
    initFilter(seed, "type");
    initFilter(seed, "supermarket");

    const titleEl = document.createElement("h3");
    titleEl.id = "page-title";
    titleEl.classList.add("text-center");

    const nSub = String(subCategory || "").replace(/-/g, "_");
    titleEl.textContent = keywords[nSub] || subCategory || `Vyhľadávanie podľa výrazu: ${q}`;

    const main = document.querySelector("main");
    main.insertBefore(titleEl, main.firstChild);

    // Load-more button
    const { wrap, btn } = createLoadMoreUI(cardContainer);

    const PAGE_SIZE = 15;
    let from = 0;
    let lastBatch = 0;
    let busy = false;

    const updateButton = () => {
        wrap.style.display = lastBatch < PAGE_SIZE ? "none" : "flex";
    };

    const fetchAndRender = async ({ reset }) => {
        if (busy) return;
        busy = true;

        try {
            if (reset) {
                from = 0;
                cardContainer.innerHTML = "";
                cardContainer.appendChild(msg);
                msg.style.display = "none";
            }

            const { type, supermarket, priceSort } = readUiFilters();

            const rows = await fetchProductsFromDb({
                group,
                category,
                subCategory,
                searchTerm: q,
                type,
                supermarket,
                priceSort,
                from,
                to: from + PAGE_SIZE - 1,
            });

            lastBatch = rows.length;

            if (!rows.length && reset) {
                msg.style.display = "block";
                wrap.style.display = "none";
                return;
            }

            renderCardsChunk(cardContainer, rows, 0);

            from += PAGE_SIZE;
            updateButton();
        }
        finally {
            busy = false;
        }
    };

    const {data, error} = await getSession();
    if (error) return null;

    if (data.session) {
        const userId = data.session.user.id;

        if (!sessionStorage.getItem(`first_load_${userId}`)) {
            const ok = await initCacheFromDB();
            if (ok) sessionStorage.setItem(`first_load_${userId}`, "true");
        }

        await startSavedProductsCacheSync();
    }

    await fetchAndRender({ reset: true });

    btn.addEventListener("click", async () => {
        await fetchAndRender({ reset: false });
    });

    // when any filter changes, reset paging to filtered rows
    window.addEventListener("filters:changed", async () => {
        await fetchAndRender({reset: true});
    });
}

window.addEventListener("DOMContentLoaded", () => {
    loadCardsFromDb().catch((e) => console.error("DB load failed:", e));
});
