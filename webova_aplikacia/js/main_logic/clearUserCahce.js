export function clearUserCache(userId) {
    // Remove per-user flags
    sessionStorage.removeItem(`first_load_${userId}`);

    // Remove all saved-card entries for this user
    const prefix = `card_${userId}_`;
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(prefix)) sessionStorage.removeItem(k);
    }
}