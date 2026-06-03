import {initSearch} from "../components/search.js";
import {initDownloadToPDFButton} from "./downloadToPDF.js";
import {initLoginButton} from "../components/loginButton.js";

export async function initLoadingUpperPart() {
    initSearch();
    initDownloadToPDFButton();
    await initLoginButton();
}
