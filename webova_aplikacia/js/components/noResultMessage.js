export function noResultMessageInit() {
    const msg = document.createElement("div");
    msg.id = "no-results-message";
    msg.textContent = "Nenašli sa žiadne potraviny vyhovujúce vašim požiadavkám.";
    msg.style.display = "none";
    msg.style.fontSize = "0.9rem";
    msg.style.color = "#6c757d";
    msg.style.padding = "0.5rem 0";
    return msg;
}