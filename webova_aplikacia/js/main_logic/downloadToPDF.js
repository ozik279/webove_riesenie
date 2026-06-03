export function initDownloadToPDFButton() {
    const button = document.getElementById("download-pdf-button");
    const container = document.getElementById("card-container");

    if (!button || !container) return;

    // Prevent duplicate init / multiple listeners
    if (button.dataset.printInit === "true") return;
    button.dataset.printInit = "true";

    const doPrint = () => {
        // Allow print only if at least one real card is rendered in the container.
        const cards = container.querySelectorAll("info-card");
        if (!cards || cards.length === 0) {
            console.warn("Print: no cards to export.");
            return;
        }

        window.print();
    };

    // Button click triggers Ctrl+P page
    button.addEventListener("click", (e) => {
        e.preventDefault();
        doPrint();
    });
}
