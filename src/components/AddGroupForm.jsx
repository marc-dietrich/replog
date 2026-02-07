import { AddNameForm } from "./AddNameForm";

export function AddGroupForm({ onAdd, onCancel, onSuccess }) {
  return (
    <AddNameForm
      inputName="group"
      placeholder="Push Day"
      emptyMessage="Please enter a group name"
      onAdd={onAdd}
      onSuccess={onSuccess}
      onCancel={onCancel}
    />
  );
}
