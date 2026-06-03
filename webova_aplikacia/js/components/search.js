import {urlFromSiteRoot} from "./paths.js";

export function initSearch() {

    const buildProductListUrl = (q) => {
        const value = String(q ?? "").trim();
        const url = urlFromSiteRoot("html/product-list.html");

        if (value) {
            url.searchParams.set("q", value);
            url.searchParams.delete("group");
            url.searchParams.delete("category");
            url.searchParams.delete("sub_category");
        }

        return url;
    };

    const navigateWithReload = (q) => {
        const url = buildProductListUrl(q);
        window.location.assign(url.toString()); // forces navigation (reload)
    };

    const bar = document.getElementById("search-bar");
    const input = document.getElementById("productSearchInput");

    bar.addEventListener("submit", async (e) => {
        e.preventDefault();
        navigateWithReload(input.value);
    });

    window.addEventListener("popstate", () => {
        window.location.reload();
    });

    // sync input from URL (no auto-fetch here)
    const params = new URLSearchParams(window.location.search);
    input.value = params.get("q") || "";
}
