const PAGE_SIZE = 15;

export function reverse(value) {
    if (!value) return "";

    const s = String(value).trim();
    if (!s) return "";

    // Accept YYYY-MM-DD (also tolerate YYYY.MM.DD or YYYY/MM/DD)
    const m = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
    if (!m) return "";

    const yyyy = Number(m[1]);
    const mm = Number(m[2]);
    const dd = Number(m[3]);

    // Basic range checks
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return "";

    return `${dd}.${mm}.${yyyy}`;
}


export function renderCardsChunk(cardContainer, rows, startIndex) {
    const end = Math.min(startIndex + PAGE_SIZE, rows.length);

    for (let i = startIndex; i < end; i++) {
        const row = rows[i];
        const cardElement = document.createElement("info-card");

        cardElement.setAttribute("name", row.name ?? "");
        cardElement.setAttribute("price", row.price ?? "");
        cardElement.setAttribute("discount_start", reverse(row.discount_start) ?? "");
        cardElement.setAttribute("discount_end", reverse(row.discount_end) ?? "");
        cardElement.setAttribute("supermarket", row.supermarket ?? "");
        cardElement.setAttribute("image_of_product", row.image_of_product ?? "");
        cardElement.setAttribute("type", row.type ?? "");

        const nSub = String(row.sub_category || "").replace(/-/g, "_");
        const nCat = String(row.category || "").replace(/-/g, "_");
        const nGrp = String(row.group || "").replace(/-/g, "_");

        cardElement.setAttribute("sub_category", nSub || row.sub_category || "");
        cardElement.setAttribute("category", nCat || row.category || "");
        cardElement.setAttribute("group", nGrp || row.group || "");
        cardElement.setAttribute("product_id", row.discounted_product_id ?? row.product_id ?? "");

        cardContainer.appendChild(cardElement);
    }

    return end;
}
