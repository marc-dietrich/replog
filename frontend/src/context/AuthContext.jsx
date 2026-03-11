// src/context/AuthContext.jsx
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { authApi } from "../api/client";

const AuthContext = createContext(null);

/**
 * AuthProvider wraps the app and provides:
 *  - user         : { sub, provider, email, displayName } | null
 *  - isGuest      : boolean
 *  - isLoading    : boolean (initial session check)
 *  - initialState : server-side { exercises, groups, settings } loaded on boot
 *  - loginWithGoogle(idToken, claimGuest?)
 *  - logout()
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initialState, setInitialState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: check session / create guest
  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then((data) => {
        if (cancelled) return;
        setUser(data.user);
        setInitialState(data.state);
      })
      .catch((err) => {
        console.warn("Auth check failed (offline?):", err);
        // If the backend is unreachable fall back to a fully offline guest
        setUser({ sub: "offline", provider: "guest" });
        setInitialState(null); // hook will use localStorage
      })
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const loginWithGoogle = useCallback(async (idToken, claimGuestData = false) => {
    const data = await authApi.google(idToken, claimGuestData);
    setUser(data.user);
    setInitialState(data.state);
    return data;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    // After logout, re-fetch → backend will assign a new guest cookie
    const data = await authApi.me();
    setUser(data.user);
    setInitialState(data.state);
  }, []);

  const isGuest = !user || user.provider === "guest";

  return (
    <AuthContext.Provider
      value={{ user, isGuest, isLoading, initialState, loginWithGoogle, logout }}
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

// Re-export for convenience — but components should import from hooks/useAuth.js
// to avoid the react-refresh warning in this file.
