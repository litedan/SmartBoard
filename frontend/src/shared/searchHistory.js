const STORAGE_KEY = "smartboard_search_history";
const MAX_ITEMS = 8;

export function getSearchHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string" && item.trim()) : [];
  } catch {
    return [];
  }
}

export function addSearchHistory(query) {
  const normalized = query.trim();
  if (!normalized) {
    return getSearchHistory();
  }

  const next = [normalized, ...getSearchHistory().filter((item) => item !== normalized)].slice(0, MAX_ITEMS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearSearchHistory() {
  localStorage.removeItem(STORAGE_KEY);
}
