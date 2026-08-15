// src/components/LogoutConfirmDialog.jsx
//
// Confirmation dialog shown before logout when unsynced entries would be
// discarded (spec 3.3 step 3 / 8b).

export function LogoutConfirmDialog({ pendingCount, onConfirm, onCancel }) {
  return (
    <div
      className="logout-confirm-overlay"
      role="alertdialog"
      aria-label="Unsynchronized entries"
    >
      <div className="logout-confirm-card">
        <p className="logout-confirm__text">
          {pendingCount} Einträge nicht synchronisiert, trotzdem ausloggen?
        </p>
        <div className="logout-confirm__actions">
          <button
            type="button"
            className="auth-btn logout-confirm__cancel"
            onClick={onCancel}
          >
            Abbrechen
          </button>
          <button
            type="button"
            className="auth-btn auth-btn--logout logout-confirm__force"
            onClick={onConfirm}
          >
            Trotzdem ausloggen
          </button>
        </div>
      </div>
    </div>
  );
}
