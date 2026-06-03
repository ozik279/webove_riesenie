import {icons} from "./icons.js";
import {getSession} from "../main_logic/auth.js";
import {supabase} from "./supabaseClient.js";
import {fromSiteRoot} from "./paths.js";
import infoCardStyles from "./InfoCard.css?inline";

export function showFavoriteNotice(message, type) {
    const el = document.createElement("div");
    el.classList.add("fav-notice");
    if(type === "add") el.classList.add("add");
    else if(type === "remove") el.classList.add("remove");
    else if(type === "error") el.classList.add("error");
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2800);
}

class InfoCard extends HTMLElement {

    static get observedAttributes() {
        return [
            'name',
            'price',
            'discount_start',
            'discount_end',
            'supermarket',
            'image_of_product',
            'is_saved',
            'wrapper',
        ];
    }

    constructor() {
        super();
        this.attachShadow({mode: 'open'});
        this.value = 0;

        const wrapper = document.createElement('div');
        wrapper.classList.add('card');
        this.wrapper = wrapper;

        // Ensure we can absolutely position the sticker within the card
        wrapper.style.position = "relative";

        this.marketIconElem = document.createElement("img");
        this.marketIconElem.classList.add("supermarket-sticker");
        this.marketIconElem.alt = "";
        this.marketIconElem.loading = "lazy";
        this.marketIconElem.decoding = "async";
        wrapper.appendChild(this.marketIconElem);

        const imgContainer = document.createElement('div');
        imgContainer.classList.add('img-container');
        wrapper.appendChild(imgContainer);

        this.imgElem = document.createElement('img');
        //lazy loading
        this.imgElem.loading = "lazy";
        this.imgElem.decoding = "async";
        this.imgElem.referrerPolicy = "no-referrer";
        imgContainer.appendChild(this.imgElem);

        const cardContent = document.createElement('div');
        cardContent.classList.add('content');

        // Name
        this.nameElem = document.createElement('p');
        this.nameElem.style.whiteSpace = "nowrap";
        this.nameElem.style.overflow = "hidden";
        this.nameElem.style.fontWeight = "600";
        this.nameElem.style.textOverflow = "ellipsis";
        this.nameElem.style.maxWidth = "100%";
        cardContent.appendChild(this.nameElem);

        // Row: supermarket + price (next to each other)
        const marketPriceRow = document.createElement("div");
        marketPriceRow.style.display = "flex";
        marketPriceRow.style.alignItems = "baseline";
        marketPriceRow.style.justifyContent = "space-between";
        marketPriceRow.style.gap = "0.75rem";

        this.supermarketElem = document.createElement('span');

        this.priceElem = document.createElement('span');
        this.priceElem.style.fontSize = "1.3rem";
        this.priceElem.style.fontWeight = "bold";
        this.priceElem.style.color = "#d9534f";
        this.priceElem.style.whiteSpace = "nowrap";

        marketPriceRow.appendChild(this.supermarketElem);
        marketPriceRow.appendChild(this.priceElem);
        cardContent.appendChild(marketPriceRow);

        // Date under the row
        this.dateElem = document.createElement('span');
        this.dateElem.style.marginTop = "auto";
        this.dateElem.style.marginBottom = "auto";
        this.dateElem.style.textAlign = "center";
        this.dateElem.style.fontWeight = "600";
        this.dateElem.style.background = "#111827";
        this.dateElem.style.color = "#fff";
        this.dateElem.style.padding = "2px 6px";
        this.dateElem.style.borderRadius = "4px";
        cardContent.appendChild(this.dateElem);

        cardContent.appendChild(document.createElement('hr'));

        this.saveButton = document.createElement("button");
        this.saveButton.type = "button";
        this.saveButton.classList.add("save-button");

        // State for UI checking of saved/unsaved button graphic for product
        this._isSaved = false;

        // Busy state for loading spinner
        this._busy = false;

        while (this.saveButton.firstChild) this.saveButton.removeChild(this.saveButton.firstChild);

        this._setButtonIcon(this.saveButton, fromSiteRoot("imagesForIconsForProducts/add-to-cart.png") ,
            "Pridaj medzi obľúbené", "save-button");
        this._setButtonIcon(this.saveButton, fromSiteRoot("imagesForIconsForProducts/remove-cart.png") ,
            "Odstráň z obľúbených", "delete-button", "none");

        cardContent.appendChild(this.saveButton);

        wrapper.appendChild(cardContent);

        const styleElem = document.createElement('style');
        styleElem.textContent = infoCardStyles;
        this.shadowRoot.appendChild(styleElem);

        this.shadowRoot.appendChild(wrapper);

        this._prevBodyOverflow = "";

        wrapper.addEventListener("click", (e) => {
            if (e.target.tagName.toLowerCase() === "button") return;
            this._openImageModal();
        });

    }

