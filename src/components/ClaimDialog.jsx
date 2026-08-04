// src/components/ClaimDialog.jsx
//
// Shown when the user arrives via migration redirect (#token=...).
// Lets them choose a username + password (with confirmation) to claim
// their migrated account. Styled identically to LoginDialog.

import { useAuth } from "../auth/AuthContext";
import { useState } from "react";

export function ClaimDialog({ token, onSwitchToLogin, onClaimed }) {
  const { claim } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Bitte Benutzername und Passwort eingeben.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwörter stimmen nicht überein.");
      return;
    }

    setBusy(true);
    try {
      await claim(token, username.trim(), password);
      onClaimed(); // close dialog and clear hash
    } catch (err) {
      setError(err.message || "Konnte Account nicht aktivieren.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-dialog">
      <div className="login-dialog__card">
        {/* Gold accent bar */}
        <div className="login-dialog__accent" aria-hidden="true" />

        {/* Avatar */}
        <div className="login-dialog__head">
          <span className="material-icons-round login-dialog__avatar">
            how_to_reg
          </span>
        </div>

        {/* Subtitle */}
        <p
          style={{
            textAlign: "center",
            fontFamily: "'Outfit', sans-serif",
            fontSize: "0.95rem",
            fontWeight: 600,
            color: "var(--color-text, inherit)",
            margin: "0 0 4px",
            padding: "0 16px",
          }}
        >
          Konto aktivieren
        </p>
        <p
          style={{
            textAlign: "center",
            fontSize: "0.78rem",
            color: "var(--color-text-muted, #888)",
            margin: "0 0 20px",
            padding: "0 16px",
            lineHeight: 1.5,
          }}
        >
          Deine Trainingsdaten wurden übertragen.<br />
          Wähle jetzt Benutzername und Passwort.
        </p>

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
                placeholder="Benutzername"
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
                placeholder="Passwort"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                disabled={busy}
              />
            </div>

            <div className="login-dialog__field">
              <span className="material-icons-round login-dialog__field-icon">
                lock_reset
              </span>
              <input
                className="login-dialog__input"
                type="password"
                placeholder="Passwort bestätigen"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                disabled={busy}
              />
            </div>
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
              how_to_reg
            </span>
            {busy ? "Bitte warten…" : "Konto aktivieren"}
          </button>
        </form>

        {/* Switch to normal login */}
        <p style={{ textAlign: "center", marginTop: 12, fontSize: "0.8rem" }}>
          <button
            type="button"
            onClick={onSwitchToLogin}
            style={{
              background: "none",
              border: "none",
              color: "var(--color-primary, #f0c040)",
              cursor: "pointer",
              fontSize: "inherit",
              textDecoration: "underline",
            }}
          >
            Ich habe bereits einen Account
          </button>
        </p>
      </div>
    </div>
  );
}
