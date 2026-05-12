import { useState, useCallback, useEffect } from "react";
import { api } from "../hooks/useApi.js";
import GraphVisualization from "../components/search/GraphVisualization.jsx";
import ResultsTable from "../components/search/ResultsTable.jsx";
import NodeDetail from "../components/search/NodeDetail.jsx";

const SEARCH_TYPES = [
  {
    value: "lexical",
    label: "Lexical",
    method: "Atlas Search $search with fuzzy matching on text fields.",
    advantages: "Fast keyword matching, typo-tolerant, no embeddings needed. Ideal for exact term lookups and known document titles.",
  },
  {
    value: "vector",
    label: "Vector",
    method: "Embeds the query via AI, then runs Atlas $vectorSearch against document embeddings.",
    advantages: "Understands meaning, not just keywords. Finds semantically similar documents even with different wording.",
  },
  {
    value: "hybrid",
    label: "Hybrid ($rankFusion)",
    method: "Combines vector search + lexical search using MongoDB's native $rankFusion with 50/50 weighting.",
    advantages: "Best of both worlds — captures exact keyword hits and semantic matches. Reduces blind spots of either method alone.",
  },
  {
    value: "hybrid-graph",
    label: "Hybrid Graph",
    method: "Vector search seeds (top 5) → $facet → $graphLookup (depth 5) to traverse document connections, then deduplicates and merges.",
    advantages: "Discovers related documents through graph connections that pure text/vector search would miss. Reveals hidden relationships.",
  },
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
  const [taxonomyExpansion, setTaxonomyExpansion] = useState(false);
  const [expandedTerms, setExpandedTerms] = useState([]);

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
      const res = await api.search(searchType, { query, source, taxonomyExpansion });
      setResults(res.results || []);
      setPipeline(res.pipeline || null);
      setExpandedTerms(res.expandedTerms || []);
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
            <div key={t.value} className="relative group">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="searchType"
                  value={t.value}
                  checked={searchType === t.value}
                  onChange={() => setSearchType(t.value)}
                  className="accent-emerald-500"
                />
                <span className="text-gray-400 border-b border-dotted border-gray-600 group-hover:text-white transition">
                  {t.label}
                </span>
              </label>
              {/* Tooltip */}
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-72 bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-xl z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 pointer-events-none">
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-800 border-l border-t border-gray-600 rotate-45" />
                <h4 className="text-emerald-400 font-semibold text-xs mb-1.5">{t.label}</h4>
                <p className="text-gray-300 text-xs leading-relaxed mb-1.5">
                  <span className="text-gray-500 font-medium">Method: </span>{t.method}
                </p>
                <p className="text-gray-300 text-xs leading-relaxed">
                  <span className="text-gray-500 font-medium">Advantages: </span>{t.advantages}
                </p>
              </div>
            </div>
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

        <div className="relative group">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={taxonomyExpansion}
              onChange={(e) => setTaxonomyExpansion(e.target.checked)}
              className="accent-emerald-500"
            />
            <span className="text-gray-400 text-xs border-b border-dotted border-gray-600 group-hover:text-white transition">Taxonomy Expansion</span>
          </label>
          {/* Tooltip */}
          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-80 bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-xl z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 pointer-events-none">
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-800 border-l border-t border-gray-600 rotate-45" />
            <h4 className="text-emerald-400 font-semibold text-xs mb-1.5">Taxonomy Expansion</h4>
            <p className="text-gray-300 text-xs leading-relaxed mb-1.5">
              <span className="text-gray-500 font-medium">How it works: </span>
              Matches your query against the taxonomy tree, then automatically includes all descendant concepts in the search. For example, searching "Audit" also matches documents tagged with "Revenue Recognition", "IFRS 15", "Lease Accounting", etc.
            </p>
            <p className="text-gray-300 text-xs leading-relaxed">
              <span className="text-gray-500 font-medium">Advantages: </span>
              Broader recall without manually listing every sub-concept. Ensures you find all relevant documents across the entire branch of the taxonomy hierarchy, even when they use more specific terminology.
            </p>
          </div>
        </div>
      </div>

      {/* Expanded terms badges */}
      {expandedTerms.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-gray-500">Expanded terms:</span>
          {expandedTerms.map((term, i) => (
            <span key={i} className="bg-emerald-900/50 border border-emerald-700 text-emerald-300 px-2 py-0.5 rounded">
              {term}
            </span>
          ))}
        </div>
      )}

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