    _setBusy(isBusy, label = "Loading") {
        this._busy = !!isBusy;
        this.saveButton.disabled = this._busy;
        this.saveButton.style.opacity = this._busy ? "0.7" : "";

        if (this._busy) {
            this._renderSpinnerIcon(label);
        }
        else {
            this._applySavedUi(this._isSaved);
        }
    }

    _renderSpinnerIcon(label = "Loading") {
        while (this.saveButton.firstChild) this.saveButton.removeChild(this.saveButton.firstChild);

        const spinner = document.createElement("span");
        spinner.setAttribute("role", "status");
        spinner.setAttribute("aria-label", label);
        spinner.style.display = "inline-block";
        spinner.style.width = "26px";
        spinner.style.height = "26px";
        spinner.style.border = "3px solid rgba(0,0,0,0.2)";
        spinner.style.borderTopColor = "rgba(0,0,0,0.7)";
        spinner.style.borderRadius = "50%";
        spinner.style.animation = "infocard-spin 0.8s linear infinite";
        this.saveButton.appendChild(spinner);

        if (!this._spinnerStyleAdded) {
            const style = document.createElement("style");
            style.textContent = `
                @keyframes infocard-spin { to { transform: rotate(360deg); } }
            `;
            this.shadowRoot.appendChild(style);
            this._spinnerStyleAdded = true;
        }
    }

    _isLimit100Error(err) {
        // PostgREST errors from Supabase typically contain { code, message, details, hint }
        const code = String(err?.code ?? "");
        const msg = String(err?.message ?? "");
        return code === "P0001" || msg.toLowerCase().includes("only save up to 100");
    }

    async _saveToDb() {
        const { data, error } = await getSession();
        if (error) return { ok: false, reason: "session" };
        if (!data.session) return { ok: false, reason: "no_session" };

        const productId = this.getAttribute("product_id");
        if (!productId) return { ok: false, reason: "no_product_id" };

        // saved_products has only: user_id, discounted_product_id
        const payload = {
            user_id: data.session.user.id,
            discounted_product_id: productId,
        };

        const { error: upErr } = await supabase
            .from("saved_products")
            .insert(payload);

        if (upErr) {
            console.error("Save to DB error:", upErr);
            if (this._isLimit100Error(upErr)) return { ok: false, reason: "limit_100", error: upErr };
            return { ok: false, reason: "db", error: upErr };
        }

        return { ok: true };
    }

    async _removeFromDb() {
        const { data, error } = await getSession();
        if (error) return false;
        if (!data.session) return false;

        const productId = this.getAttribute("product_id");
        if (!productId) return false;

        const { error: delErr } = await supabase
            .from("saved_products")
            .delete()
            .eq("user_id", data.session.user.id)
            .eq("discounted_product_id", productId);

        if (delErr) {
            console.error("Remove from DB error:", delErr);
            return false;
        }

        return true;
    }

