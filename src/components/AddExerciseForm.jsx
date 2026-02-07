import { AddNameForm } from "./AddNameForm";

export function AddExerciseForm({ onAdd, onSuccess, onCancel }) {
  return (
    <AddNameForm
      inputName="exercise"
      placeholder="Exercise name"
      autoFocus
      onAdd={onAdd}
      onSuccess={onSuccess}
      onCancel={onCancel}
    />
  );
}
