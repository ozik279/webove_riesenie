export function initSearchBarForSavedProducts() {
    const wrap = document.getElementById("title-and-quick-search");
    if (!wrap) return;

    const bar = document.createElement("div");
    bar.className = "filter-bar";
    bar.classList.add("right-item-grid");

    const label = document.createElement("span");
    label.textContent = "Hľadať:";
    label.style.whiteSpace = "nowrap";

    const input = document.createElement("input");
    input.id = "saved-search-input";
    input.type = "search";
    input.className = "form-control";
    input.style.maxWidth = "220px";
    input.placeholder = "Názov produktu...";

    const apply = () => {
        window.dispatchEvent(new CustomEvent("filters:changed"));
    };

    input.addEventListener("input", apply);

    bar.appendChild(label);
    bar.appendChild(input);
    //add bar after first element in main (which is title)
    wrap.appendChild(bar);


}