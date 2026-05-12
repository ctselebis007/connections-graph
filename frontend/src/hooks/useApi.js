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

  // Taxonomy
  taxonomyTree: () => request("/taxonomy/tree"),
  taxonomyNodes: () => request("/taxonomy/nodes"),
  taxonomyNode: (id) => request(`/taxonomy/nodes/${id}`),
  taxonomyCreate: (body) => request("/taxonomy/nodes", { method: "POST", body }),
  taxonomyUpdate: (id, body) => request(`/taxonomy/nodes/${id}`, { method: "PUT", body }),
  taxonomyDelete: (id, mode = "reparent") => request(`/taxonomy/nodes/${id}?mode=${mode}`, { method: "DELETE" }),
  taxonomyMove: (id, body) => request(`/taxonomy/nodes/${id}/move`, { method: "PUT", body }),
  taxonomyDescendants: (id) => request(`/taxonomy/nodes/${id}/descendants`),
  taxonomyDocuments: (id) => request(`/taxonomy/nodes/${id}/documents`),
  taxonomyTag: (body) => request("/taxonomy/tag", { method: "POST", body }),
  taxonomyUntag: (body) => request("/taxonomy/untag", { method: "POST", body }),

  // Ontology
  ontologyGraph: () => request("/taxonomy/ontology/graph"),
  ontologyRelationships: (id) => request(`/taxonomy/nodes/${id}/relationships`),
  ontologyCreateRelationship: (body) => request("/taxonomy/relationships", { method: "POST", body }),
  ontologyDeleteRelationship: (body) => request("/taxonomy/relationships", { method: "DELETE", body }),
  taxonomyTagWithInference: (body) => request("/taxonomy/tag-with-inference", { method: "POST", body }),

  // Import / Export
  taxonomyExportSKOS: () => request("/taxonomy/export/skos"),
  taxonomyImportSKOS: (body) => request("/taxonomy/import/skos", { method: "POST", body }),

  // Ontology Agents
  ontologyConceptImpact: (body) => request("/taxonomy/agents/concept-impact", { method: "POST", body }),
  ontologyGapDetector: () => request("/taxonomy/agents/taxonomy-gap-detector", { method: "POST" }),
  ontologyRelationshipSuggester: (body) => request("/taxonomy/agents/relationship-suggester", { method: "POST", body }),
};
