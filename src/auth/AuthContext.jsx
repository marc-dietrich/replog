// src/auth/AuthContext.jsx
//
// React context + provider for Keycloak authentication state.
// Wraps the app so any component can access auth via useAuth().

import { createContext, useContext, useEffect, useState } from "react";
import {
  initKeycloak,
  login,
  logout,
  getToken,
  isAuthenticated,
  getUserInfo,
} from "./keycloak";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    initKeycloak()
      .then((kc) => {
        setAuthenticated(kc.authenticated ?? false);
        setUser(getUserInfo());
        setReady(true);

        // Listen for subsequent auth state changes
        kc.onAuthSuccess = () => {
          setAuthenticated(true);
          setUser(getUserInfo());
        };
        kc.onAuthLogout = () => {
          setAuthenticated(false);
          setUser(null);
        };
        kc.onAuthRefreshSuccess = () => {
          setAuthenticated(true);
        };
        kc.onAuthRefreshError = () => {
          setAuthenticated(false);
          setUser(null);
        };
      })
      .catch((err) => {
        setError(err.message);
        setReady(true);
      });
  }, []);

  const handleLogin = () => login();
  const handleLogout = () => logout();

  return (
    <AuthContext.Provider
      value={{
        ready,
        authenticated,
        user,
        error,
        login: handleLogin,
        logout: handleLogout,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
