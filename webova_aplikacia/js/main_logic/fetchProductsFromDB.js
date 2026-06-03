import {supabase} from "../components/supabaseClient.js";

export function normalizeSearchTerm(input) {
    return String(input ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/['’`´ˇ]/g, "")                     // apostrophes/quotes
        .replace(/[-–—_]/g, " ")                    // dashes/underscore -> space
        .replace(/[.,;:!?"]/g, "")                  // basic punctuation
        .replace(/[()[\]{}<>|\\/]/g, "")            // brackets, pipes, slashes
        .replace(/[@#$%^&*+=~]/g, "")
}

export async function fetchProductsFromDb({
                                              group = null,
                                              category = null,
                                              subCategory = null,
                                              searchTerm = null,
                                              type = null,
                                              supermarket = null,
                                              priceSort = null, // "asc" | "desc" | null
                                              from = 0,
                                              to = 14,
                                          } = {}) {

    const term = normalizeSearchTerm(searchTerm);

    // In "search mode" we pass tokens to the DB function; in "scoped mode" we pass group/category/subCategory.
    const tokens = term.length > 0 ? term.split(/\s+/).filter(Boolean) : null;

    const isSearchMode = Array.isArray(tokens) && tokens.length > 0;

    const args = {
        p_group: isSearchMode ? null : group,
        p_category: isSearchMode ? null : category,
        p_sub_category: isSearchMode ? null : subCategory,
        p_type: type && type !== "Všetky" ? type : null,
        p_supermarket: supermarket && supermarket !== "Všetky" ? supermarket : null,
        p_tokens: isSearchMode ? tokens : null,
        p_price_sort: priceSort === "asc" || priceSort === "desc" ? priceSort : null,
        p_from: Number.isFinite(from) ? from : 0,
        p_to: Number.isFinite(to) ? to : 14,
    };

    const { data, error } = await supabase.rpc("fetch_products_distinct", args);

    if (error) {
        console.error("Products Supabase RPC error:", error);
        return [];
    }

    return data ?? [];
}
