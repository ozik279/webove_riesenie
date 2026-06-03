import {initLoadingUpperPart} from "../main_logic/loadingUpperPart.js";
import {initDynamicNavbar} from "../components/dynamic_navbar.js";
import {getSession, registrationEmail} from "../main_logic/auth.js";
import {validateAll} from "../main_logic/validations.js";
import {initCacheFromDB, startSavedProductsCacheSync} from "../main_logic/loadingCacheFromDB.js";
import {absoluteUrlFromSiteRoot, fromSiteRoot} from "../components/paths.js";

function initRegistrationForm() {
    const regBtn = document.getElementById("registracia-button");
    const registrationForm = document.getElementById("registracia-form");

    const emailInput = document.getElementById("email-registracia");
    const passwordInput = document.getElementById("password-registracia");
    const errorMsgEmail = document.getElementById("error-message-email-registracia");
    const errorMsgPassword = document.getElementById("error-message-password-registracia");

    if (!regBtn || !emailInput || !passwordInput || !registrationForm || !errorMsgEmail || !errorMsgPassword) return;

    registrationForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = String(emailInput.value ?? "").trim();
        const password = String(passwordInput.value ?? "");

        const errorMsgSupabase = document.getElementById("error-message-supabase-registration");
        errorMsgSupabase.textContent = "";

        if (!validateAll(emailInput, passwordInput, errorMsgEmail, errorMsgPassword)) return;

        regBtn.disabled = true;

        // Supabase expects an absolute URL here.
        // Make sure this URL is whitelisted in Supabase Auth -> URL Configuration -> Redirect URLs.
        const emailRedirectTo = absoluteUrlFromSiteRoot("html/prihlasenie.html");

        const { data, error } = await registrationEmail(email, password, emailRedirectTo);

        regBtn.disabled = false;

        if (error) {
            errorMsgSupabase.textContent = "Niečo sa pokazilo, skúste to znovu neskôr prosím.";
            return;
        }

        // If email confirmation is enabled, session is typically null here.
        if (!data?.session) {
            return;
        }

        window.location.href = fromSiteRoot("html/prihlasenie.html");
    });
}


window.addEventListener("DOMContentLoaded", async () => {
    await initLoadingUpperPart();
    initRegistrationForm();
    await initDynamicNavbar();

    const { data, error } = await getSession();
    if (error) return;
    if (!data.session) return;

    const userId = data.session.user.id;

    if (sessionStorage.getItem(`first_load_${userId}`)) return;

    const ok = await initCacheFromDB();
    if (ok) sessionStorage.setItem(`first_load_${userId}`, "true");

    await startSavedProductsCacheSync();
});
