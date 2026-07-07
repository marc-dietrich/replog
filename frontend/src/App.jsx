/* global __APP_VERSION__ */
import { AddExerciseForm } from "./components/AddExerciseForm";
import { AddGroupForm } from "./components/AddGroupForm";
import { AddPanel } from "./components/AddPanel";
import { EXERCISE_VIEW_MODES, SETS_DISPLAY_MODES } from "./components/ExerciseTrendChart";
import { ExerciseList } from "./components/ExerciseList";
import { useExercises } from "./hooks/useExercises";
import { useEffect, useMemo, useRef, useState } from "react";
import "./styles/app.css";

const VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
const IMPRESSUM_TEXT = `Marc Dietrich
c/o DE Office Solutions
Erfweiler Straße 12
66994 Dahn`;
const VIEW_MODE_OPTIONS = [
  { id: EXERCISE_VIEW_MODES.TOP_SET, label: "Top-Set" },
  { id: EXERCISE_VIEW_MODES.VOLUME, label: "Volume" },
  { id: EXERCISE_VIEW_MODES.SETS, label: "Sets" },
];

function App() {
  const {
    exercises,
    groups,
    settings,
    addExercise,
    addGroup,
    addEntry,
    deleteEntry,
    deleteExercise,
    deleteGroup,
    moveExercise,
    reorderGroups,
    replaceState,
    setExerciseViewMode,
    setSetsDisplayMode,
  } = useExercises();
  const [addPanelType, setAddPanelType] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isImpressumOpen, setIsImpressumOpen] = useState(false);
  const fileInputRef = useRef(null);
  const impressumButtonRef = useRef(null);
  const impressumTooltipRef = useRef(null);

  const handleExport = () => {
    const payload = { exercises, groups, settings };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "replog-data.json";
    a.click();

    URL.revokeObjectURL(url);
  };

  const handleImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);

        const nextState = Array.isArray(imported)
          ? { exercises: imported, groups: [] }
          : imported;

        if (!nextState || !Array.isArray(nextState.exercises) || !Array.isArray(nextState.groups)) {
          alert("Invalid JSON format.");
          return;
        }

        replaceState(nextState);
        alert("Data imported successfully!");
      } catch {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const triggerImport = () => fileInputRef.current?.click();
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
              <img src="/replog/icon-192.png" alt="RepLog mark" className="app-brand__icon" />
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
            </button>
            {isMenuOpen && (
              <>
                <button
                  type="button"
                  className="app-settings-overlay"
                  aria-label="Close settings"
                  onClick={closeMenu}
                ></button>
                <div className="app-settings-menu">
                  <div className="app-settings-block">
                    <div className="app-settings-block__header">
                      <span className="material-icons-round app-settings-block__header-icon">insights</span>
                      <h3 className="app-settings-block__title">
                        Exercise View
                      </h3>
                    </div>
                    <p className="app-settings-block__hint">Applies to all exercise cards.</p>
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
                  </div>
                  {settings.exerciseViewMode === EXERCISE_VIEW_MODES.SETS && (
                    <div className="app-settings-block">
                      <div className="app-settings-block__header">
                        <span className="material-icons-round app-settings-block__header-icon">stacked_line_chart</span>
                        <h3 className="app-settings-block__title">
                          Sets Display
                        </h3>
                      </div>
                      <p className="app-settings-block__hint">Continuous lines or stacked bars.</p>
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
                  <div className="app-settings-section-head">
                    <span className="material-icons-round">cloud_done</span>
                    <h3 className="app-settings-section-head__title">
                      Backup & Data
                    </h3>
                  </div>
                  <p className="app-settings-body">
                    Your added data is saved in the browsers cache. If you want to clean you cache anytime, export your progress to keep it safe. You can re-import the file later to restore your data.
                  </p>
                  <div className="app-settings-actions">
                    <button
                      type="button"
                      className="app-settings-action-btn"
                      onClick={() => {
                        handleExport();
                        closeMenu();
                      }}
                    >
                      <span className="material-icons-round app-settings-action-btn__icon">download</span>
                      Export JSON
                    </button>
                    <button
                      type="button"
                      className="app-settings-action-btn"
                      onClick={() => {
                        triggerImport();
                        closeMenu();
                      }}
                    >
                      <span className="material-icons-round app-settings-action-btn__icon">upload</span>
                      Import JSON
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">

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
          <ExerciseList
            exercises={exercises}
            groups={orderedGroups}
            activeViewMode={settings.exerciseViewMode}
            setsDisplayMode={settings.setsDisplayMode}
            onAddEntry={addEntry}
            onDeleteEntry={deleteEntry}
            onDeleteExercise={deleteExercise}
            onDeleteGroup={deleteGroup}
            onMoveExercise={moveExercise}
            onReorderGroups={reorderGroups}
          />
        </section>

      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="app-hidden-input"
        onChange={handleImport}
      />
    </div>
  );
}

export default App;
