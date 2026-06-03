import {getSession} from "../main_logic/auth.js";
import {fromSiteRoot} from "./paths.js";

export function initIcon(userIcon, data) {
    if (!userIcon) return;

    if (data?.session) {
        userIcon.classList.remove("fa-user");
        userIcon.classList.add("fa-user-check");
    }
    else {
        userIcon.classList.remove("fa-user-check");
        userIcon.classList.add("fa-user");
    }
}

export async function initLoginButton() {
    const button = document.getElementById("login-button");
    const userIcon = document.getElementById("login-icon");

    if (!button) return;

    button.addEventListener("click", () => {
        window.location.assign(fromSiteRoot("html/prihlasenie.html"));
    });

    const {data, error} = await getSession();
    if (error) return null;

    initIcon(userIcon, data)
}
