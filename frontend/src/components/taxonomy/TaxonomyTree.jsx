import { useState, useCallback } from "react";

const TYPE_COLORS = {
  category: "bg-purple-600",
  topic: "bg-blue-600",
  standard: "bg-emerald-600",
  concept: "bg-yellow-600",
};

const TYPE_DOT_COLORS = {
  category: "bg-purple-400",
  topic: "bg-blue-400",
  standard: "bg-emerald-400",
  concept: "bg-yellow-400",
};

function TreeNode({ node, depth, selectedNodeId, onNodeSelect, onNodeMove, expandedIds, toggleExpand }) {
  const isSelected = node._id === selectedNodeId;
  const isExpanded = expandedIds.has(node._id);
  const hasChildren = node.children && node.children.length > 0;

  const handleDragStart = (e) => {
    e.dataTransfer.setData("text/plain", node._id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData("text/plain");
    if (draggedId && draggedId !== node._id) {
      onNodeMove(draggedId, node._id);
    }
  };

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition group
          ${isSelected ? "bg-gray-700 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"}`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => onNodeSelect(node)}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(node._id);
            }}
            className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-white text-xs"
          >
            {isExpanded ? "▼" : "▶"}
          </button>
        ) : (
          <span className="w-4 h-4" />
        )}

        {/* Type indicator dot */}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${TYPE_DOT_COLORS[node.type] || TYPE_DOT_COLORS.concept}`} />

        {/* Label */}
        <span className="truncate flex-1">{node.label}</span>

        {/* Type badge */}
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium text-white opacity-60 group-hover:opacity-100 ${TYPE_COLORS[node.type] || TYPE_COLORS.concept}`}>
          {node.type}
        </span>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child._id}
              node={child}
              depth={depth + 1}
              selectedNodeId={selectedNodeId}
              onNodeSelect={onNodeSelect}
              onNodeMove={onNodeMove}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Collect all node IDs from the tree for initial expansion.
 */
function collectAllIds(nodes) {
  const ids = new Set();
  function walk(items) {
    for (const n of items) {
      ids.add(n._id);
      if (n.children) walk(n.children);
    }
  }
  walk(nodes);
  return ids;
}

export default function TaxonomyTree({ tree, selectedNodeId, onNodeSelect, onNodeMove }) {
  const [expandedIds, setExpandedIds] = useState(() => collectAllIds(tree));

  // Update expanded set when tree changes
  const allIds = collectAllIds(tree);
  // Auto-expand newly added nodes
  for (const id of allIds) {
    if (!expandedIds.has(id)) expandedIds.add(id);
  }

  const toggleExpand = useCallback((id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (tree.length === 0) {
    return (
      <div className="text-gray-500 text-sm text-center py-8">
        No taxonomy data. Seed the database to generate the taxonomy tree.
      </div>
    );
  }

  return (
    <div className="space-y-0.5 max-h-[600px] overflow-y-auto">
      {tree.map((root) => (
        <TreeNode
          key={root._id}
          node={root}
          depth={0}
          selectedNodeId={selectedNodeId}
          onNodeSelect={onNodeSelect}
          onNodeMove={onNodeMove}
          expandedIds={expandedIds}
          toggleExpand={toggleExpand}
        />
      ))}

      {/* Legend */}
      <div className="flex gap-3 pt-4 border-t border-gray-800 mt-4 text-xs text-gray-500 flex-wrap">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${TYPE_DOT_COLORS[type]}`} />
            {type}
          </span>
        ))}
        <span className="ml-auto text-gray-600">Drag & drop to reparent</span>
      </div>
    </div>
  );
}
