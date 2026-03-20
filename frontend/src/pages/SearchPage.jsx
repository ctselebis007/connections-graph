import { useState, useCallback, useEffect } from "react";
import { api } from "../hooks/useApi.js";
import GraphVisualization from "../components/search/GraphVisualization.jsx";
import ResultsTable from "../components/search/ResultsTable.jsx";
import NodeDetail from "../components/search/NodeDetail.jsx";

const SEARCH_TYPES = [
  { value: "lexical", label: "Lexical" },
  { value: "vector", label: "Vector" },
  { value: "hybrid", label: "Hybrid ($rankFusion)" },
  { value: "hybrid-graph", label: "Hybrid Graph" },
];
const LAYOUTS = ["force", "tree", "circle"];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState("lexical");
  const [source, setSource] = useState("documents");
  const [layout, setLayout] = useState("force");
  const [results, setResults] = useState([]);
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pipeline, setPipeline] = useState(null);
  const [showPipeline, setShowPipeline] = useState(false);

  // Load full graph on mount / source change
  const loadGraph = useCallback(async () => {
    try {
      const data = await api.graphFull(source === "documents" ? "documents" : "graph");
      setGraphData(data);
    } catch {
      // Graph may not be available yet
    }
  }, [source]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.search(searchType, { query, source });
      setResults(res.results || []);
      setPipeline(res.pipeline || null);
    } catch (err) {
      setError(err.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleNodeClick = useCallback(
    async (node) => {
      setSelectedNode(node);
      // load neighbors
      try {
        const g = await api.graphNeighbors({
          nodeId: node.id || node._id,
          depth: 2,
          source,
        });
        setGraphData(g);
      } catch {
        // keep existing graph
      }
    },
    [source]
  );

  const handleRowClick = (row) => {
    const node = {
      id: row._id || row.id,
      documentTitle: row.documentTitle,
      collectionIDs: row.collectionIDs,
      channelIDs: row.channelIDs,
      languageIDs: row.languageIDs,
      metadata: row.metadata,
      connectionCount: row.connections?.length,
    };
    handleNodeClick(node);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-3 items-end flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents..."
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-sm font-medium transition disabled:opacity-50"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {/* Controls */}
      <div className="flex gap-6 flex-wrap text-sm">
        <fieldset className="flex gap-2 items-center">
          <legend className="text-gray-500 text-xs mr-2">Search Type:</legend>
          {SEARCH_TYPES.map((t) => (
            <label key={t.value} className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="searchType"
                value={t.value}
                checked={searchType === t.value}
                onChange={() => setSearchType(t.value)}
                className="accent-emerald-500"
              />
              <span className="text-gray-400">{t.label}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className="flex gap-2 items-center">
          <legend className="text-gray-500 text-xs mr-2">Data Source:</legend>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name="source"
              value="documents"
              checked={source === "documents"}
              onChange={() => setSource("documents")}
              className="accent-emerald-500"
            />
            <span className="text-gray-400">Documents</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name="source"
              value="graph"
              checked={source === "graph"}
              onChange={() => setSource("graph")}
              className="accent-emerald-500"
            />
            <span className="text-gray-400">Graph Nodes+Edges</span>
          </label>
        </fieldset>

        <fieldset className="flex gap-2 items-center">
          <legend className="text-gray-500 text-xs mr-2">Layout:</legend>
          {LAYOUTS.map((l) => (
            <button
              key={l}
              onClick={() => setLayout(l)}
              className={`px-2 py-1 rounded text-xs font-medium transition ${
                layout === l
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {l.charAt(0).toUpperCase() + l.slice(1)}
            </button>
          ))}
        </fieldset>

        <button
          onClick={loadGraph}
          className="px-2 py-1 rounded text-xs font-medium bg-gray-800 text-gray-400 hover:text-white transition"
        >
          Load Full Graph
        </button>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {/* Pipeline toggle */}
      {pipeline && (
        <div>
          <button
            onClick={() => setShowPipeline((p) => !p)}
            className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium bg-gray-800 border border-gray-700 text-gray-400 hover:text-white transition"
          >
            <span className={`transition-transform ${showPipeline ? "rotate-90" : ""}`}>&#9654;</span>
            Aggregation Pipeline
          </button>
          {showPipeline && (
            <pre className="mt-2 bg-gray-900 border border-gray-700 rounded p-4 text-xs text-emerald-300 overflow-auto max-h-80 font-mono">
              {JSON.stringify(pipeline, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Main content */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          <ResultsTable results={results} onRowClick={handleRowClick} />
          <NodeDetail node={selectedNode} />
        </div>

        {/* Graph */}
        <div className="lg:col-span-3">
          <GraphVisualization
            nodes={graphData.nodes}
            edges={graphData.edges}
            layout={layout}
            onNodeClick={handleNodeClick}
            selectedNodeId={selectedNode?.id || selectedNode?._id}
            height={550}
          />

          {/* Legend */}
          <div className="flex gap-4 mt-3 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="inline-block w-8 h-0.5 bg-emerald-400" /> Cross
              Reference
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block w-8 h-0.5 bg-blue-400"
                style={{ borderTop: "2px dashed" }}
              />{" "}
              Image Link
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block w-8 h-0.5 bg-yellow-400"
                style={{ borderTop: "2px dotted" }}
              />{" "}
              Resource Link
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
