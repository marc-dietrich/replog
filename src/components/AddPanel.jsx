export function AddPanel({ title, children }) {
  return (
    <div className="rounded-3xl border border-slate-900 bg-slate-900/95 p-5 text-white shadow-2xl">
      <p className="mb-3 text-xs uppercase tracking-[0.3em] text-white/60">{title}</p>
      {children}
    </div>
  );
}
