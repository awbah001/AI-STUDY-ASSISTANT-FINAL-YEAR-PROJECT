import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";
import { trpc, bumpAuthSession } from "../lib/api";
import { setAuthSessionKey } from "../lib/authSession";
import { registerForPushNotifications } from "../lib/notifications";
import { setOfflineOwner } from "../lib/offlineStudy";

const TOKEN_KEY = "cognify_auth_token";

type AuthUser = {
  id: number;
  name: string | null;
  email: string | null;
  role: string;
  avatarUrl: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const savePushToken = trpc.auth.savePushToken.useMutation();

  // Cold start always requires an explicit login. Do not restore a previous session.
  useEffect(() => {
    (async () => {
      bumpAuthSession();
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setAuthSessionKey("guest");
      setTokenState(null);
      setUser(null);
      setLoading(false);
    })();
  }, []);

  // Refresh user info when token changes
  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: !!token,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (meQuery.data) {
      const next = meQuery.data as AuthUser;
      setUser(next);
      setAuthSessionKey(`user-${next.id}`);
      return;
    }
    if (meQuery.isError && !meQuery.isLoading) {
      setUser(null);
      setAuthSessionKey("guest");
    }
  }, [meQuery.data, meQuery.isError, meQuery.isLoading]);

  // When a student is logged in, register their push token with the server
  useEffect(() => {
    if (!user || user.role !== "user") return;
    registerForPushNotifications().then((pushToken) => {
      if (pushToken) {
        savePushToken.mutate({ token: pushToken });
      }
    });
  }, [user?.id]);

  const login = useCallback(async (newToken: string, newUser: AuthUser) => {
    bumpAuthSession();
    await SecureStore.setItemAsync(TOKEN_KEY, newToken);
    await setOfflineOwner(newUser.id);
    setAuthSessionKey(`user-${newUser.id}`);
    setTokenState(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    bumpAuthSession();
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await setOfflineOwner(null);
    setAuthSessionKey("guest");
    setTokenState(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
