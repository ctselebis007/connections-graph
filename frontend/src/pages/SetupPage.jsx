import { useState, useCallback } from "react";
import { api } from "../hooks/useApi.js";
import ConnectionForm from "../components/setup/ConnectionForm.jsx";
import ActionButton from "../components/setup/ActionButton.jsx";
import StatusDashboard from "../components/setup/StatusDashboard.jsx";

export default function SetupPage() {
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState({});

  const log = (msg) => setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} — ${msg}`]);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await api.status();
      setStatus(s);
    } catch {
      setStatus(null);
    }
  }, []);

  const run = async (key, fn) => {
    setLoading((p) => ({ ...p, [key]: true }));
    try {
      const result = await fn();
      if (result.log) result.log.forEach(log);
      else log(`${key}: ${result.message || "Done"}`);
      await refreshStatus();
    } catch (err) {
      log(`ERROR (${key}): ${err.message}`);
    } finally {
      setLoading((p) => ({ ...p, [key]: false }));
    }
  };

  const handleConnect = (creds) =>
    run("connect", () => api.connect(creds));

  const actions = [
    { key: "seed", label: "Seed DB & Collections", fn: () => api.seed() },
    { key: "indexes", label: "Create DB Indexes", fn: () => api.createIndexes() },
    { key: "searchIdx", label: "Create Atlas Search Indexes", fn: () => api.createSearchIndexes() },
    { key: "vectorIdx", label: "Create Vector Search Indexes", fn: () => api.createVectorIndexes() },
    { key: "embeddings", label: "Generate Embeddings (VoyageAI)", fn: () => api.generateEmbeddings() },
  ];

  return (
    <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
      {/* Left column */}
      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-semibold mb-4">Connection</h2>
          <ConnectionForm onConnect={handleConnect} />
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4">Actions</h2>
          <div className="space-y-2">
            {actions.map((a) => (
              <ActionButton
                key={a.key}
                label={a.label}
                loading={loading[a.key]}
                disabled={!status?.connected}
                onClick={() => run(a.key, a.fn)}
              />
            ))}
          </div>
        </section>
      </div>

      {/* Right column */}
      <div className="space-y-8">
        <StatusDashboard status={status} />

        <section>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Log
          </h3>
          <div className="bg-gray-900 border border-gray-800 rounded p-3 h-72 overflow-y-auto font-mono text-xs text-gray-400 space-y-1">
            {logs.length === 0 && (
              <span className="text-gray-600">No activity yet.</span>
            )}
            {logs.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