    async connectedCallback() {
        this._updateContent();

        const { data, error } = await getSession();
        if (error) return null;
        if (!data.session) {
            this._isSaved = false;
            this._applySavedUi(false);
        }

        const pageNow = String(window.location.pathname || "");
        if (pageNow.includes("moje_ulozene_produkty")) {
            // In "My saved products" page, all cards are already saved, so no need to check session storage for each card
            this._isSaved = true;
            this._applySavedUi(true);
        }

        else if(data.session && data.session.user && data.session.user.id) {
            // user-scoped cache key
            const productId = this.getAttribute("product_id");
            const userId = data.session.user.id;

            const savedCard = sessionStorage.getItem(`card_${userId}_${productId}`);
            if (savedCard) {
                this._isSaved = JSON.parse(savedCard).is_saved;
                this._applySavedUi(this._isSaved);
            }
        }

        this.saveButton.addEventListener("click", async () => {
            const { data, error } = await getSession();
            if (error) return null;
            if (!data.session) {
                window.location.href = fromSiteRoot("html/prihlasenie.html");
                return;
            }

            const productId = this.getAttribute("product_id");
            if (!productId) return;

            this._setBusy(true, this._isSaved ? "Removing" : "Saving");

            try {
                if (!this._isSaved) {
                    const res = await this._saveToDb();
                    if (!res?.ok) {
                        if (res?.reason === "limit_100") {
                            showFavoriteNotice("Môžete mať uložených maximálne 100 produktov.", "error");
                        }
                        else {
                            showFavoriteNotice("Produkt sa nepodarilo uložiť. Skúste to prosím znovu.", "error");
                        }
                        return;
                    }

                    const payload = {
                        product_id: productId,
                        is_saved: true,
                    };

                    const userId = data.session.user.id;
                    sessionStorage.setItem(`card_${userId}_${productId}`, JSON.stringify(payload));

                    this._isSaved = true;
                    showFavoriteNotice("Produkt uložený medzi obľúbené", "add");
                }
                else {
                    const ok = await this._removeFromDb();
                    if (!ok) {
                        showFavoriteNotice("Produkt sa nepodarilo odstrániť. Skúste to prosím znovu.", "error");
                        return;
                    }

                    const userId = data.session.user.id;
                    sessionStorage.removeItem(`card_${userId}_${productId}`);

                    this._isSaved = false;
                    showFavoriteNotice("Produkt odstránený z obľúbených", "remove");

                    if (pageNow.includes("moje_ulozene_produkty")) {
                        this.remove();
                    }

                    window.dispatchEvent(new CustomEvent("saved:removed", { detail: productId }));
                }
            }
            finally {
                this._setBusy(false);

            }
        });
    }

    _applySavedUi(isSaved) {
        // While busy, spinner should stay visible
        if (this._busy) return;

        if (isSaved) {
            this.saveButton.classList.remove("save-button");
            this.saveButton.classList.add("delete-button");
            while (this.saveButton.firstChild) this.saveButton.removeChild(this.saveButton.firstChild);

            this._setButtonIcon(
                this.saveButton,
                fromSiteRoot("imagesForIconsForProducts/add-to-cart.png"),
                "Pridaj medzi obľúbené",
                "save-button",
                "none"
            );
            this._setButtonIcon(
                this.saveButton,
                fromSiteRoot("imagesForIconsForProducts/remove-cart.png"),
                "Odstráň z obľúbených",
                "delete-button"
            );
        }
        else {
            this.saveButton.classList.remove("delete-button");
            this.saveButton.classList.add("save-button");
            while (this.saveButton.firstChild) this.saveButton.removeChild(this.saveButton.firstChild);

            this._setButtonIcon(
                this.saveButton,
                fromSiteRoot("imagesForIconsForProducts/add-to-cart.png"),
                "Pridaj medzi obľúbené",
                "save-button"
            );
            this._setButtonIcon(
                this.saveButton,
                fromSiteRoot("imagesForIconsForProducts/remove-cart.png"),
                "Odstráň z obľúbených",
                "delete-button",
                "none"
            );
        }
    }

