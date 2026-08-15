// src/components/LoginDialog.jsx
//
// Centered login / register dialog shown in place of the exercise list
// when the user is not authenticated.

import { useAuth } from "../auth/AuthContext";
import { useState } from "react";

export function LoginDialog({ onClose }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Username and password are required.");
      return;
    }

    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "login") {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password);
      }
      // Session established — close the dialog.
      onClose?.();
    } catch (err) {
      setError(err.message || `${mode === "login" ? "Login" : "Registration"} failed.`);
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setError("");
  };

  return (
    <div className="login-dialog">
      <div className="login-dialog__card">
        {onClose && (
          <button
            type="button"
            className="login-dialog__close"
            aria-label="Close"
            onClick={onClose}
          >
            <span className="material-icons-round">close</span>
          </button>
        )}

        {/* Gold accent bar */}
        <div className="login-dialog__accent" aria-hidden="true" />

        {/* Avatar */}
        <div className="login-dialog__head">
          <span className="material-icons-round login-dialog__avatar">
            account_circle
          </span>
        </div>

        {/* Tabs */}
        <div className="login-dialog__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className={`login-dialog__tab ${
              mode === "login" ? "login-dialog__tab--active" : ""
            }`}
            onClick={() => switchMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "register"}
            className={`login-dialog__tab ${
              mode === "register" ? "login-dialog__tab--active" : ""
            }`}
            onClick={() => switchMode("register")}
          >
            Register
          </button>
        </div>

        {/* Form */}
        <form className="login-dialog__form" onSubmit={handleSubmit}>
          <div className="login-dialog__fields">
            <div className="login-dialog__field">
              <span className="material-icons-round login-dialog__field-icon">
                person
              </span>
              <input
                className="login-dialog__input"
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                disabled={busy}
              />
            </div>

            <div className="login-dialog__field">
              <span className="material-icons-round login-dialog__field-icon">
                lock
              </span>
              <input
                className="login-dialog__input"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                disabled={busy}
              />
            </div>

            {mode === "register" && (
              <div className="login-dialog__field">
                <span className="material-icons-round login-dialog__field-icon">
                  lock_reset
                </span>
                <input
                  className="login-dialog__input"
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={busy}
                />
              </div>
            )}
          </div>

          {error && (
            <p className="login-dialog__error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="login-dialog__submit"
            disabled={busy}
          >
            <span className="material-icons-round login-dialog__submit-icon">
              {mode === "login" ? "login" : "how_to_reg"}
            </span>
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
