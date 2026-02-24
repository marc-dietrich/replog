import { useState } from "react";
import "../styles/componentStyles.css";

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
    <form className="add-name-form" onSubmit={handleSubmit}>
      <div className="add-name-form__field">
        <input
          type="text"
          name={inputName}
          placeholder={placeholder}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (error) setError("");
          }}
          className="add-name-form__input"
        />
        {error && <p className="add-name-form__error">{error}</p>}
      </div>

      <div className="add-name-form__actions">
        <button
          type="button"
          className="add-name-form__cancel"
          onClick={handleCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="add-name-form__confirm"
        >
          Confirm
        </button>
      </div>
    </form>
  );
}