    _updateSupermarketIcon() {
        const raw = this.getAttribute("supermarket") || "";
        const key = raw.toLowerCase().replace(/ /g, "");
        const src = icons?.[key];

        if (src) {
            this.marketIconElem.src = src;
            this.marketIconElem.alt = raw ? `${raw} logo` : "Supermarket logo";
            this.marketIconElem.style.display = "";
        }
        else {
            this.marketIconElem.removeAttribute("src");
            this.marketIconElem.alt = "";
            this.marketIconElem.style.display = "none";
        }
    }

    /*_reverseDate(date) {
        // Expects "DD.MM.YYYY" -> returns "YYYY-MM-DD"
        if (!date) return "";

        const parts = String(date).trim().split(".");
        if (parts.length !== 3) return "";

        let [day, month, year] = parts.map(s => s.trim());
        const d = Number(day);
        const m = Number(month);
        const y = Number(year);

        if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return "";
        if (y < 1000 || m < 1 || m > 12 || d < 1 || d > 31) return "";

        const dd = String(d).padStart(2, "0");
        const mm = String(m).padStart(2, "0");

        return `${y}-${mm}-${dd}`;
    }*/

    _updateContent() {
        this.imgElem.src = this.getAttribute("image_of_product") || "";
        this.supermarketElem.textContent = this.getAttribute('supermarket') || '';
        this.priceElem.textContent = (this.getAttribute('price') + " €") || '';
        this.dateElem.textContent = (this.getAttribute('discount_start') + " - "
            + this.getAttribute('discount_end')) || '';
        this.nameElem.textContent = this.getAttribute('name') || '';
        this._updateSupermarketIcon();


        /*const endIso = this._reverseDate(this.getAttribute("discount_end"));
        if (endIso) {
            const end = new Date(`${endIso}T23:59:59.999`);
            const now = new Date();
            this.wrapper.classList.toggle("discount-ended", now > end);
        }
        else {
            this.wrapper.classList.remove("discount-ended");
        }*/
    }

