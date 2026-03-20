export default function ResultsTable({ results, onRowClick }) {
  if (!results || results.length === 0) {
    return (
      <div className="text-gray-500 text-sm py-8 text-center">
        No results to display.
      </div>
    );
  }

  return (
    <div className="overflow-auto max-h-80 border border-gray-800 rounded">
      <table className="w-full text-sm">
        <thead className="bg-gray-800 sticky top-0">
          <tr>
            <th className="text-left px-3 py-2 text-gray-400 font-medium">ID</th>
            <th className="text-left px-3 py-2 text-gray-400 font-medium">
              Title
            </th>
            <th className="text-left px-3 py-2 text-gray-400 font-medium">
              Score
            </th>
            <th className="text-left px-3 py-2 text-gray-400 font-medium">
              Collections
            </th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr
              key={r._id || r.id || i}
              onClick={() => onRowClick?.(r)}
              className="border-t border-gray-800 hover:bg-gray-800/60 cursor-pointer transition"
            >
              <td className="px-3 py-2 font-mono text-emerald-400">
                {r._id || r.id}
              </td>
              <td className="px-3 py-2 text-gray-300 truncate max-w-[200px]">
                {r.documentTitle || "—"}
              </td>
              <td className="px-3 py-2 text-gray-400">
                {r.score != null ? r.score.toFixed(4) : "—"}
              </td>
              <td className="px-3 py-2 text-gray-500 text-xs">
                {(r.collectionIDs || []).join(", ") || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
