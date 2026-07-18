import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";
import { trpc } from "../lib/api";

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
  const utils = trpc.useUtils();

  // On mount, restore token and fetch current user
  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync(TOKEN_KEY);
      if (stored) {
        setTokenState(stored);
      }
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
      setUser(meQuery.data as AuthUser);
    } else if (!meQuery.isLoading && token) {
      // Token invalid — clear it
      setUser(null);
    }
  }, [meQuery.data, meQuery.isLoading, token]);

  const login = useCallback(async (newToken: string, newUser: AuthUser) => {
    await SecureStore.setItemAsync(TOKEN_KEY, newToken);
    setTokenState(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setTokenState(null);
    setUser(null);
    utils.auth.me.setData(undefined, null);
  }, [utils]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