    _ensureImageModal() {
        if (this._modalEl) return;

        const modal = document.createElement("div");
        modal.style.position = "fixed";
        modal.style.inset = "0";
        modal.style.background = "rgba(0,0,0,0.35)";
        modal.style.display = "none";
        modal.style.alignItems = "center";
        modal.style.justifyContent = "center";
        modal.style.zIndex = "999999";
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.style.overflow = "auto";

        const img = document.createElement("img");
        img.style.maxWidth = "100vw";
        img.style.maxHeight = "100vh";
        img.style.width = "auto";
        img.style.height = "auto";
        img.style.objectFit = "contain";
        img.style.cursor = "zoom-in";
        img.addEventListener("click", () => {
            if(this._zoom >= this._ZOOM_MAX) {
                this._zoom = 1;
                img.style.transform = `scale(${this._zoom})`;
                img.style.cursor = "zoom-in";
                return;
            }
            this._zoom = Math.min(this._zoom + this._ZOOM_STEP, this._ZOOM_MAX);
            img.style.transform = `scale(${this._zoom})`;
            if(this._zoom >= this._ZOOM_MAX) img.style.cursor = "zoom-out";
            else img.style.cursor = "zoom-in";
        });

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.textContent = "\u2715";
        closeBtn.setAttribute("aria-label", "Close");
        closeBtn.style.position = "fixed";
        closeBtn.style.top = "17px";
        closeBtn.style.right = "56px";
        closeBtn.style.lineHeight = "20px";
        closeBtn.style.padding = "8px 12px";
        closeBtn.style.cursor = "pointer";
        closeBtn.style.fontWeight = "bold";
        //closeBtn.style.background = "transparent";
        closeBtn.style.borderRadius = "10px";
        closeBtn.style.border = "0";
        closeBtn.style.color = "black";
        closeBtn.addEventListener("click", () => this._closeImageModal());

        // Zoom state
        this._zoom = 1;
        this._ZOOM_MIN = 0.5;
        this._ZOOM_MAX = 2.0;
        this._ZOOM_STEP = 0.5;

        const zoomINBtn = document.createElement("button");
        zoomINBtn.type = "button";
        zoomINBtn.setAttribute("aria-label", "Zoom in");
        zoomINBtn.style.position = "fixed";
        zoomINBtn.style.top = "12px";
        zoomINBtn.style.left = "56px";
        zoomINBtn.style.padding = "8px 12px";
        zoomINBtn.style.cursor = "pointer";
        //zoomINBtn.style.background = "transparent";
        zoomINBtn.style.borderRadius = "10px";
        zoomINBtn.style.border = "0";
        zoomINBtn.style.color = "black";
        zoomINBtn.addEventListener("click", () => this._zoomInImage())

        const zoomOUTBtn = document.createElement("button");
        zoomOUTBtn.type = "button";
        zoomOUTBtn.setAttribute("aria-label", "Zoom in");
        zoomOUTBtn.style.position = "fixed";
        zoomOUTBtn.style.top = "12px";
        zoomOUTBtn.style.left = "120px";
        zoomOUTBtn.style.padding = "8px 12px";
        zoomOUTBtn.style.cursor = "pointer";
        //zoomOUTBtn.style.background = "transparent";
        zoomOUTBtn.style.borderRadius = "10px";
        zoomOUTBtn.style.border = "0";
        zoomOUTBtn.style.color = "black";
        zoomOUTBtn.addEventListener("click", () => this._zoomOutImage())

        this._setButtonIcon(zoomINBtn, fromSiteRoot("imagesForIconsForProducts/zoom-in.png"), "Zoom in");
        this._setButtonIcon(zoomOUTBtn, fromSiteRoot("imagesForIconsForProducts/zoom-out.png"), "Zoom out");


        modal.addEventListener("click", (e) => {
            if (e.target === modal) this._closeImageModal();
        });

        this._onKeyDown = (e) => {
            if (e.key === "Escape") this._closeImageModal();
        };

        modal.appendChild(img);
        modal.appendChild(closeBtn);
        modal.appendChild(zoomINBtn);
        modal.appendChild(zoomOUTBtn);

        this._modalEl = modal;
        this._modalImgEl = img;

        document.body.appendChild(modal);
    }

    _setButtonIcon(btn, src, alt, id = null, display = null) {
        const icon = document.createElement("img");
        icon.src = src;
        icon.alt = alt;
        icon.width = 32;
        icon.height = 32;
        if(id) icon.id = id;
        if(display) icon.style.display = display;
        else icon.style.display = "block";
        icon.style.pointerEvents = "none"; // keep clicks on the button
        btn.appendChild(icon);
    }

    _openImageModal() {
        const src = this.getAttribute("image_of_product");
        if (!src) return;

        this._ensureImageModal();

        // Lock page scroll
        this._prevBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        this._modalImgEl.src = src;
        this._modalEl.style.display = "flex";
        document.addEventListener("keydown", this._onKeyDown, { passive: true });
    }

    _closeImageModal() {
        if (!this._modalEl) return;
        this._modalEl.style.display = "none";
        this._modalImgEl.src = "";
        this._zoom = 1;
        this._modalImgEl.style.transform = `scale(${this._zoom})`;
        document.removeEventListener("keydown", this._onKeyDown);

        // Unlock page scroll (restore previous value)
        document.body.style.overflow = this._prevBodyOverflow || "";
    }

    _zoomInImage(){
        if(!this._modalEl) return;
        this._zoom = Math.min(this._zoom + this._ZOOM_STEP, this._ZOOM_MAX);
        this._modalImgEl.style.transform = `scale(${this._zoom})`;
    }

    _zoomOutImage(){
        if(!this._modalEl) return;
        this._zoom = Math.max(this._zoom - this._ZOOM_STEP, this._ZOOM_MIN);
        this._modalImgEl.style.transform = `scale(${this._zoom})`;
    }
}

customElements.define('info-card', InfoCard);
