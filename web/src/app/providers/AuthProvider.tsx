import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ApiError, apiRequest } from "../../shared/api/client";
import type { AuthResponse, User } from "../../shared/types/domain";

type AuthContextValue = {
  token: string;
  user: User | null;
  loading: boolean;
  authenticate: (
    mode: "login" | "register",
    values: { email: string; password: string; name?: string },
  ) => Promise<void>;
  updateUser: (user: User) => void;
  logout: () => void;
  api: <T>(path: string, options?: RequestInit) => Promise<T>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = "tiluchi_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(
    () => localStorage.getItem(TOKEN_KEY) || "",
  );
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(token));

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setUser(null);
    setLoading(false);
  }, []);

  const api = useCallback(
    async <T,>(path: string, options: RequestInit = {}) => {
      try {
        return await apiRequest<T>(path, options, token);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401 && token)
          logout();
        throw error;
      }
    },
    [logout, token],
  );

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiRequest<User>("/users/me", {}, token)
      .then(setUser)
      .catch(logout)
      .finally(() => setLoading(false));
  }, [logout, token]);

  async function authenticate(
    mode: "login" | "register",
    values: { email: string; password: string; name?: string },
  ) {
    const result = await apiRequest<AuthResponse>(`/auth/${mode}`, {
      method: "POST",
      body: JSON.stringify(values),
    });
    localStorage.setItem(TOKEN_KEY, result.accessToken);
    setToken(result.accessToken);
    setUser(result.user);
  }

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      authenticate,
      updateUser: setUser,
      logout,
      api,
    }),
    [api, loading, logout, token, user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
