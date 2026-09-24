let sessionKey = "guest";
const listeners = new Set<() => void>();

export function getAuthSessionKey() {
  return sessionKey;
}

export function setAuthSessionKey(next: string) {
  if (sessionKey === next) return;
  sessionKey = next;
  listeners.forEach((listener) => listener());
}

export function subscribeAuthSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
