/* global __APP_VERSION__ */
import { AddExerciseForm } from "./components/AddExerciseForm";
import { ExerciseList } from "./components/ExerciseList";
import { useExercises } from "./hooks/useExercises";
import { useRef, useState } from "react";

const VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

function App() {
  const { exercises, addExercise, addEntry, deleteEntry, deleteExercise, setExercises } = useExercises();
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const fileInputRef = useRef(null);

  const handleExport = () => {
    const json = JSON.stringify(exercises, null, 2);
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

        if (!Array.isArray(imported)) {
          alert("Invalid JSON format.");
          return;
        }

        setExercises(imported);
        alert("Data imported successfully!");
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const triggerImport = () => fileInputRef.current?.click();
  const closeAddPanel = () => setIsAddPanelOpen(false);
  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <div className="min-h-screen bg-background-light font-sans text-slate-900 dark:bg-background-dark dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-background-light/90 backdrop-blur-md dark:border-slate-800 dark:bg-background-dark/80">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white p-1 shadow-inner">
              <img src="/replog/icon-192.png" alt="RepLog mark" className="h-full w-full rounded-lg object-contain" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold">RepLog</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-primary">{VERSION}</p>
            </div>
          </div>
          <div className="flex flex-1 justify-center">
            <button
              type="button"
              className="flex w-36 items-center justify-center gap-1 rounded-xl border border-primary bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-primary-muted"
              onClick={() => setIsAddPanelOpen(true)}
            >
              <span className="material-icons-round text-base text-primary">add</span>
              <span className="uppercase tracking-[0.35em] text-xs">Exercise</span>
            </button>
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
            <div className="rounded-2xl border border-slate-900 bg-slate-900 p-5 text-white shadow-lg">
              <p className="mb-3 text-xs uppercase tracking-[0.3em] text-white/60">Add exercise</p>
              <AddExerciseForm
                onAdd={addExercise}
                onSuccess={closeAddPanel}
                onCancel={closeAddPanel}
              />
            </div>
          )}
          <ExerciseList
            exercises={exercises}
            onAddEntry={addEntry}
            onDeleteEntry={deleteEntry}
            onDeleteExercise={deleteExercise}
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
