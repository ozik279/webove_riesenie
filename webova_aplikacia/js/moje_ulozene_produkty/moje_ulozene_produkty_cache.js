import "../components/InfoCard.js"
import {initFilter} from "../components/filter.js";
import {initDynamicNavbar} from "../components/dynamic_navbar.js";
import {filterByPrice} from "../components/filterByPrice.js";
import {initLoadingUpperPart} from "../main_logic/loadingUpperPart.js";

function loadSavedCards() {
    const saved = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("card_")) {
            const obj = JSON.parse(localStorage.getItem(key));
            if (obj && obj.name) saved.push(obj);
        }
    }
    return saved;
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
        cardElement.setAttribute("discount_start", card.discount_start);
        cardElement.setAttribute("discount_end", card.discount_end);
        cardElement.setAttribute("supermarket", card.supermarket);
        cardElement.setAttribute("image_of_product", card.image_of_product);
        cardElement.setAttribute("type", card.type);
        cardElement.setAttribute("sub_category", card.sub_category);
        cardElement.setAttribute("category", card.category);
        cardElement.setAttribute("group", card.group);

        cardContainer.appendChild(cardElement);
    });
}

window.addEventListener("DOMContentLoaded", async() => {
    await initLoadingUpperPart();
    await initDynamicNavbar();
    const saved = loadSavedCards();
    filterByPrice();
    initFilter(saved, "sub_category");
    initFilter(saved, "type");
    initFilter(saved, "supermarket");
    renderCards(saved);
});