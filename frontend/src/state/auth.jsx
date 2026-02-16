import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { getMe, login as apiLogin, signup as apiSignup } from "../api/auth";

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    const token = localStorage.getItem("ma_token");
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const profile = await getMe();
      setUser(profile);
    } catch {
      localStorage.removeItem("ma_token");
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email, password) => {
    setIsLoading(true);
    const result = await apiLogin(email, password);
    localStorage.setItem("ma_token", result.access_token);
    await refreshUser();
  };

  const signup = async (email, password) => {
    setIsLoading(true);
    const result = await apiSignup(email, password);
    localStorage.setItem("ma_token", result.access_token);
    await refreshUser();
  };

  const logout = () => {
    localStorage.removeItem("ma_token");
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, isLoading, login, signup, logout }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
