import { useState } from "react";
import { api } from "../hooks/useApi.js";
import GraphVisualization from "../components/search/GraphVisualization.jsx";

const AGENTS = [
  {
    id: "natural-language",
    label: "Natural Language Query",
    description: "Query the graph in plain English",
    inputLabel: "Enter your question",
    placeholder: "Find documents about consolidation procedures...",
    field: "query",
  },
  {
    id: "document-impact",
    label: "Document Impact",
    description: "Find documents affected by a change to a given document",
    inputLabel: "Document ID",
    placeholder: "519945",
    field: "nodeId",
    hasDepth: true,
  },
  {
    id: "cross-reference-analyzer",
    label: "Cross-Reference Analyzer",
    description: "Analyze cross-reference patterns, hubs, orphans, and clusters",
    inputLabel: null,
    placeholder: null,
    field: null,
  },
  {
    id: "collection-explorer",
    label: "Collection Explorer",
    description: "Explore all documents within a collection",
    inputLabel: "Collection ID",
    placeholder: "C_25903752",
    field: "collectionId",
  },
  {
    id: "similarity-finder",
    label: "Similarity Finder",
    description: "Find semantically similar documents",
    inputLabel: "Search text or Document ID",
    placeholder: "consolidation audit...",
    field: "query",
  },
  {
    id: "critical-node",
    label: "Critical Node / Hub Detection",
    description: "Find structurally critical documents with highest connectivity and bridge scores",
    inputLabel: null,
    placeholder: null,
    field: null,
  },
  {
    id: "stale-document-detector",
    label: "Stale Document Detector",
    description: "Find outdated released documents that are still heavily referenced (compliance risk)",
    inputLabel: "Cutoff date (YYYY-MM-DD, default: 2 years ago)",
    placeholder: "2024-03-19",
    field: "cutoffDate",
  },
  {
    id: "concept-impact",
    label: "Concept Impact",
    description: "Find all documents affected if a concept or standard changes (includes descendant and ontology-linked concepts)",
    inputLabel: "Concept ID",
    placeholder: "T_IFRS15",
    field: "conceptId",
    isOntology: true,
  },
  {
    id: "taxonomy-gap-detector",
    label: "Taxonomy Gap Detector",
    description: "Find untagged documents, empty concepts, and poorly tagged documents",
    inputLabel: null,
    placeholder: null,
    field: null,
    isOntology: true,
  },
  {
    id: "relationship-suggester",
    label: "Relationship Suggester",
    description: "Suggest new ontology relationships based on document co-occurrence patterns",
    inputLabel: "Min co-occurrences (default: 3)",
    placeholder: "3",
    field: "minCoOccurrence",
    isOntology: true,
  },
];

