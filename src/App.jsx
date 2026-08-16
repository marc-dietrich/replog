/* global __APP_VERSION__ */
import { AddExerciseForm } from "./components/AddExerciseForm";
import { AddGroupForm } from "./components/AddGroupForm";
import { AddPanel } from "./components/AddPanel";
import { EXERCISE_VIEW_MODES, SETS_DISPLAY_MODES } from "./components/ExerciseTrendChart";
import { ExerciseList } from "./components/ExerciseList";
import { LoginDialog } from "./components/LoginDialog";
import { LogoutConfirmDialog } from "./components/LogoutConfirmDialog";
import { useExercises, useSettings } from "./hooks";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ClaimDialog } from "./components/ClaimDialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db/db";
import "./styles/app.css";

const VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

function formatBytes(bytes) {
  if (bytes == null || !Number.isFinite(bytes)) return "unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
const IMPRESSUM_TEXT = `Marc Dietrich
c/o DE Office Solutions
Erfweiler Straße 12
66994 Dahn`;
const VIEW_MODE_OPTIONS = [
  { id: EXERCISE_VIEW_MODES.TOP_SET, label: "Top-Set" },
  { id: EXERCISE_VIEW_MODES.VOLUME, label: "Volume" },
  { id: EXERCISE_VIEW_MODES.SETS, label: "Sets" },
];

// Login FAB appears ~5s after the page is entered, only when logged out —
// so an instant session restore (see AuthContext mount effect) stays
// visually uninterrupted.
const LOGIN_FAB_DELAY_MS = 5000;

function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

function AppInner() {
  const {
    exercises,
    groups,
    error,
    addExercise,
    addGroup,
    addEntry,
    deleteEntry,
    deleteExercise,
    renameExercise,
    deleteGroup,
    moveExercise,
    reorderGroups,
  } = useExercises();

  const { ready, authenticated, user, logout } = useAuth();
  const { settings, setExerciseViewMode, setSetsDisplayMode, setEntriesLimit } = useSettings();
  const [addPanelType, setAddPanelType] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isImpressumOpen, setIsImpressumOpen] = useState(false);

  // Auth dialog — opened from the settings section.
  const [authOpen, setAuthOpen] = useState(false);
  const [logoutWarning, setLogoutWarning] = useState(null);

  // Dexie storage info: live store counts + origin usage estimate.
  // Re-measured when the menu opens and shortly after data changes
  // (IndexedDB frees space asynchronously).
  const liveCounts = useLiveQuery(
    async () => ({
      groups: await db.groups.count(),
      exercises: await db.exercises.count(),
      entries: await db.entries.count(),
      queue: await db.queue.count(),
    }),
    [],
    { groups: 0, exercises: 0, entries: 0, queue: 0 }
  );

  const [storageEstimate, setStorageEstimate] = useState(null);
  useEffect(() => {
    if (!isMenuOpen) return;
    let cancelled = false;
    const measure = () => {
      if (!navigator.storage?.estimate) {
        setStorageEstimate(null);
        return;
      }
      navigator.storage
        .estimate()
        .then((est) => {
          if (!cancelled) setStorageEstimate(est);
        })
        .catch(() => {
          if (!cancelled) setStorageEstimate(null);
        });
    };
    measure();
    const delayed = setTimeout(measure, 1200); // after IDB reclaims space
    return () => {
      cancelled = true;
      clearTimeout(delayed);
    };
  }, [isMenuOpen, liveCounts]);

  // Login FAB: delayed so it doesn't flash during session restore.
  const [showLoginFab, setShowLoginFab] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowLoginFab(true), LOGIN_FAB_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const handleSignOut = async () => {
    const result = await logout();
    if (result?.blocked) {
      setLogoutWarning({ pendingCount: result.pendingCount });
    }
  };

  const confirmSignOut = async () => {
    setLogoutWarning(null);
    await logout({ force: true });
  };

  // Migration claim flow: check for #token=... in URL
  const [showClaim, setShowClaim] = useState(() => {
    const hash = window.location.hash;
    const m = hash.match(/token=([a-f0-9-]+)/);
    return m ? m[1] : null;
  });
  const impressumButtonRef = useRef(null);
  const impressumTooltipRef = useRef(null);

  const closeAddPanel = () => setAddPanelType(null);
  const closeImpressum = () => setIsImpressumOpen(false);
  const closeMenu = () => setIsMenuOpen(false);
  const openExercisePanel = () => setAddPanelType("exercise");
  const openGroupPanel = () => setAddPanelType("group");
  const toggleMenu = () =>
    setIsMenuOpen((prev) => {
      const next = !prev;
      if (!prev) {
        closeImpressum();
      }
      return next;
    });
  const toggleImpressum = () =>
    setIsImpressumOpen((prev) => {
      const next = !prev;
      if (!prev) {
        closeMenu();
      }
      return next;
    });

  useEffect(() => {
    if (!isImpressumOpen) return;

    const handlePointerDown = (event) => {
      const isInsideButton = impressumButtonRef.current?.contains(event.target);
      const isInsideTooltip = impressumTooltipRef.current?.contains(event.target);

      if (isInsideButton || isInsideTooltip) {
        return;
      }

      setIsImpressumOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, [isImpressumOpen]);

  const orderedGroups = useMemo(
    () => [...groups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [groups]
  );

  const isAddPanelOpen = addPanelType !== null;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-brand">
            <div className="app-brand__icon-wrap">
              <img src="/icon-192.png" alt="RepLog mark" className="app-brand__icon" />
            </div>
            <div className="app-brand__text">
              <p className="app-brand__title">RepLog</p>
              <div className="app-brand__meta-row">
                <div className="app-brand__impressum-wrap">
                  <button
                    type="button"
                    className="app-impressum-btn"
                    aria-label="Show impressum"
                    aria-expanded={isImpressumOpen}
                    aria-controls="impressum-tooltip"
                    aria-haspopup="dialog"
                    onClick={toggleImpressum}
                    ref={impressumButtonRef}
                  >
                    i
                  </button>
                  {isImpressumOpen && (
                    <div
                      id="impressum-tooltip"
                      role="dialog"
                      aria-label="RepLog impressum"
                      className="app-impressum-tooltip"
                      ref={impressumTooltipRef}
                    >
                      <div className="app-impressum-tooltip__head">
                        <span className="material-icons-round app-impressum-tooltip__info-icon">info</span>
                        <p className="app-impressum-tooltip__title">Impressum</p>
                      </div>
                      <p className="app-impressum-tooltip__body">{IMPRESSUM_TEXT}</p>
                    </div>
                  )}
                </div>
                <p className="app-version">{"v" + VERSION}</p>
              </div>
            </div>
          </div>
          {/* Login / account lives in the settings section — the header
              stays minimal and the app works without an account. */}
          <div className="app-add-wrap">
            <div
              className="app-add-switch"
              aria-label="Add new"
            >
              <span
                className="app-add-switch__plus"
                aria-hidden="true"
              >
                +
              </span>
              <div className="app-add-switch__buttons" role="group">
                <button
                  type="button"
                  className={`app-add-switch__btn ${
                    addPanelType === "exercise" ? "app-add-switch__btn--active" : "app-add-switch__btn--inactive"
                  }`}
                  aria-pressed={addPanelType === "exercise"}
                  onClick={openExercisePanel}
                >
                  Exercise
                </button>
                <span
                  className="app-add-switch__divider"
                  aria-hidden="true"
                ></span>
                <button
                  type="button"
                  className={`app-add-switch__btn ${
                    addPanelType === "group" ? "app-add-switch__btn--active" : "app-add-switch__btn--inactive"
                  }`}
                  aria-pressed={addPanelType === "group"}
                  onClick={openGroupPanel}
                >
                  Group
                </button>
              </div>
            </div>
          </div>
          <div className="app-settings-wrap">
            <button
              type="button"
              className="app-settings-btn"
              aria-label="Open settings"
              onClick={toggleMenu}
            >
              <span className="material-icons-round app-settings-btn__icon">settings</span>
            </button>            {isMenuOpen && (
              <>
                <button
                  type="button"
                  className="app-settings-overlay"
                  aria-label="Close settings"
                  onClick={closeMenu}
                ></button>
                <div className="app-settings-menu">
                  {/* Header */}
                  <div className="app-settings-menu__header">
                    <div className="app-settings-menu__title-row">
                      <span className="material-icons-round app-settings-menu__title-icon">settings</span>
                      <h2 className="app-settings-menu__title">Settings</h2>
                    </div>
                    <button
                      type="button"
                      className="app-settings-menu__close"
                      aria-label="Close settings"
                      onClick={closeMenu}
                    >
                      <span className="material-icons-round">close</span>
                    </button>
                  </div>

                  {/* Scrollable content */}
                  <div className="app-settings-menu__content">
                    {/* ── Workout View ── */}
                    <section className="app-settings-section">
                      <h3 className="app-settings-section-label">Workout View</h3>
                      <p className="app-settings-body">Applies to all exercise cards.</p>
                      <div className="app-settings-grid app-settings-grid--3" role="group" aria-label="Exercise view mode">
                        {VIEW_MODE_OPTIONS.map((option) => {
                          const isActive = option.id === settings.exerciseViewMode;
                          const isDisabled = option.disabled;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              className={`app-settings-option ${
                                isActive
                                  ? "app-settings-option--active"
                                  : "app-settings-option--inactive"
                              } ${isDisabled ? "app-settings-option--disabled" : ""}`}
                              disabled={isDisabled}
                              aria-disabled={isDisabled || undefined}
                              onClick={() => {
                                if (isDisabled) return;
                                setExerciseViewMode(option.id);
                              }}
                            >
                              {option.label}
                              {isDisabled && <span className="app-settings-option__disabled-dot" aria-hidden="true"></span>}
                            </button>
                          );
                        })}
                      </div>

                      {settings.exerciseViewMode === EXERCISE_VIEW_MODES.SETS && (
                        <div>
                          <p className="app-settings-body">Continuous lines or stacked bars.</p>
                          <div className="app-settings-grid app-settings-grid--2" role="group" aria-label="Sets display mode">
                            {[
                              { id: SETS_DISPLAY_MODES.CONTINUOUS, label: "Continuous" },
                              { id: SETS_DISPLAY_MODES.DISCRETE, label: "Discrete" },
                            ].map((option) => {
                              const isActive = option.id === (settings.setsDisplayMode ?? SETS_DISPLAY_MODES.CONTINUOUS);
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  className={`app-settings-option ${
                                    isActive
                                      ? "app-settings-option--active"
                                      : "app-settings-option--inactive"
                                  }`}
                                  onClick={() => setSetsDisplayMode(option.id)}
                                >
                                  {option.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="app-settings-divider" />

                      <div className="app-settings-entries">
                        <div>
                          <h4 className="app-settings-entries__title">Entries per exercise</h4>
                          <p className="app-settings-entries__hint">
                            How many workout entries are kept and loaded.
                          </p>
                        </div>
                        <div className="app-settings-entries-stepper-group" role="group" aria-label="Entries per exercise">
                          <button
                            type="button"
                            className="app-settings-entries-stepper"
                            aria-label="Decrease entries limit"
                            disabled={settings.entriesLimit <= 1}
                            onClick={() => setEntriesLimit(settings.entriesLimit - 1)}
                          >
                            <span className="material-icons-round">remove</span>
                          </button>
                          <span className="app-settings-entries-value" aria-live="polite">
                            {settings.entriesLimit}
                          </span>
                          <button
                            type="button"
                            className="app-settings-entries-stepper"
                            aria-label="Increase entries limit"
                            disabled={settings.entriesLimit >= 100}
                            onClick={() => setEntriesLimit(settings.entriesLimit + 1)}
                          >
                            <span className="material-icons-round">add</span>
                          </button>
                        </div>
                      </div>
                    </section>

                    {/* ── Data ── */}
                    <section className="app-settings-section">
                      <h3 className="app-settings-section-label app-settings-section-label--icon">
                        <span className="material-icons-round">cloud_done</span>
                        Data
                      </h3>

                      <div className="app-settings-storage-card">
                        <p className="app-settings-storage-card__text">
                          {liveCounts.exercises} exercises ·{" "}
                          {liveCounts.entries} entries ·{" "}
                          {liveCounts.queue} sync-ops
                          ({formatBytes(storageEstimate?.usage)})
                        </p>
                      </div>
                    </section>

                    {/* ── Account ── */}
                    {authenticated && (
                      <section className="app-settings-section">
                        <h3 className="app-settings-section-label app-settings-section-label--icon">
                          <span className="material-icons-round">person</span>
                          Account
                        </h3>
                        <div className="app-settings-account-card">
                          <div>
                            <p className="app-settings-account-card__label">Signed in as</p>
                            <p className="app-settings-account-card__name">
                              {user?.username ?? "User"}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="app-settings-signout-btn"
                            onClick={handleSignOut}
                          >
                            <span className="material-icons-round">logout</span>
                            Sign Out
                          </button>
                        </div>
                      </section>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        {!ready ? (
          <div className="app-status-msg">Loading…</div>
        ) : showClaim ? (
          <ClaimDialog
            token={showClaim}
            onSwitchToLogin={() => {
              setShowClaim(null);
              window.location.hash = "";
            }}
            onClaimed={() => {
              setShowClaim(null);
              window.location.hash = "";
            }}
          />
        ) : (
          <section className="app-section">
            <div className="app-section-head">
              <div>
                <p className="app-section-head__label">Your Exercises</p>
              </div>
              <span className="app-section-head__count">
                {exercises.length} ACTIVE
              </span>
            </div>
            {isAddPanelOpen && (
              <AddPanel title={addPanelType === "group" ? "Add group" : "Add exercise"}>
                {addPanelType === "group" ? (
                  <AddGroupForm onAdd={addGroup} onSuccess={closeAddPanel} onCancel={closeAddPanel} />
                ) : (
                  <AddExerciseForm onAdd={addExercise} onSuccess={closeAddPanel} onCancel={closeAddPanel} />
                )}
              </AddPanel>
            )}

            {exercises.length === 0 && error && (
              <p className="app-status-msg app-status-msg--error">
                Could not reach the server: {error}
              </p>
            )}

            <ExerciseList
                exercises={exercises}
                groups={orderedGroups}
                activeViewMode={settings.exerciseViewMode}
                setsDisplayMode={settings.setsDisplayMode}
                onAddEntry={addEntry}
                onDeleteEntry={deleteEntry}
                onDeleteExercise={deleteExercise}
                onRenameExercise={renameExercise}
                onDeleteGroup={deleteGroup}
                onMoveExercise={moveExercise}
                onReorderGroups={reorderGroups}
              />
          </section>
        )}
      </main>

      {/* Login FAB — only when logged out, not in the claim view, and
          only after the initial session-restore window has passed. */}
      {showLoginFab && !authenticated && !showClaim && (
        <button
          type="button"
          className="app-account-fab"
          aria-label="Sign in"
          title="Sign in"
          onClick={() => setAuthOpen(true)}
        >
          <span className="material-icons-round app-account-fab__icon">login</span>
        </button>
      )}

      {authOpen && (
        <div
          className="auth-dialog-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) setAuthOpen(false);
          }}
        >
          <LoginDialog onClose={() => setAuthOpen(false)} />
        </div>
      )}

      {logoutWarning && (
        <LogoutConfirmDialog
          pendingCount={logoutWarning.pendingCount}
          onCancel={() => setLogoutWarning(null)}
          onConfirm={confirmSignOut}
        />
      )}
    </div>
  );
}

export default App;