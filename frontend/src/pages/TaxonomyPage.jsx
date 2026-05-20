import { useState, useCallback, useEffect } from "react";
import { api } from "../hooks/useApi.js";
import TaxonomyTree from "../components/taxonomy/TaxonomyTree.jsx";
import ConceptDetail from "../components/taxonomy/ConceptDetail.jsx";
import ConceptForm from "../components/taxonomy/ConceptForm.jsx";
import OntologyGraph from "../components/taxonomy/OntologyGraph.jsx";

export default function TaxonomyPage() {
  const [tree, setTree] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodeDetail, setNodeDetail] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [logs, setLogs] = useState([]);
  const [viewMode, setViewMode] = useState("tree"); // "tree" | "graph"
  const [ontology, setOntology] = useState({ nodes: [], edges: [] });
  const [taxonomySets, setTaxonomySets] = useState([]);
  const [activeTaxonomySet, setActiveTaxonomySet] = useState(null);

  const log = (msg) => setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} — ${msg}`]);

  // Load available taxonomy sets on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await api.taxonomySets();
        const sets = data.sets || [];
        setTaxonomySets(sets);
        if (sets.length > 0 && !activeTaxonomySet) {
          setActiveTaxonomySet(sets[0]);
        }
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);

  const loadTree = useCallback(async () => {
    try {
      const data = await api.taxonomyTree(activeTaxonomySet);
      setTree(data.tree || []);
    } catch (err) {
      setError(err.message);
    }
  }, [activeTaxonomySet]);

  const loadOntologyGraph = useCallback(async () => {
    try {
      const data = await api.ontologyGraph(activeTaxonomySet);
      setOntology({ nodes: data.nodes || [], edges: data.edges || [] });
    } catch (err) {
      setError(err.message);
    }
  }, [activeTaxonomySet]);

  useEffect(() => {
    if (activeTaxonomySet) {
      loadTree();
      setSelectedNode(null);
      setNodeDetail(null);
      setDocuments([]);
    }
  }, [activeTaxonomySet, loadTree]);

  useEffect(() => {
    if (viewMode === "graph" && activeTaxonomySet) loadOntologyGraph();
  }, [viewMode, activeTaxonomySet, loadOntologyGraph]);

  const handleNodeSelect = useCallback(async (nodeOrId) => {
    const id = typeof nodeOrId === "string" ? nodeOrId : nodeOrId._id;
    setShowCreateForm(false);
    try {
      const detail = await api.taxonomyNode(id);
      setSelectedNode(detail.node || detail);
      setNodeDetail(detail);
      const docs = await api.taxonomyDocuments(id);
      setDocuments(docs.documents || []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const handleCreate = async (formData) => {
    setLoading(true);
    setError("");
    try {
      await api.taxonomyCreate({ ...formData, taxonomySet: activeTaxonomySet });
      log(`Created concept '${formData.label}' (${formData._id})`);
      setShowCreateForm(false);
      await loadTree();
      if (viewMode === "graph") await loadOntologyGraph();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id, updates) => {
    setLoading(true);
    setError("");
    try {
      await api.taxonomyUpdate(id, updates);
      log(`Updated concept '${id}'`);
      await loadTree();
      if (viewMode === "graph") await loadOntologyGraph();
      // Refresh detail
      const detail = await api.taxonomyNode(id);
      setNodeDetail(detail);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, mode) => {
    setLoading(true);
    setError("");
    try {
      const result = await api.taxonomyDelete(id, mode);
      log(`Deleted concept '${id}' (mode: ${mode}, deleted: ${result.deleted}${result.reparented ? `, reparented: ${result.reparented}` : ""})`);
      setSelectedNode(null);
      setNodeDetail(null);
      setDocuments([]);
      await loadTree();
      if (viewMode === "graph") await loadOntologyGraph();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMove = async (id, newParentId) => {
    setLoading(true);
    setError("");
    try {
      await api.taxonomyMove(id, { newParentId });
      log(`Moved concept '${id}' under '${newParentId}'`);
      await loadTree();
      if (viewMode === "graph") await loadOntologyGraph();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportSKOS = async () => {
    try {
      const jsonld = await api.taxonomyExportSKOS();
      const blob = new Blob([JSON.stringify(jsonld, null, 2)], { type: "application/ld+json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "taxonomy-skos.jsonld";
      a.click();
      URL.revokeObjectURL(url);
      log("Exported taxonomy as SKOS JSON-LD");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleImportSKOS = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.jsonld";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const jsonld = JSON.parse(text);
        const result = await api.taxonomyImportSKOS(jsonld);
        log(`Imported: ${result.nodesImported} nodes, ${result.edgesImported} edges`);
        await loadTree();
        if (viewMode === "graph") await loadOntologyGraph();
      } catch (err) {
        setError(err.message);
      }
    };
    input.click();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Taxonomy & Ontology</h1>
        <div className="flex items-center gap-3">
          {/* Taxonomy Set selector */}
          <select
            value={activeTaxonomySet || ""}
            onChange={(e) => setActiveTaxonomySet(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-3 py-1.5 focus:outline-none focus:border-indigo-500"
          >
            {taxonomySets.map((s) => (
              <option key={s} value={s}>
                {s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>

          {/* View toggle */}
          <div className="flex bg-gray-800 rounded overflow-hidden text-sm">
            <button
              onClick={() => setViewMode("tree")}
              className={`px-3 py-1.5 font-medium transition ${viewMode === "tree" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"}`}
            >
              Tree
            </button>
            <button
              onClick={() => setViewMode("graph")}
              className={`px-3 py-1.5 font-medium transition ${viewMode === "graph" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"}`}
            >
              Ontology Graph
            </button>
          </div>

          {/* Import / Export */}
          <button
            onClick={handleExportSKOS}
            className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded text-sm font-medium transition"
          >
            Export SKOS
          </button>
          <button
            onClick={handleImportSKOS}
            className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded text-sm font-medium transition"
          >
            Import SKOS
          </button>

          <button
            onClick={() => {
              setShowCreateForm(true);
              setSelectedNode(null);
              setNodeDetail(null);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-sm font-medium transition"
          >
            + New Concept
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-2 rounded text-sm">
          {error}
          <button onClick={() => setError("")} className="ml-2 text-red-400 hover:text-red-200">✕</button>
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Visualization */}
        <div className="lg:col-span-3">
          <div className="bg-gray-900 border border-gray-800 rounded p-4">
            {viewMode === "tree" ? (
              <>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Taxonomy Tree</h2>
                <TaxonomyTree
                  tree={tree}
                  selectedNodeId={selectedNode?._id}
                  onNodeSelect={handleNodeSelect}
                  onNodeMove={handleMove}
                />
              </>
            ) : (
              <>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Ontology Graph
                  <span className="ml-2 text-xs text-gray-500 font-normal">
                    ({ontology.nodes.length} nodes, {ontology.edges.length} edges)
                  </span>
                </h2>
                <OntologyGraph
                  nodes={ontology.nodes}
                  edges={ontology.edges}
                  selectedNodeId={selectedNode?._id}
                  onNodeClick={handleNodeSelect}
                />
              </>
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-2 space-y-4">
          {showCreateForm && (
            <ConceptForm
              tree={tree}
              parentId={selectedNode?._id}
              onSubmit={handleCreate}
              onCancel={() => setShowCreateForm(false)}
              loading={loading}
            />
          )}

          {nodeDetail && !showCreateForm && (
            <ConceptDetail
              node={nodeDetail}
              documents={documents}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onAddChild={() => {
                setShowCreateForm(true);
              }}
              onRefresh={async () => {
                if (selectedNode) await handleNodeSelect(selectedNode._id || selectedNode);
                if (viewMode === "graph") await loadOntologyGraph();
              }}
              loading={loading}
            />
          )}

          {!nodeDetail && !showCreateForm && (
            <div className="bg-gray-900 border border-gray-800 rounded p-6 text-center text-gray-500 text-sm">
              Select a concept from the {viewMode === "tree" ? "tree" : "graph"} or click "+ New Concept" to get started.
            </div>
          )}

          {/* Log */}
          <div className="bg-gray-900 border border-gray-800 rounded p-3">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Log</h3>
            <div className="h-40 overflow-y-auto font-mono text-xs text-gray-400 space-y-1">
              {logs.length === 0 && <span className="text-gray-600">No activity yet.</span>}
              {logs.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
