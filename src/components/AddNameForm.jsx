import { useState } from "react";

export function AddNameForm({
  placeholder,
  inputName,
  onAdd,
  onSuccess,
  onCancel,
  emptyMessage = "Please enter a name",
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const resetForm = () => {
    setName("");
    setError("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = name.trim();

    if (!trimmed) {
      setError(emptyMessage);
      return;
    }

    onAdd?.(trimmed);
    resetForm();
    onSuccess?.();
  };

  const handleCancel = () => {
    resetForm();
    onCancel?.();
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <input
          type="text"
          name={inputName}
          placeholder={placeholder}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (error) setError("");
          }}
          className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-base text-white placeholder:text-white/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          className="flex-1 rounded-2xl border border-white/30 bg-transparent py-3 text-base font-semibold text-white transition hover:bg-white/10"
          onClick={handleCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 rounded-2xl bg-white py-3 text-base font-semibold text-slate-900 transition hover:bg-primary-muted"
        >
          Confirm
        </button>
      </div>
    </form>
  );
}
