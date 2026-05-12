import { useState, useEffect } from "react";
import { api } from "../../hooks/useApi.js";

const ONTOLOGY_REL_TYPES = ["is-a", "part-of", "applies-to", "supersedes", "governed-by"];
const REL_COLORS = {
  "parent-child": "bg-gray-600",
  "is-a": "bg-purple-600",
  "part-of": "bg-blue-600",
  "applies-to": "bg-emerald-600",
  "supersedes": "bg-red-600",
  "governed-by": "bg-yellow-600",
};

export default function ConceptDetail({ node, documents, onUpdate, onDelete, onAddChild, onRefresh, loading }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(node.label);
  const [description, setDescription] = useState(node.description || "");
  const [type, setType] = useState(node.type || "concept");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Properties state
  const [editingProps, setEditingProps] = useState(false);
  const [properties, setProperties] = useState(node.properties || {});
  const [newPropKey, setNewPropKey] = useState("");
  const [newPropVal, setNewPropVal] = useState("");

  // Relationships state
  const [relationships, setRelationships] = useState({ outgoing: [], incoming: [] });
  const [showAddRel, setShowAddRel] = useState(false);
  const [relTarget, setRelTarget] = useState("");
  const [relType, setRelType] = useState("is-a");
  const [allNodes, setAllNodes] = useState([]);

  // Reset form when node changes
  if (label !== node.label && !editing) {
    setLabel(node.label);
    setDescription(node.description || "");
    setType(node.type || "concept");
  }

  // Sync properties when node changes
  useEffect(() => {
    setProperties(node.properties || {});
  }, [node._id, node.properties]);

  // Load relationships and all nodes
  useEffect(() => {
    api.ontologyRelationships(node._id).then(setRelationships).catch(() => {});
    api.taxonomyNodes().then((d) => setAllNodes(d.nodes || [])).catch(() => {});
  }, [node._id]);

  const handleSave = () => {
    onUpdate(node._id, { label, description, type });
    setEditing(false);
  };

  const handleCancel = () => {
    setLabel(node.label);
    setDescription(node.description || "");
    setType(node.type || "concept");
    setEditing(false);
  };

  const handleSaveProperties = () => {
    onUpdate(node._id, { properties });
    setEditingProps(false);
  };

  const handleAddProperty = () => {
    if (!newPropKey.trim()) return;
    setProperties((p) => ({ ...p, [newPropKey.trim()]: newPropVal }));
    setNewPropKey("");
    setNewPropVal("");
  };

  const handleRemoveProperty = (key) => {
    setProperties((p) => {
      const next = { ...p };
      delete next[key];
      return next;
    });
  };

  const handleAddRelationship = async () => {
    if (!relTarget || !relType) return;
    try {
      await api.ontologyCreateRelationship({ sourceID: node._id, targetID: relTarget, relationshipType: relType });
      const rels = await api.ontologyRelationships(node._id);
      setRelationships(rels);
      setShowAddRel(false);
      setRelTarget("");
      onRefresh?.();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteRelationship = async (sourceID, targetID, relationshipType) => {
    try {
      await api.ontologyDeleteRelationship({ sourceID, targetID, relationshipType });
      const rels = await api.ontologyRelationships(node._id);
      setRelationships(rels);
      onRefresh?.();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded p-4 space-y-4 max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Concept Detail</h3>
        <div className="flex gap-2">
          {!editing && (
            <>
              <button
                onClick={() => setEditing(true)}
                className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400 hover:text-white transition"
              >
                Edit
              </button>
              <button
                onClick={onAddChild}
                className="text-xs px-2 py-1 rounded bg-emerald-800 text-emerald-300 hover:text-white transition"
              >
                + Child
              </button>
            </>
          )}
        </div>
      </div>

      {/* ID and path */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-gray-500">ID:</span>
          <span className="ml-2 text-emerald-400 font-mono">{node._id}</span>
        </div>
        <div>
          <span className="text-gray-500">Level:</span>
          <span className="ml-2 text-gray-300">{node.level}</span>
        </div>
        <div className="col-span-2">
          <span className="text-gray-500">Path:</span>
          <span className="ml-2 text-gray-400 font-mono text-[11px]">{(node.path || []).join(" → ")}</span>
        </div>
      </div>

      {/* Editable fields */}
      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="category">Category</option>
              <option value="topic">Topic</option>
              <option value="standard">Standard</option>
              <option value="concept">Concept</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-medium transition disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-xs font-medium transition"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <span className="text-xs text-gray-500">Label:</span>
            <span className="ml-2 text-white">{node.label}</span>
          </div>
          <div>
            <span className="text-xs text-gray-500">Description:</span>
            <span className="ml-2 text-gray-300">{node.description || "—"}</span>
          </div>
          <div>
            <span className="text-xs text-gray-500">Type:</span>
            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-medium text-white
              ${node.type === "category" ? "bg-purple-600" : node.type === "topic" ? "bg-blue-600" : node.type === "standard" ? "bg-emerald-600" : "bg-yellow-600"}`}>
              {node.type}
            </span>
          </div>
        </div>
      )}

      {/* Properties */}
      <div className="border-t border-gray-800 pt-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs text-gray-500 font-semibold uppercase">Properties</h4>
          {!editingProps ? (
            <button
              onClick={() => setEditingProps(true)}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition"
            >
              Edit
            </button>
          ) : (
            <div className="flex gap-1">
              <button onClick={handleSaveProperties} className="text-xs text-emerald-400 hover:text-emerald-300">Save</button>
              <button onClick={() => { setProperties(node.properties || {}); setEditingProps(false); }} className="text-xs text-gray-400 hover:text-gray-300">Cancel</button>
            </div>
          )}
        </div>
        {Object.keys(properties).length > 0 ? (
          <div className="space-y-1">
            {Object.entries(properties).map(([k, v]) => (
              <div key={k} className="flex items-center text-xs gap-2">
                <span className="text-gray-500 min-w-[100px]">{k}:</span>
                {editingProps ? (
                  <>
                    <input
                      value={v || ""}
                      onChange={(e) => setProperties((p) => ({ ...p, [k]: e.target.value }))}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-white text-xs"
                    />
                    <button onClick={() => handleRemoveProperty(k)} className="text-red-400 hover:text-red-300 text-[10px]">✕</button>
                  </>
                ) : (
                  <span className="text-gray-300">{String(v)}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <span className="text-xs text-gray-600">No properties set.</span>
        )}
        {editingProps && (
          <div className="flex gap-1 mt-2">
            <input
              placeholder="key"
              value={newPropKey}
              onChange={(e) => setNewPropKey(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-white w-24"
            />
            <input
              placeholder="value"
              value={newPropVal}
              onChange={(e) => setNewPropVal(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-white"
            />
            <button onClick={handleAddProperty} className="text-xs text-emerald-400 hover:text-emerald-300">+ Add</button>
          </div>
        )}
      </div>

      {/* Ontology Relationships */}
      <div className="border-t border-gray-800 pt-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs text-gray-500 font-semibold uppercase">Ontology Relationships</h4>
          <button
            onClick={() => setShowAddRel(!showAddRel)}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition"
          >
            {showAddRel ? "Cancel" : "+ Add"}
          </button>
        </div>

        {showAddRel && (
          <div className="bg-gray-800 rounded p-2 mb-2 space-y-2">
            <div className="flex gap-2">
              <select
                value={relType}
                onChange={(e) => setRelType(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
              >
                {ONTOLOGY_REL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select
                value={relTarget}
                onChange={(e) => setRelTarget(e.target.value)}
                className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
              >
                <option value="">Select target...</option>
                {allNodes.filter((n) => n._id !== node._id).map((n) => (
                  <option key={n._id} value={n._id}>{n.label} ({n._id})</option>
                ))}
              </select>
              <button onClick={handleAddRelationship} className="bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded text-xs">Add</button>
            </div>
          </div>
        )}

        {/* Outgoing */}
        {relationships.outgoing?.filter((r) => r.relationshipType !== "parent-child").length > 0 && (
          <div className="mb-2">
            <span className="text-[10px] text-gray-500 uppercase">Outgoing</span>
            <div className="space-y-1 mt-1">
              {relationships.outgoing.filter((r) => r.relationshipType !== "parent-child").map((r, i) => (
                <div key={i} className="flex items-center gap-1 text-xs">
                  <span className={`px-1.5 py-0.5 rounded text-white text-[10px] ${REL_COLORS[r.relationshipType] || "bg-gray-600"}`}>
                    {r.relationshipType}
                  </span>
                  <span className="text-gray-300">→ {r.targetNode?.label || r.targetID}</span>
                  <button
                    onClick={() => handleDeleteRelationship(r.sourceID, r.targetID, r.relationshipType)}
                    className="text-red-400 hover:text-red-300 text-[10px] ml-auto"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Incoming */}
        {relationships.incoming?.filter((r) => r.relationshipType !== "parent-child").length > 0 && (
          <div>
            <span className="text-[10px] text-gray-500 uppercase">Incoming</span>
            <div className="space-y-1 mt-1">
              {relationships.incoming.filter((r) => r.relationshipType !== "parent-child").map((r, i) => (
                <div key={i} className="flex items-center gap-1 text-xs">
                  <span className="text-gray-300">{r.sourceNode?.label || r.sourceID} →</span>
                  <span className={`px-1.5 py-0.5 rounded text-white text-[10px] ${REL_COLORS[r.relationshipType] || "bg-gray-600"}`}>
                    {r.relationshipType}
                  </span>
                  <button
                    onClick={() => handleDeleteRelationship(r.sourceID, r.targetID, r.relationshipType)}
                    className="text-red-400 hover:text-red-300 text-[10px] ml-auto"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {relationships.outgoing?.filter((r) => r.relationshipType !== "parent-child").length === 0 &&
         relationships.incoming?.filter((r) => r.relationshipType !== "parent-child").length === 0 && (
          <span className="text-xs text-gray-600">No ontology relationships.</span>
        )}
      </div>

      {/* Parent & children */}
      <div className="border-t border-gray-800 pt-3 space-y-2">
        <div className="text-xs">
          <span className="text-gray-500">Parent:</span>
          <span className="ml-2 text-gray-300">{node.parent ? node.parent.label : "— (root)"}</span>
        </div>
        {node.children && node.children.length > 0 && (
          <div className="text-xs">
            <span className="text-gray-500">Children ({node.children.length}):</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {node.children.map((c) => (
                <span key={c._id} className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded">
                  {c.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tagged documents */}
      <div className="border-t border-gray-800 pt-3">
        <h4 className="text-xs text-gray-500 mb-2">Tagged Documents ({documents.length})</h4>
        {documents.length > 0 ? (
          <div className="max-h-40 overflow-y-auto space-y-1">
            {documents.map((doc) => (
              <div key={doc._id} className="text-xs text-gray-400 flex gap-2">
                <span className="text-emerald-400 font-mono flex-shrink-0">{doc._id}</span>
                <span className="truncate">{doc.documentTitle}</span>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-xs text-gray-600">No documents tagged with this concept.</span>
        )}
      </div>

      {/* Delete */}
      <div className="border-t border-gray-800 pt-3">
        {!deleteConfirm ? (
          <button
            onClick={() => setDeleteConfirm(true)}
            className="text-xs text-red-400 hover:text-red-300 transition"
          >
            Delete this concept...
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-red-300">How should children be handled?</p>
            <div className="flex gap-2">
              <button
                onClick={() => { handleDeleteAction("reparent"); }}
                disabled={loading}
                className="bg-yellow-800 hover:bg-yellow-700 text-white px-3 py-1.5 rounded text-xs font-medium transition disabled:opacity-50"
              >
                Reparent children
              </button>
              <button
                onClick={() => { handleDeleteAction("cascade"); }}
                disabled={loading}
                className="bg-red-800 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs font-medium transition disabled:opacity-50"
              >
                Delete all
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-xs font-medium transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  function handleDeleteAction(mode) {
    onDelete(node._id, mode);
    setDeleteConfirm(false);
  }
}
