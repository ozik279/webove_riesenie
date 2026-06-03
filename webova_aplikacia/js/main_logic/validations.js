function validateEmail(email, errorMsgEmail) {
    if (!email){
        errorMsgEmail.textContent = "Zadajte email";
        return false;
    }

    // at least 1 symbol, then "@", then domain, then ".tld"
    // examples: a@b.org, name@domain.com
    const emailRegex = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

    if (!emailRegex.test(email)) {
        errorMsgEmail.textContent = "Neplatná forma emailu!";
        return false;
    }
    errorMsgEmail.textContent = "";
    return true;
}

function validatePassword(password ,errorMsgPassword) {
    if (!password){
        errorMsgPassword.textContent = "Zadajte heslo";
        return false;
    }
    if(password.length < 6){
        errorMsgPassword.textContent = "Heslo je moc krátke!";
        return false;
    }
    errorMsgPassword.textContent = "";
    return true;
}

function setValidClass(inputEl, isValid) {
    if (isValid) inputEl.classList.remove("invalid");
    else inputEl.classList.add("invalid");
}

export function validateAll(emailInput, passwordInput, errorMsgEmail, errorMsgPassword){

    const email = String(emailInput.value ?? "").trim();
    const password = String(passwordInput.value ?? "");

    const emailOk = validateEmail(email, errorMsgEmail);
    const passOk = validatePassword(password, errorMsgPassword);

    setValidClass(emailInput, emailOk);
    setValidClass(passwordInput, passOk);

    return emailOk && passOk;
}

