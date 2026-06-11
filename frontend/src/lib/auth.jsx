import { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("aog_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  // Refresh user from token on mount
  useEffect(() => {
    const token = localStorage.getItem("aog_token");
    if (token && !user) {
      api
        .get("/auth/me")
        .then((res) => {
          setUser(res.data);
          localStorage.setItem("aog_user", JSON.stringify(res.data));
        })
        .catch(() => {
          localStorage.removeItem("aog_token");
          localStorage.removeItem("aog_user");
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (username, password, remember_me) => {
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { username, password, remember_me });
      const { access_token, user: u } = res.data;
      localStorage.setItem("aog_token", access_token);
      localStorage.setItem("aog_user", JSON.stringify(u));
      setUser(u);
      return u;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("aog_token");
    localStorage.removeItem("aog_user");
    setUser(null);
    window.location.href = "/login";
  };

  const isAdmin = user?.role === "admin";

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
