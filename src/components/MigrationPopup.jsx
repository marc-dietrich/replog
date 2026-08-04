// src/components/MigrationPopup.jsx
//
// In-App popup shown on every launch to encourage users to migrate
// their training data to the new persistent website.

import { useState, useEffect } from "react";
import "./MigrationPopup.css";

const MIGRATION_URL = "https://gym.made-simple.online/api/migrate";
const NEW_SITE_URL = "https://gym.made-simple.online";

export function MigrationPopup({ exercises, groups, settings }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Show on every launch — no localStorage suppression.
    // User can tap "Später" to dismiss temporarily.
    const timer = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(timer);
  }, []);

  const handleMigrate = async () => {
    setBusy(true);
    setError("");

    const payload = { exercises, groups };

    try {
      const res = await fetch(MIGRATION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let msg = "Etwas ist schiefgegangen. Bitte versuch es später nochmal.";
        try {
          const parsed = JSON.parse(text);
          if (parsed.error) msg = parsed.error;
        } catch {}
        setError(msg);
        setBusy(false);
        return;
      }

      const data = await res.json();
      // Redirect to the new site with the claim token
      window.location.href = data.redirectUrl;
    } catch {
      setError("Keine Verbindung. Überprüf dein Internet und versuch es nochmal.");
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="migration-overlay" onClick={() => setOpen(false)}>
      <div className="migration-popup" onClick={(e) => e.stopPropagation()}>
        <div className="migration-popup__icon" aria-hidden="true">
          <span className="material-icons-round">rocket_launch</span>
        </div>

        <h2 className="migration-popup__title">
          RepLog zieht um!
        </h2>

        <p className="migration-popup__body">
          Deine Trainingsdaten sind aktuell nur im Browser gespeichert.
          Das heißt: wenn du den Cache löschst oder das Handy wechselst, sind sie weg.
        </p>
        <p className="migration-popup__body">
          Auf der <strong>neuen Website</strong> werden deine Daten sicher auf
          einem Server gespeichert, mit Login, damit nichts mehr verloren geht.
        </p>

        {error && (
          <p className="migration-popup__error">{error}</p>
        )}

        <div className="migration-popup__actions">
          <button
            className="migration-popup__btn migration-popup__btn--primary"
            onClick={handleMigrate}
            disabled={busy}
          >
            {busy ? "Wird übertragen…" : "Jetzt umziehen"}
          </button>
          <button
            className="migration-popup__btn migration-popup__btn--secondary"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Später
          </button>
        </div>

        <p className="migration-popup__hint">
          <a href={NEW_SITE_URL} target="_blank" rel="noopener">
            Direkt zur neuen Seite
          </a>
        </p>
      </div>
    </div>
  );
}
