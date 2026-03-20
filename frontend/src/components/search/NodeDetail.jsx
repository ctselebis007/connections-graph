export default function NodeDetail({ node }) {
  if (!node) {
    return (
      <div className="text-gray-600 text-sm py-4 text-center">
        Click a node or row to view details.
      </div>
    );
  }

  const meta = node.metadata || {};

  return (
    <div className="bg-gray-900 border border-gray-800 rounded p-4 space-y-3 text-sm">
      <h3 className="font-semibold text-emerald-400">
        {node.id || node._id}
      </h3>
      {node.documentTitle && (
        <p className="text-gray-300">{node.documentTitle}</p>
      )}

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-gray-500 block">Channels</span>
          <span className="text-gray-300">
            {(node.channelIDs || []).join(", ") || "—"}
          </span>
        </div>
        <div>
          <span className="text-gray-500 block">Languages</span>
          <span className="text-gray-300">
            {(node.languageIDs || []).join(", ") || "—"}
          </span>
        </div>
        <div>
          <span className="text-gray-500 block">Collections</span>
          <span className="text-gray-300">
            {(node.collectionIDs || []).join(", ") || "—"}
          </span>
        </div>
      </div>

      {Object.keys(meta).length > 0 && (
        <div>
          <span className="text-gray-500 text-xs block mb-1">Metadata</span>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {Object.entries(meta).map(([k, v]) => (
              <div key={k} className="flex gap-1">
                <span className="text-gray-500 shrink-0">{k}:</span>
                <span className="text-gray-300 truncate">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {node.connectionCount != null && (
        <p className="text-xs text-gray-500">
          Connections: {node.connectionCount}
        </p>
      )}
    </div>
  );
}
