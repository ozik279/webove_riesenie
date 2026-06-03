// js/components/dynamic_navbar.js
import { supabase } from "./supabaseClient.js";
import {keywords} from "./keywords.js";
import {icons} from "./icons.js";
import {fromSiteRoot} from "./paths.js";

async function selectAllProductsGroupCategorySub() {
    const { data, error } = await supabase
        .from("navigation_menu")
        .select("group_name,category_name,subcategory_name");

    if (error) throw error;
    return data ?? [];
}

// Mobile-first: click toggling only on small screens to avoid fighting hover CSS on desktop
//TODO POCHOPIT JAK TO FUNGUJE
function wireNestedDropdowns(rootEl) {
    if (!rootEl) return;

    const mqDesktop = window.matchMedia("(min-width: 1388px)");
    const isDesktop = () => mqDesktop.matches;

    const closeAllSubmenus = () => {
        rootEl.querySelectorAll(".dropend.open").forEach((li) => li.classList.remove("open"));
    };

    // Only mobile: click-to-toggle nested submenus
    rootEl.querySelectorAll(".dropend > .dropdown-toggle").forEach((toggle) => {
        toggle.addEventListener("click", (e) => {
            if (isDesktop()) return;

            e.preventDefault();
            e.stopPropagation();

            const li = toggle.closest(".dropend");
            if (!li) return;

            const parentMenu = li.closest(".dropdown-menu");
            if (!parentMenu) return;

            parentMenu.querySelectorAll(":scope > .dropend.open").forEach((sib) => {
                if (sib !== li) sib.classList.remove("open");
            });

            li.classList.toggle("open");
        });
    });

    // Only mobile: close submenus when clicking outside
    document.addEventListener("click", (e) => {
        if (isDesktop()) return;
        if (rootEl.contains(e.target)) return;
        closeAllSubmenus();
    });

    // When switching to desktop: clear mobile state
    const onMqChange = () => {
        if (isDesktop()) closeAllSubmenus();
    };
    mqDesktop.addEventListener("change", onMqChange);
}

export async function initDynamicNavbar() {
    const navbarEl = document.getElementById("navbar");
    if (!navbarEl) return;

    const mqDesktop = window.matchMedia("(min-width: 1388px)");
    const isDesktop = () => mqDesktop.matches;

    const render = async () => {
        const rows = await selectAllProductsGroupCategorySub();

        const escapeHtml = (v) =>
            String(v ?? "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");

        const iconImgFor = (raw, { className = "nav-icon", size = 20 } = {}) => {
            const key = escapeHtml(raw).replace(/-/g, "_");
            const src = icons[key];
            if (!src) return "";

            const safeSrc = escapeHtml(src);
            const safeAlt = escapeHtml(raw);

            return `<img class="${className}" src="${safeSrc}" alt="${safeAlt}" width="${size}" height="${size}" loading="lazy" decoding="async" />`;
        };

        const hrefForSub = (group, category, subCategory) =>
            `${fromSiteRoot("html/product-list.html")}?${new URLSearchParams({
                group,
                category,
                sub_category: subCategory,
            }).toString()}`;

        const map = new Map();
        for (const r of rows ?? []) {
            const grp = String(r?.group_name ?? "").trim();
            const cat = String(r?.category_name ?? "").trim();
            const sub = String(r?.subcategory_name ?? "").trim();
            if (!grp || !cat || !sub) continue;

            if (!map.has(grp)) map.set(grp, new Map());
            const catMap = map.get(grp);

            if (!catMap.has(cat)) catMap.set(cat, new Set());
            catMap.get(cat).add(sub);
        }

        const labelFor = (raw) => {
            const key = escapeHtml(raw).replace(/-/g, "_");
            return keywords[key] || key;
        };

        const savedIcon = iconImgFor("ulozene", { className: "nav-icon me-2", size: 22 })

        const itemsHtml = Array.from(map.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([grp, catMap], gIdx) => {
                const groupDropdownId = `grp-${gIdx}`;
                const groupLabel = labelFor(grp);
                const groupIcon = iconImgFor(grp, { className: "nav-icon me-2", size: 22 });

                // Mobile: Bootstrap click dropdown. Desktop: hover only (no data-bs-toggle).
                const groupToggleAttr = isDesktop() ? "" : ' data-bs-toggle="dropdown"';

                const catsHtml = Array.from(catMap.entries())
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([cat, subSet], cIdx) => {
                        const catLabel = labelFor(cat);
                        const catIcon = iconImgFor(cat, { className: "nav-icon me-2", size: 22 });
                        const subs = Array.from(subSet).sort((a, b) => a.localeCompare(b));

                        const submenuId = `grp-${gIdx}-cat-${cIdx}`;
                        const subsLinks = subs
                            .map(
                                (sub) => `
                  <li>
                    <a class="dropdown-item" href="${hrefForSub(grp, cat, sub)}">
                      ${labelFor(sub)}
                    </a>
                  </li>
                `
                            )
                            .join("");

                        return `
              <li class="dropend">
                <a class="dropdown-item dropdown-toggle" href="#" id="${submenuId}" role="button" aria-expanded="false">
                  ${catIcon + catLabel}
                </a>
                <ul class="dropdown-menu" aria-labelledby="${submenuId}">
                  ${subsLinks}
                </ul>
              </li>
            `;
                    })
                    .join("");

                return `
          <li class="nav-item dropdown">
            <a class="nav-link dropdown-toggle" href="#" id="${groupDropdownId}" role="button"${groupToggleAttr} aria-expanded="false">
              ${groupIcon + groupLabel}
            </a>
            <ul class="dropdown-menu" aria-labelledby="${groupDropdownId}">
              ${catsHtml}
            </ul>
          </li>
        `;
            })
            .join("");

        navbarEl.innerHTML = `
      <div class="container-fluid">
        <a class="navbar-brand" href="${fromSiteRoot("index.html")}">Domov</a>

        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>

        <div class="collapse navbar-collapse" id="navbarSupportedContent">
          <ul class="navbar-nav me-auto mb-2 mb-lg-0 dynamic-navbar">
            ${itemsHtml}
          </ul>

          <a href="${fromSiteRoot("html/moje_ulozene_produkty.html")}" class="nav-link">
            ${savedIcon + "Moje uložené produkty"}
          </a>
        </div>
      </div>
    `;

        wireNestedDropdowns(navbarEl);
    };

    try {
        await render();

        // Re-render on breakpoint change so group toggles switch between hover (desktop) and click (mobile)
        const onMqChange = async () => {
            try {
                await render();
            }
            catch (e) {
                console.error("[dynamic_navbar] re-render failed:", e);
            }
        };
        mqDesktop.addEventListener("change", onMqChange);
    }
    catch (e) {
        console.error("[dynamic_navbar] nav build failed:", e);
        navbarEl.innerHTML = `<div class="container-fluid"><span class="navbar-text">Failed to load navigation</span></div>`;
    }
}
