const COOKIE_NAME = 'soql_saved_queries';
const MAX_SAVED_QUERIES = 20;

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setCookie(name: string, value: string, days = 30): void {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function loadSavedQueries(): string[] {
  try {
    const raw = getCookie(COOKIE_NAME);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    }
  } catch (error) {
    console.error('Failed to parse saved queries cookie', error);
  }
  return [];
}

export function saveQueryToCookie(query: string, currentList: string[] = []): string[] {
  const trimmed = query.trim();
  if (!trimmed) return currentList;
  const nextList = [trimmed, ...currentList.filter(item => item !== trimmed)].slice(0, MAX_SAVED_QUERIES);
  try {
    setCookie(COOKIE_NAME, JSON.stringify(nextList));
  } catch (error) {
    console.error('Failed to save queries to cookie', error);
  }
  return nextList;
}

export function removeQueryFromCookie(queryToRemove: string, currentList: string[] = []): string[] {
  const nextList = currentList.filter(item => item !== queryToRemove);
  try {
    setCookie(COOKIE_NAME, JSON.stringify(nextList));
  } catch (error) {
    console.error('Failed to update queries cookie', error);
  }
  return nextList;
}

export function clearSavedQueries(): string[] {
  try {
    setCookie(COOKIE_NAME, JSON.stringify([]), -1);
  } catch (error) {
    console.error('Failed to clear queries cookie', error);
  }
  return [];
}
