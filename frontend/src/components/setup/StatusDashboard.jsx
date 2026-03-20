export default function StatusDashboard({ status }) {
  if (!status) return null;

  const items = [
    {
      label: "Connection",
      ok: status.connected,
      detail: status.connected ? "Connected" : "Disconnected",
    },
    {
      label: "Config — URI",
      ok: status.config?.hasUri,
    },
    {
      label: "Config — DB Name",
      ok: status.config?.hasDbName,
    },
    {
      label: "Config — Embedding Key",
      ok: status.config?.hasEmbeddingKey,
    },
    {
      label: "Embedding Provider",
      ok: true,
      detail: `${(status.config?.embeddingProvider || "voyageai").toUpperCase()} — ${status.config?.embeddingModel || "voyage-4-lite"}`,
    },
  ];

  const collections = status.collections || {};

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
        Status
      </h3>
      <div className="grid gap-2">
        {items.map((it) => (
          <div
            key={it.label}
            className="flex items-center gap-2 text-sm bg-gray-800/50 rounded px-3 py-2"
          >
            <span className={it.ok ? "text-emerald-400" : "text-red-400"}>
              {it.ok ? "✓" : "✗"}
            </span>
            <span className="text-gray-300">{it.label}</span>
            {it.detail && (
              <span className="ml-auto text-gray-500 text-xs">{it.detail}</span>
            )}
          </div>
        ))}
      </div>

      {Object.keys(collections).length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mt-4">
            Collections
          </h3>
          <div className="grid gap-2">
            {Object.entries(collections).map(([name, count]) => (
              <div
                key={name}
                className="flex items-center justify-between text-sm bg-gray-800/50 rounded px-3 py-2"
              >
                <span className="text-gray-300 font-mono">{name}</span>
                <span className="text-emerald-400 font-mono">{count} docs</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
