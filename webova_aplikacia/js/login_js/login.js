// js/login_js/login.js
import { initLoadingUpperPart } from "../main_logic/loadingUpperPart.js";
import { initDynamicNavbar } from "../components/dynamic_navbar.js";
import { signInEmail, getSession, signOut } from "../main_logic/auth.js";
import {validateAll } from "../main_logic/validations.js";
import {initCacheFromDB, startSavedProductsCacheSync} from "../main_logic/loadingCacheFromDB.js";
import {clearUserCache} from "../main_logic/clearUserCahce.js";

async function initLoggedInBehaviour() {
    const { data, error } = await getSession();
    if (error) return null;

    const mainContainer = document.getElementById("logged-in-or-message");
    if (!mainContainer) return null;

    mainContainer.innerHTML = "";

    if (data?.session) {
        mainContainer.innerHTML = `
              <div class="container" style="display: flex; flex-direction: column; text-align: center">
                <span style="font-size: 1.2rem; font-weight: 500">
                    Vítame ťa späť, <b>${data.session.user.email}</b>!
                    </span>
                <span>
                  Ste úspešne <b>prihlásený!</b> Teraz si môžte začať ukladať produkty a prezerať si ich v záložke moje uložené produkty.
                </span>
                <a href="/html/moje_ulozene_produkty.html">Prezrite si svoje uložené produkty.</a>
        
                <div style="margin: auto">
                  <button id="odhlasenie-button" type="button" class="btn btn-danger">
                    Odhlásiť sa
                  </button>
                </div>
              </div>
    `;

        const userId = data.session.user.id;
        const logoutBtn = document.getElementById("odhlasenie-button");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", async () => {
                await signOut();
                clearUserCache(userId)
                window.location.reload();
            });
        }
    }

    else {
        mainContainer.innerHTML = `
            <div class="loggin-form">
              <form id="prihlasenie-form" novalidate>
                <div class="mb-3">
                  <h3 class="mb-3">Prihlásenie</h3>
                  <div style="display: flex; flex-direction: column; width: 80%; margin: auto">
        
                    <label for="email-prihlasenie" class="form-label" style="display: flex">
                      E-mail
                      <span style="color: red">*</span>
                      <span id="error-message-email" style="color: red; margin-left: auto; font-size: 0.85rem"></span>
                    </label>
        
                    <input type="email" class="form-control" id="email-prihlasenie" aria-describedby="emailHelp">
        
                    <label for="password-prihlasenie" class="form-label mt-3" style="display: flex">
                      Heslo
                      <span style="color: red">*</span>
                      <span id="error-message-password" style="color: red; margin-left: auto; font-size: 0.85rem"></span>
                    </label>
        
                    <input type="password" class="form-control" id="password-prihlasenie">
        
                    <button id="prihlasenie-button" type="submit" class="btn btn-primary" style="margin-top: 1rem">
                      Prihlásiť sa
                    </button>
                    <span id="error-message-supabase" style="color: red; font-size: 0.85rem"></span>
        
                    <span class="mt-3" style="font-weight: lighter; font-size: 0.9rem">
                      Aby ste si mohli ukladať produkty a prezerať si ich v záložke moje obľúbené, musíte byť prihlásený.
                    </span>
                    <span class="mt-2">Ešte nemám účet, chcem sa <a href="./registracia.html">zaregistrovať</a></span>
                  </div>
                </div>
              </form>
            </div>
  `;
        initLoginForm();
    }
}

function initLoginForm() {
    const loginForm = document.getElementById("prihlasenie-form");
    const loginBtn = document.getElementById("prihlasenie-button");

    const emailInput = document.getElementById("email-prihlasenie");
    const passwordInput = document.getElementById("password-prihlasenie");
    const errorMsgEmail = document.getElementById("error-message-email");
    const errorMsgPassword = document.getElementById("error-message-password");

    if (!loginForm || !loginBtn || !emailInput || !passwordInput || !errorMsgPassword || !errorMsgEmail) return;

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const errorMsgSupabase = document.getElementById("error-message-supabase");
        errorMsgSupabase.textContent = "";

        if (!validateAll(emailInput, passwordInput, errorMsgEmail, errorMsgPassword)) return;

        const email = String(emailInput.value ?? "").trim();
        const password = String(passwordInput.value ?? "");

        loginBtn.disabled = true;
        const { error } = await signInEmail(email, password);
        loginBtn.disabled = false;

        if (error) {
            errorMsgSupabase.textContent = "Nesprávny e-mail alebo heslo.";
            emailInput.classList.add("invalid");
            passwordInput.classList.add("invalid");
            return;
        }

        window.location.reload();
    });
}

window.addEventListener("DOMContentLoaded", async () => {
    await initLoadingUpperPart();
    await initLoggedInBehaviour();
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

