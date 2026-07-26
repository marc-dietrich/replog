// src/components/LoginButton.jsx
//
// Login / Logout button placed in the app header.
// Shows user name when authenticated.

import { useAuth } from "../auth/AuthContext";

export function LoginButton() {
  const { authenticated, user, login, logout } = useAuth();

  if (!authenticated) {
    return (
      <button
        type="button"
        className="auth-btn auth-btn--login"
        onClick={login}
        aria-label="Sign in with Keycloak"
      >
        Sign in
      </button>
    );
  }

  return (
    <div className="auth-user">
      <span className="auth-user__name" title={user?.email ?? ""}>
        {user?.name ?? "User"}
      </span>
      <button
        type="button"
        className="auth-btn auth-btn--logout"
        onClick={logout}
        aria-label="Sign out"
      >
        Logout
      </button>
    </div>
  );
}
