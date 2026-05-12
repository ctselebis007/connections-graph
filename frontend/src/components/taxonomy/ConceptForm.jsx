import { useState } from "react";

/**
 * Flatten a tree into an array of { _id, label, depth } for the parent dropdown.
 */
function flattenTree(nodes, depth = 0) {
  const result = [];
  for (const n of nodes) {
    result.push({ _id: n._id, label: n.label, depth });
    if (n.children) result.push(...flattenTree(n.children, depth + 1));
  }
  return result;
}

export default function ConceptForm({ tree, parentId, onSubmit, onCancel, loading }) {
  const [id, setId] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("concept");
  const [selectedParentId, setSelectedParentId] = useState(parentId || "");

  const flatNodes = flattenTree(tree);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!id.trim() || !label.trim()) return;
    onSubmit({
      _id: id.trim(),
      label: label.trim(),
      description: description.trim(),
      type,
      parentId: selectedParentId || undefined,
    });
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded p-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">New Concept</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">ID *</label>
          <input
            type="text"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="T_MYID"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            required
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Label *</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="My Concept"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            required
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Optional description..."
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
        <div>
          <label className="text-xs text-gray-500 block mb-1">Parent</label>
          <select
            value={selectedParentId}
            onChange={(e) => setSelectedParentId(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="">— None (root) —</option>
            {flatNodes.map((n) => (
              <option key={n._id} value={n._id}>
                {"  ".repeat(n.depth)}{n.label} ({n._id})
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={loading || !id.trim() || !label.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-sm font-medium transition disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm font-medium transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
