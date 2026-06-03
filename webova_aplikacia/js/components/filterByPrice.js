export function filterByPrice() {

    const wrap = document.getElementById("price-filter-container");
    if (!wrap) return;

    wrap.innerHTML = "";

    const secondaryWrap = document.createElement("div");
    secondaryWrap.className = "filter-bar";
    secondaryWrap.style.display = "flex";
    secondaryWrap.style.gap = "0.5rem";
    secondaryWrap.style.alignItems = "center";

    const title = document.createElement("span");
    title.textContent = "Zoradiť podľa ceny:";
    title.style.whiteSpace = "nowrap";
    secondaryWrap.appendChild(title);

    const select = document.createElement("select");
    select.className = "form-select";
    select.style.maxWidth = "220px";

    const optDefault = document.createElement("option");
    optDefault.value = "";
    optDefault.textContent = "Pôvodné poradie";
    optDefault.selected = true;

    const optAsc = document.createElement("option");
    optAsc.value = "asc";
    optAsc.textContent = "Od najlacnejšieho";

    const optDesc = document.createElement("option");
    optDesc.value = "desc";
    optDesc.textContent = "Od najdrahšieho";

    select.appendChild(optDefault);
    select.appendChild(optAsc);
    select.appendChild(optDesc);

    secondaryWrap.appendChild(select);
    wrap.appendChild(secondaryWrap);

    const apply = () => {
        window.dispatchEvent(new CustomEvent("filters:changed"));
    };

    select.addEventListener("change", apply);
}