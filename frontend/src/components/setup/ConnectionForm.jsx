import { useState, useEffect } from "react";

const PROVIDER_MODELS = {
  voyageai: [{ value: "voyage-4-lite", label: "voyage-4-lite (1024 dims)" }],
  openai: [{ value: "text-embedding-ada-002", label: "text-embedding-ada-002 (1536 dims)" }],
};

const STORAGE_KEY = "graph_connections_setup";

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function ConnectionForm({ onConnect }) {
  const saved = loadSaved();
  const [uri, setUri] = useState(saved?.uri || "");
  const [dbName, setDbName] = useState(saved?.dbName || "");
  const [embeddingProvider, setEmbeddingProvider] = useState(saved?.embeddingProvider || "voyageai");
  const [embeddingApiKey, setEmbeddingApiKey] = useState(saved?.embeddingApiKey || "");
  const [embeddingModel, setEmbeddingModel] = useState(saved?.embeddingModel || "voyage-4-lite");
  const [showUri, setShowUri] = useState(false);
  const [showDb, setShowDb] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saveConfirm, setSaveConfirm] = useState(false);

  const handleProviderChange = (provider) => {
    setEmbeddingProvider(provider);
    setEmbeddingModel(PROVIDER_MODELS[provider][0].value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onConnect({ uri, dbName, embeddingProvider, embeddingApiKey, embeddingModel });
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ uri, dbName, embeddingProvider, embeddingApiKey, embeddingModel }));
    setSaveConfirm(true);
    setTimeout(() => setSaveConfirm(false), 2000);
  };

  const handleClearSaved = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSaveConfirm(false);
  };

  const keyLabel = embeddingProvider === "openai" ? "OpenAI API Key" : "VoyageAI API Key";
  const keyPlaceholder = embeddingProvider === "openai" ? "sk-..." : "pa-...";

  const fields = [
    {
      label: "MongoDB URI",
      value: uri,
      setter: setUri,
      show: showUri,
      toggle: () => setShowUri((p) => !p),
      placeholder: "mongodb+srv://...",
    },
    {
      label: "Database Name",
      value: dbName,
      setter: setDbName,
      show: showDb,
      toggle: () => setShowDb((p) => !p),
      placeholder: "connections_graph",
    },
    {
      label: keyLabel,
      value: embeddingApiKey,
      setter: setEmbeddingApiKey,
      show: showKey,
      toggle: () => setShowKey((p) => !p),
      placeholder: keyPlaceholder,
    },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Embedding Provider Toggle */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">
          Embedding Provider
        </label>
        <div className="flex gap-2">
          {[
            { value: "voyageai", label: "VoyageAI" },
            { value: "openai", label: "OpenAI" },
          ].map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => handleProviderChange(p.value)}
              className={`px-4 py-2 rounded text-sm font-medium transition ${
                embeddingProvider === p.value
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {fields.map((f) => (
        <div key={f.label}>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            {f.label}
          </label>
          <div className="relative">
            <input
              type={f.show ? "text" : "password"}
              value={f.value}
              onChange={(e) => f.setter(e.target.value)}
              placeholder={f.placeholder}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 pr-10 text-sm focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={f.toggle}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
            >
              {f.show ? "Hide" : "Show"}
            </button>
          </div>
        </div>
      ))}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">
          Embedding Model
        </label>
        <select
          value={embeddingModel}
          onChange={(e) => setEmbeddingModel(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
        >
          {PROVIDER_MODELS[embeddingProvider].map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 items-center">
        <button
          type="submit"
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-sm font-medium transition"
        >
          Establish Connection
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm font-medium transition"
        >
          {saveConfirm ? "✓ Saved!" : "Save Settings"}
        </button>
        <button
          type="button"
          onClick={handleClearSaved}
          className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-2 rounded text-sm font-medium transition"
        >
          Clear Saved
        </button>
      </div>
    </form>
  );
}
