export default function ActionButton({ label, onClick, loading, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full text-left bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded px-4 py-3 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between"
    >
      <span>{label}</span>
      {loading && (
        <span className="animate-spin inline-block w-4 h-4 border-2 border-gray-400 border-t-emerald-400 rounded-full" />
      )}
    </button>
  );
}
