import {keywords} from "./keywords.js";

const activeFilters = {};
let currentData = [];

// small helper (keeps comparisons consistent)
function norm(v) {
    return String(v ?? "");
}

function keywordKey(v) {
    return String(v ?? "").replace(/-/g, "_");
}

export function initFilter(data, filterBy) {
    // store dataset once (initFilter is called multiple times for different keys)
    if (Array.isArray(data) && (data.length || !currentData.length)) currentData = data;

    const values = Array.from(new Set((currentData ?? []).map((d) => d?.[filterBy]).filter(Boolean))).sort();

    const cardContainer = document.getElementById("card-container");
    if (!cardContainer) return;

    const bar = document.createElement("div");
    bar.className = "filter-bar";
    bar.style.display = "flex";
    bar.style.gap = "0.5rem";
    bar.style.alignItems = "center";

    const label = document.createElement("label");
    label.setAttribute("for", `filter-${filterBy}`);
    if(filterBy === "type") label.textContent = "Filtrovať podľa značky potraviny:";
    else if(filterBy === "supermarket") label.textContent = "Filtrovať podľa supermarketu:";
    else if(filterBy === "sub_category") label.textContent = "Filtrovať podľa druhu potraviny:";
    label.style.whiteSpace = "nowrap";

    const select = document.createElement("select");
    select.id = `filter-${filterBy}`;
    select.className = "form-select";
    select.style.maxWidth = "220px";

    const allOpt = document.createElement("option");
    allOpt.value = "Všetky";
    allOpt.textContent = "Všetky" + " (" + data.length + ")";
    allOpt.selected = true;
    select.appendChild(allOpt);

    values.forEach(t => {
        const opt = document.createElement("option");
        // Keep the real filter value stable
        opt.value = t;

        const preLabel = String(t || "").replace(/-/g, "_");

        // Show keyword (friendly label) but count by the raw value
        const labelText = keywords?.[preLabel] ?? preLabel;
        const count = data.filter((d) => d[filterBy] === t).length;

        opt.textContent = `${labelText} (${count})`;
        select.appendChild(opt);
    });

    select.addEventListener("change", () => {
        activeFilters[filterBy] = select.value;

        updateNumberOfProducts();
        // notify product_list.js so Load more paginates filtered rows
        window.dispatchEvent(new CustomEvent("filters:changed"));
    });

    bar.appendChild(label);
    bar.appendChild(select);

    const searchFilterContainer = document.getElementById("search-filter-container");
    searchFilterContainer.appendChild(bar);

    // initial labels/counts
    updateNumberOfProducts();
}

//TODO pochopit!!

// Counts are computed from FULL data, but respecting other active filters.
function updateNumberOfProducts() {
    const data = Array.isArray(currentData) ? currentData : [];
    const selects = document.querySelectorAll("select[id^='filter-']");

    const matchesExcept = (row, ignoreFilterBy) => {
        for (const [key, value] of Object.entries(activeFilters)) {
            if (key === ignoreFilterBy) continue;
            if (!value || value === "Všetky") continue;
            if (norm(row?.[key]) !== norm(value)) return false;
        }
        return true;
    };

    selects.forEach((select) => {
        const filterBy = select.id.replace("filter-", "");

        select.querySelectorAll("option").forEach((opt) => {
            const labelText =
                opt.value === "Všetky" ? "Všetky" : (keywords?.[keywordKey(opt.value)] ?? String(opt.value ?? ""));

            if (opt.value === "Všetky") {
                const total = data.reduce(
                    (acc, row) => (matchesExcept(row, filterBy) ? acc + 1 : acc),
                    0,
                );
                opt.textContent = `${labelText} (${total})`;
                return;
            }

            const count = data.reduce((acc, row) => {
                if (!matchesExcept(row, filterBy)) return acc;
                return norm(row?.[filterBy]) === norm(opt.value) ? acc + 1 : acc;
            }, 0);

            opt.textContent = `${labelText} (${count})`;
        });
    });
}
