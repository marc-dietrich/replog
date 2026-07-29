// src/components/LoginButton.jsx
//
// Login / Register / Logout component.
// When not authenticated, shows a login/register form.
// When authenticated, shows username + logout button.

import { useAuth } from "../auth/AuthContext";
import { useState } from "react";

export function LoginButton() {
  const { authenticated, user, login, register, logout } = useAuth();
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!authenticated) {
    const handleSubmit = async (e) => {
      e.preventDefault();
      setError("");

      if (!username.trim() || !password.trim()) {
        setError("Username and password are required");
        return;
      }

      if (mode === "register" && password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }

      setBusy(true);
      try {
        if (mode === "login") {
          await login(username.trim(), password);
        } else {
          await register(username.trim(), password);
        }
      } catch (err) {
        setError(err.message || `${mode} failed`);
      } finally {
        setBusy(false);
      }
    };

    return (
      <div className="auth-form-wrap">
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form__tabs">
            <button
              type="button"
              className={`auth-form__tab ${mode === "login" ? "auth-form__tab--active" : ""}`}
              onClick={() => { setMode("login"); setError(""); }}
            >
              Login
            </button>
            <button
              type="button"
              className={`auth-form__tab ${mode === "register" ? "auth-form__tab--active" : ""}`}
              onClick={() => { setMode("register"); setError(""); }}
            >
              Register
            </button>
          </div>

          <input
            className="auth-form__input"
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            disabled={busy}
          />
          <input
            className="auth-form__input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            disabled={busy}
          />

          {mode === "register" && (
            <input
              className="auth-form__input"
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              disabled={busy}
            />
          )}

          {error && <p className="auth-form__error">{error}</p>}

          <button
            type="submit"
            className="auth-btn auth-btn--login"
            disabled={busy}
          >
            {busy ? "..." : mode === "login" ? "Sign in" : "Register"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="auth-user">
      <span className="auth-user__name" title={user?.username ?? ""}>
        {user?.username ?? "User"}
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
