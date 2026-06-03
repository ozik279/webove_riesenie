function isHtmlPage() {
    const pathname = String(window.location.pathname || "").replace(/\\/g, "/");
    return pathname.includes("/html/");
}

export function fromSiteRoot(path) {
    const cleanPath = String(path ?? "").replace(/^\/+/, "");
    return `${isHtmlPage() ? "../" : "./"}${cleanPath}`;
}

export function urlFromSiteRoot(path) {
    return new URL(fromSiteRoot(path), window.location.href);
}

export function absoluteUrlFromSiteRoot(path) {
    return urlFromSiteRoot(path).toString();
}