export default function AgentsPage() {
  const [selected, setSelected] = useState(AGENTS[0]);
  const [inputVal, setInputVal] = useState("");
  const [depth, setDepth] = useState(3);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleRun = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      let res;
      if (selected.isOntology) {
        // Route ontology agents to taxonomy API
        const body = {};
        if (selected.field) body[selected.field] = inputVal;
        if (selected.id === "concept-impact") {
          res = await api.ontologyConceptImpact(body);
        } else if (selected.id === "taxonomy-gap-detector") {
          res = await api.ontologyGapDetector();
        } else if (selected.id === "relationship-suggester") {
          res = await api.ontologyRelationshipSuggester(body);
        }
      } else {
        const body = {};
        if (selected.field) body[selected.field] = inputVal;
        if (selected.hasDepth) body.depth = depth;
        res = await api.agent(selected.id, body);
      }
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const graphData = result?.outgoing || (result?.nodes ? result : null);
  const hasGraph =
    graphData &&
    ((graphData.nodes && graphData.nodes.length > 0) ||
      (graphData.edges && graphData.edges.length > 0));

  return (
    <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
      {/* Agent selector */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold mb-3">Agents</h2>
        {AGENTS.map((a, idx) => (
          <div key={a.id}>
            {a.isOntology && idx > 0 && !AGENTS[idx - 1].isOntology && (
              <div className="border-t border-gray-700 my-3 pt-1">
                <span className="text-[10px] text-indigo-400 uppercase font-semibold tracking-wider">Ontology Agents</span>
              </div>
            )}
            <button
              onClick={() => {
                setSelected(a);
                setResult(null);
                setError("");
                setInputVal("");
              }}
            className={`w-full text-left px-4 py-3 rounded border transition ${
              selected.id === a.id
                ? "bg-emerald-900/40 border-emerald-600 text-emerald-300"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
            }`}
          >
            <div className="font-medium text-sm">{a.label}</div>
            <div className="text-xs mt-0.5 opacity-70">{a.description}</div>
          </button>
          </div>
        ))}
      </div>

      {/* Agent I/O */}
      <div className="md:col-span-2 space-y-4">
        <h2 className="text-lg font-semibold">{selected.label}</h2>
        <p className="text-sm text-gray-500">{selected.description}</p>

        {/* Input */}
        {selected.field && (
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">
                {selected.inputLabel}
              </label>
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder={selected.placeholder}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
            {selected.hasDepth && (
              <div className="w-20">
                <label className="block text-xs text-gray-500 mb-1">
                  Depth
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={depth}
                  onChange={(e) => setDepth(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleRun}
          disabled={loading || (selected.field && !inputVal.trim())}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded text-sm font-medium transition disabled:opacity-40"
        >
          {loading ? "Running..." : "Run Agent"}
        </button>

        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-2 rounded text-sm">
            {error}
          </div>
        )}

        {/* Output */}
        {result && (
          <div className="space-y-4">
            {result.explanation && (
              <div className="bg-gray-800 border border-gray-700 rounded p-4 text-sm text-gray-300">
                {result.explanation}
              </div>
            )}

            {/* Structured results */}
            {result.results && result.results.length > 0 && result.agent !== "critical-node" && result.agent !== "stale-document-detector" && (
              <div className="overflow-auto max-h-60 border border-gray-800 rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 text-gray-400 font-medium">ID</th>
                      <th className="text-left px-3 py-2 text-gray-400 font-medium">Title</th>
                      <th className="text-left px-3 py-2 text-gray-400 font-medium">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map((r, i) => (
                      <tr key={r.id || r._id || i} className="border-t border-gray-800">
                        <td className="px-3 py-2 font-mono text-emerald-400">{r.id || r._id}</td>
                        <td className="px-3 py-2 text-gray-300 truncate max-w-[200px]">{r.documentTitle || "—"}</td>
                        <td className="px-3 py-2 text-gray-400">{r.score?.toFixed(4) || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Critical Node / Hub Detection results */}
            {result.agent === "critical-node" && result.results && (
              <div className="space-y-3">
                {result.summary && (
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>Total Nodes: <span className="text-gray-300">{result.summary.totalNodes}</span></span>
                    <span>Total Edges: <span className="text-gray-300">{result.summary.totalEdges}</span></span>
                    <span>Analyzed: <span className="text-gray-300">{result.summary.analyzedNodes}</span></span>
                  </div>
                )}
                <div className="overflow-auto max-h-96 border border-gray-800 rounded">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800 sticky top-0">
                      <tr>
                        <th className="text-left px-2 py-2 text-gray-400 font-medium">#</th>
                        <th className="text-left px-2 py-2 text-gray-400 font-medium">ID</th>
                        <th className="text-left px-2 py-2 text-gray-400 font-medium">Title</th>
                        <th className="text-right px-2 py-2 text-gray-400 font-medium">Score</th>
                        <th className="text-right px-2 py-2 text-gray-400 font-medium">In</th>
                        <th className="text-right px-2 py-2 text-gray-400 font-medium">Out</th>
                        <th className="text-right px-2 py-2 text-gray-400 font-medium">Total</th>
                        <th className="text-right px-2 py-2 text-gray-400 font-medium">Bridges</th>
                        <th className="text-right px-2 py-2 text-gray-400 font-medium">Types</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.results.map((r, i) => (
                        <tr key={r.id} className="border-t border-gray-800">
                          <td className="px-2 py-2 text-gray-500">{i + 1}</td>
                          <td className="px-2 py-2 font-mono text-emerald-400">{r.id}</td>
                          <td className="px-2 py-2 text-gray-300 truncate max-w-[180px]" title={r.documentTitle}>{r.documentTitle}</td>
                          <td className="px-2 py-2 text-right text-yellow-400 font-mono">{r.criticalityScore.toFixed(1)}</td>
                          <td className="px-2 py-2 text-right text-gray-400 font-mono">{r.inDegree}</td>
                          <td className="px-2 py-2 text-right text-gray-400 font-mono">{r.outDegree}</td>
                          <td className="px-2 py-2 text-right text-gray-300 font-mono">{r.totalDegree}</td>
                          <td className="px-2 py-2 text-right text-blue-400 font-mono">{r.bridgeCount}</td>
                          <td className="px-2 py-2 text-right text-gray-400 font-mono">{r.linkTypeCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Stale Document Detector results */}
            {result.agent === "stale-document-detector" && result.results && (
              <div className="space-y-3">
                {result.summary && (
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>Total Stale: <span className="text-gray-300">{result.summary.totalStale}</span></span>
                    <span>With Inbound Refs: <span className="text-red-400">{result.summary.withInboundRefs}</span></span>
                    <span>Cutoff: <span className="text-gray-300">{result.input?.cutoffDate}</span></span>
                  </div>
                )}
                <div className="overflow-auto max-h-96 border border-gray-800 rounded">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800 sticky top-0">
                      <tr>
                        <th className="text-left px-2 py-2 text-gray-400 font-medium">#</th>
                        <th className="text-left px-2 py-2 text-gray-400 font-medium">ID</th>
                        <th className="text-left px-2 py-2 text-gray-400 font-medium">Title</th>
                        <th className="text-right px-2 py-2 text-gray-400 font-medium">Risk</th>
                        <th className="text-right px-2 py-2 text-gray-400 font-medium">Inbound</th>
                        <th className="text-left px-2 py-2 text-gray-400 font-medium">Version Date</th>
                        <th className="text-left px-2 py-2 text-gray-400 font-medium">Effective</th>
                        <th className="text-right px-2 py-2 text-gray-400 font-medium">Days Past</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.results.map((r, i) => (
                        <tr key={r.id} className="border-t border-gray-800">
                          <td className="px-2 py-2 text-gray-500">{i + 1}</td>
                          <td className="px-2 py-2 font-mono text-emerald-400">{r.id}</td>
                          <td className="px-2 py-2 text-gray-300 truncate max-w-[160px]" title={r.documentTitle}>{r.documentTitle}</td>
                          <td className="px-2 py-2 text-right text-red-400 font-mono font-bold">{r.riskScore}</td>
                          <td className="px-2 py-2 text-right text-yellow-400 font-mono">{r.inboundReferences}</td>
                          <td className="px-2 py-2 text-gray-400 font-mono">{r.versionDate || "—"}</td>
                          <td className="px-2 py-2 text-gray-400 font-mono">{r.effectiveDate || "—"}</td>
                          <td className="px-2 py-2 text-right text-gray-400 font-mono">{r.daysPastCutoff}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Hub / analyzer results */}
            {result.hubs && (
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium text-gray-400 mb-2">Top Hubs (outgoing)</h4>
                  {result.hubs.map((h) => (
                    <div key={h._id} className="flex justify-between bg-gray-800/50 px-3 py-1 rounded mb-1">
                      <span className="font-mono text-emerald-400">{h._id}</span>
                      <span className="text-gray-400">{h.outDegree}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <h4 className="font-medium text-gray-400 mb-2">Top Targets (incoming)</h4>
                  {result.topTargets?.map((t) => (
                    <div key={t._id} className="flex justify-between bg-gray-800/50 px-3 py-1 rounded mb-1">
                      <span className="font-mono text-emerald-400">{t._id}</span>
                      <span className="text-gray-400">{t.inDegree}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <h4 className="font-medium text-gray-400 mb-2">Link Type Distribution</h4>
                  {result.linkTypeDistribution?.map((l) => (
                    <div key={l._id} className="flex justify-between bg-gray-800/50 px-3 py-1 rounded mb-1">
                      <span className="text-gray-300">{l._id}</span>
                      <span className="text-gray-400">{l.count}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <h4 className="font-medium text-gray-400 mb-2">Orphan Nodes</h4>
                  <p className="text-gray-500 text-sm">{result.orphanNodes?.length || 0} orphan(s)</p>
                </div>
              </div>
            )}

            {/* Graph visualization for agents that return graph data */}
            {hasGraph && (
              <div>
                <h4 className="font-medium text-gray-400 mb-2">Graph</h4>
                <GraphVisualization
                  nodes={graphData.nodes || []}
                  edges={graphData.edges || []}
                  layout="force"
                  height={400}
                />
              </div>
            )}

            {/* Concept Impact results */}
            {selected.id === "concept-impact" && result.concept && (
              <div className="space-y-3">
                <div className="bg-gray-800 border border-gray-700 rounded p-3 text-sm">
                  <span className="text-gray-500">Concept:</span>
                  <span className="ml-2 text-emerald-400 font-mono">{result.concept._id}</span>
                  <span className="ml-2 text-white">{result.concept.label}</span>
                </div>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>Descendants: <span className="text-gray-300">{result.descendants?.length || 0}</span></span>
                  <span>Related Edges: <span className="text-gray-300">{result.relatedEdges?.length || 0}</span></span>
                  <span>Affected Docs: <span className="text-yellow-400">{result.affectedDocuments?.length || 0}</span></span>
                </div>
                {result.descendants?.length > 0 && (
                  <div className="text-xs">
                    <span className="text-gray-500">Descendants: </span>
                    <span className="text-gray-400">
                      {result.descendants.map((d) => d.label).join(", ")}
                    </span>
                  </div>
                )}
                {result.affectedDocuments?.length > 0 && (
                  <div className="overflow-auto max-h-60 border border-gray-800 rounded">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-800 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 text-gray-400 font-medium">ID</th>
                          <th className="text-left px-3 py-2 text-gray-400 font-medium">Title</th>
                          <th className="text-left px-3 py-2 text-gray-400 font-medium">Concepts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.affectedDocuments.map((d) => (
                          <tr key={d._id} className="border-t border-gray-800">
                            <td className="px-3 py-2 font-mono text-emerald-400">{d._id}</td>
                            <td className="px-3 py-2 text-gray-300 truncate max-w-[200px]">{d.documentTitle || "—"}</td>
                            <td className="px-3 py-2 text-gray-500 text-xs">{(d.conceptIDs || []).join(", ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Taxonomy Gap Detector results */}
            {selected.id === "taxonomy-gap-detector" && result.summary && (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-3">
                  {[
                    ["Total Docs", result.summary.totalDocuments, "text-gray-300"],
                    ["Untagged", result.summary.untagged, "text-red-400"],
                    ["Empty Concepts", result.summary.emptyConcepts, "text-yellow-400"],
                    ["Poorly Tagged", result.summary.poorlyTagged, "text-orange-400"],
                  ].map(([label, val, color]) => (
                    <div key={label} className="bg-gray-800 rounded p-3 text-center">
                      <div className={`text-2xl font-bold ${color}`}>{val}</div>
                      <div className="text-xs text-gray-500 mt-1">{label}</div>
                    </div>
                  ))}
                </div>
                {result.emptyConcepts?.length > 0 && (
                  <div>
                    <h4 className="text-xs text-gray-500 uppercase font-semibold mb-1">Empty Concepts (no documents)</h4>
                    <div className="flex flex-wrap gap-1">
                      {result.emptyConcepts.map((c) => (
                        <span key={c._id} className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded">
                          {c.label} <span className="text-gray-600">({c._id})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {result.untaggedDocuments?.length > 0 && (
                  <div>
                    <h4 className="text-xs text-gray-500 uppercase font-semibold mb-1">Untagged Documents</h4>
                    <div className="overflow-auto max-h-40 border border-gray-800 rounded">
                      <table className="w-full text-xs">
                        <tbody>
                          {result.untaggedDocuments.map((d) => (
                            <tr key={d._id} className="border-t border-gray-800">
                              <td className="px-3 py-1 font-mono text-emerald-400">{d._id}</td>
                              <td className="px-3 py-1 text-gray-400">{d.documentTitle || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Relationship Suggester results */}
            {selected.id === "relationship-suggester" && Array.isArray(result) && (
              <div className="space-y-2">
                <h4 className="text-xs text-gray-500 uppercase font-semibold">
                  Suggestions ({result.length})
                </h4>
                {result.length > 0 ? (
                  <div className="overflow-auto max-h-60 border border-gray-800 rounded">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-800 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 text-gray-400 font-medium">Source</th>
                          <th className="text-left px-3 py-2 text-gray-400 font-medium">Target</th>
                          <th className="text-right px-3 py-2 text-gray-400 font-medium">Co-occurrences</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.map((s, i) => (
                          <tr key={i} className="border-t border-gray-800">
                            <td className="px-3 py-2 text-gray-300">{s.sourceLabel} <span className="text-gray-600 text-xs">({s.sourceID})</span></td>
                            <td className="px-3 py-2 text-gray-300">{s.targetLabel} <span className="text-gray-600 text-xs">({s.targetID})</span></td>
                            <td className="px-3 py-2 text-right text-yellow-400 font-mono">{s.coOccurrences}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-gray-600">No suggestions found above threshold.</p>
                )}
              </div>
            )}

            {/* Raw JSON fallback */}
            <details className="text-xs">
              <summary className="text-gray-600 cursor-pointer hover:text-gray-400">
                Raw response
              </summary>
              <pre className="bg-gray-900 border border-gray-800 rounded p-3 mt-2 overflow-auto max-h-60 text-gray-500">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
