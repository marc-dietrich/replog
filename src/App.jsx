/* global __APP_VERSION__ */
import { AddExerciseForm } from "./components/AddExerciseForm";
import { AddGroupForm } from "./components/AddGroupForm";
import { AddPanel } from "./components/AddPanel";
import { ExerciseList } from "./components/ExerciseList";
import { useExercises } from "./hooks/useExercises";
import { useEffect, useMemo, useRef, useState } from "react";

const VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
const IMPRESSUM_TEXT = `Marc Dietrich
c/o DE Office Solutions
Erfweiler Straße 12
66994 Dahn`;

function App() {
  const {
    exercises,
    groups,
    addExercise,
    addGroup,
    addEntry,
    deleteEntry,
    deleteExercise,
    moveExercise,
    reorderGroups,
    replaceState,
  } = useExercises();
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);
  const [isGroupPanelOpen, setIsGroupPanelOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isImpressumOpen, setIsImpressumOpen] = useState(false);
  const fileInputRef = useRef(null);
  const impressumButtonRef = useRef(null);
  const impressumTooltipRef = useRef(null);

  const handleExport = () => {
    const payload = { exercises, groups };
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
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const triggerImport = () => fileInputRef.current?.click();
  const closeAddPanel = () => setIsAddPanelOpen(false);
  const closeGroupPanel = () => setIsGroupPanelOpen(false);
  const closeImpressum = () => setIsImpressumOpen(false);
  const closeMenu = () => setIsMenuOpen(false);
  const openExercisePanel = () => {
    setIsAddPanelOpen(true);
    setIsGroupPanelOpen(false);
  };
  const openGroupPanel = () => {
    setIsGroupPanelOpen(true);
    setIsAddPanelOpen(false);
  };
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

  const handleAddGroup = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const exists = groups.some((group) => group.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      alert("This group already exists.");
      return;
    }

    addGroup(trimmed);
  };

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

  return (
    <div className="min-h-screen bg-background-light font-sans text-slate-900 dark:bg-background-dark dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-background-light/90 pt-[var(--app-top-offset)] backdrop-blur-md dark:border-slate-800 dark:bg-background-dark/80">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white p-1 shadow-inner">
              <img src="/replog/icon-192.png" alt="RepLog mark" className="h-full w-full rounded-lg object-contain" />
            </div>
            <div className="flex flex-col">
              <p className="font-display text-lg font-semibold leading-none">RepLog</p>
              <div className="mt-1 flex items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[8px] font-black uppercase text-slate-500 transition hover:border-slate-500 hover:text-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-400 dark:hover:text-slate-100"
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
                      className="absolute right-0 top-6 z-40 w-64 rounded-3xl border border-slate-200/70 bg-white/95 p-5 text-left text-xs leading-relaxed text-slate-600 shadow-[0_18px_45px_rgba(15,23,42,0.25)] ring-1 ring-white/30 backdrop-blur-lg dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-200"
                      ref={impressumTooltipRef}
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-icons-round text-base text-slate-400 dark:text-slate-300">info</span>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-slate-500 dark:text-slate-300">Impressum</p>
                      </div>
                      <p className="mt-3 whitespace-pre-line rounded-2xl bg-slate-100/80 p-3 font-medium text-slate-700 shadow-inner dark:bg-slate-800/60 dark:text-slate-100">{IMPRESSUM_TEXT}</p>
                    </div>
                  )}
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">{"v" + VERSION}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-1 justify-center">
            <div
              className="inline-flex items-center gap-1.5 rounded-3xl border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-600 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200"
              aria-label="Add new"
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-2xl bg-slate-100 text-sm font-black text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                aria-hidden="true"
              >
                +
              </span>
              <div className="flex w-28 flex-col" role="group">
                <button
                  type="button"
                  className={`flex items-center justify-center rounded-2xl px-2.5 py-0.75 transition ${
                    isAddPanelOpen ? "bg-orange-500 text-white" : "text-slate-700 hover:bg-orange-100"
                  }`}
                  aria-pressed={isAddPanelOpen}
                  onClick={openExercisePanel}
                >
                  Exercise
                </button>
                <span
                  className="my-1 h-px w-full border-t border-dashed border-slate-300/80 dark:border-slate-700/60"
                  aria-hidden="true"
                ></span>
                <button
                  type="button"
                  className={`flex items-center justify-center rounded-2xl px-2.5 py-0.75 transition ${
                    isGroupPanelOpen ? "bg-orange-500 text-white" : "text-slate-700 hover:bg-orange-100"
                  }`}
                  aria-pressed={isGroupPanelOpen}
                  onClick={openGroupPanel}
                >
                  Group
                </button>
              </div>
            </div>
          </div>
          <div className="relative flex-shrink-0">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-primary"
              aria-label="Open settings"
              onClick={toggleMenu}
            >
              <span className="material-icons-round text-base">settings</span>
            </button>
            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={closeMenu}></div>
                <div className="absolute right-0 top-12 z-50 w-72 rounded-3xl border border-slate-200 bg-white/95 p-5 text-left shadow-2xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-4 flex items-center gap-2 text-slate-400">
                    <span className="material-icons-round">cloud_done</span>
                    <h3 className="font-display text-xs font-bold uppercase tracking-[0.4em] text-slate-900 dark:text-slate-100">
                      Backup & Data
                    </h3>
                  </div>
                  <p className="mb-4 text-xs text-justify text-slate-500">
                    Your added data is saved in the browsers cache. If you want to clean you cache anytime, export your progress to keep it safe. You can re-import the file later to restore your data.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      className="flex flex-col items-center gap-2 rounded-2xl border border-transparent bg-slate-50 p-4 text-[11px] font-semibold uppercase tracking-tight text-slate-700 transition hover:border-slate-200 hover:bg-white dark:bg-slate-800/50 dark:text-slate-100"
                      onClick={() => {
                        handleExport();
                        closeMenu();
                      }}
                    >
                      <span className="material-icons-round text-primary">download</span>
                      Export JSON
                    </button>
                    <button
                      type="button"
                      className="flex flex-col items-center gap-2 rounded-2xl border border-transparent bg-slate-50 p-4 text-[11px] font-semibold uppercase tracking-tight text-slate-700 transition hover:border-slate-200 hover:bg-white dark:bg-slate-800/50 dark:text-slate-100"
                      onClick={() => {
                        triggerImport();
                        closeMenu();
                      }}
                    >
                      <span className="material-icons-round text-primary">upload</span>
                      Import JSON
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-6 px-4 py-6 pb-8">

        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Your Exercises</p>
            </div>
            <span className="text-xs font-medium uppercase tracking-[0.3em] text-slate-500">
              {exercises.length} ACTIVE
            </span>
          </div>
          {isAddPanelOpen && (
            <AddPanel title="Add exercise">
              <AddExerciseForm onAdd={addExercise} onSuccess={closeAddPanel} onCancel={closeAddPanel} />
            </AddPanel>
          )}
          {isGroupPanelOpen && (
            <AddPanel title="Add group">
              <AddGroupForm onAdd={handleAddGroup} onSuccess={closeGroupPanel} onCancel={closeGroupPanel} />
            </AddPanel>
          )}
          <ExerciseList
            exercises={exercises}
            groups={orderedGroups}
            onAddEntry={addEntry}
            onDeleteEntry={deleteEntry}
            onDeleteExercise={deleteExercise}
            onMoveExercise={moveExercise}
            onReorderGroups={(ids) => reorderGroups(ids)}
          />
        </section>

      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleImport}
      />
    </div>
  );
}

export default App;
