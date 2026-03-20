const BASE = "/api";

async function request(path, options = {}) {
  const { body, ...rest } = options;
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...rest,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text || res.statusText);
  }
  if (!res.ok) throw new Error(data.message || data.error || res.statusText);
  return data;
}

export const api = {
  // Setup
  connect: (body) => request("/setup/connect", { method: "POST", body }),
  seed: () => request("/setup/seed", { method: "POST" }),
  createIndexes: () => request("/setup/indexes", { method: "POST" }),
  createSearchIndexes: () => request("/setup/search-indexes", { method: "POST" }),
  createVectorIndexes: (body) => request("/setup/vector-indexes", { method: "POST", body }),
  generateEmbeddings: (body) => request("/setup/generate-embeddings", { method: "POST", body }),
  status: () => request("/setup/status"),

  // Search
  search: (type, body) => request(`/search/${type}`, { method: "POST", body }),
  graphFull: (source) => request(`/search/graph/full?source=${source}`),
  graphNeighbors: (body) => request("/search/graph/neighbors", { method: "POST", body }),

  // Agents
  agent: (name, body) => request(`/agents/${name}`, { method: "POST", body }),
};
