const KEY = "auth_token";

export function getAuthToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function setAuthToken(token: string) {
  localStorage.setItem(KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(KEY);
}

