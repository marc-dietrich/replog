import "../styles/componentStyles.css";

export function AddPanel({ title, children }) {
  return (
    <div className="add-panel">
      <p className="add-panel__title">{title}</p>
      {children}
    </div>
  );
}
