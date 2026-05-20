import { useEffect, useRef, useCallback, useMemo } from "react";
import * as d3 from "d3";

const TYPE_COLORS = {
  category: "#a78bfa",  // purple
  topic: "#60a5fa",     // blue
  standard: "#34d399",  // emerald
  concept: "#fbbf24",   // yellow
  rule: "#fb923c",      // orange
};

// Base palette for relationship types — extended dynamically
const BASE_REL_COLORS = {
  "parent-child": "#6b7280",
  "is-a": "#a78bfa",
  "part-of": "#60a5fa",
  "applies-to": "#34d399",
  "supersedes": "#f87171",
  "governed-by": "#fbbf24",
  "references": "#38bdf8",
  "records": "#818cf8",
  "authorizes": "#fb7185",
  "governs": "#facc15",
  "validates": "#4ade80",
};

const BASE_REL_DASH = {
  "parent-child": "",
  "is-a": "6,3",
  "part-of": "4,4",
  "applies-to": "8,4",
  "supersedes": "2,4",
  "governed-by": "10,3,2,3",
  "references": "5,3",
  "records": "7,3",
  "authorizes": "3,3",
  "governs": "9,3,2,3",
  "validates": "6,2,2,2",
};

// Extra colors for any unknown relationship types
const EXTRA_COLORS = ["#c084fc", "#22d3ee", "#f472b6", "#a3e635", "#e879f9", "#2dd4bf"];

export default function OntologyGraph({
  nodes = [],
  edges = [],
  onNodeClick,
  selectedNodeId,
  width = 900,
  height = 650,
}) {
  const svgRef = useRef(null);
  const simRef = useRef(null);

  // Derive relationship types from actual edge data
  const { relColors, relDash, activeRelTypes } = useMemo(() => {
    const types = [...new Set(edges.map((e) => e.relationshipType))];
    const colors = { ...BASE_REL_COLORS };
    const dash = { ...BASE_REL_DASH };
    let extraIdx = 0;
    for (const t of types) {
      if (!colors[t]) {
        colors[t] = EXTRA_COLORS[extraIdx % EXTRA_COLORS.length];
        extraIdx++;
      }
      if (!dash[t]) {
        dash[t] = `${4 + extraIdx},${2 + extraIdx}`;
      }
    }
    return { relColors: colors, relDash: dash, activeRelTypes: types };
  }, [edges]);

  const render = useCallback(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const w = width;
    const h = height;
    svg.attr("viewBox", `0 0 ${w} ${h}`);

    // Defs — arrowheads per relationship type
    const defs = svg.append("defs");
    Object.entries(relColors).forEach(([type, color]) => {
      defs
        .append("marker")
        .attr("id", `oa-${type.replace(/[^a-zA-Z]/g, "")}`)
        .attr("viewBox", "0 0 10 6")
        .attr("refX", 22)
        .attr("refY", 3)
        .attr("markerWidth", 8)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,0 L10,3 L0,6 Z")
        .attr("fill", color);
    });

    const g = svg.append("g");

    // Zoom
    svg.call(
      d3.zoom().scaleExtent([0.1, 8]).on("zoom", (e) => {
        g.attr("transform", e.transform);
      }),
    );

    // Build D3 data
    const nodeMap = new Map(nodes.map((n) => [n._id, { ...n, id: n._id }]));
    const linkData = edges
      .filter((e) => nodeMap.has(e.sourceID) && nodeMap.has(e.targetID) && e.sourceID !== e.targetID)
      .map((e, i) => ({
        source: e.sourceID,
        target: e.targetID,
        relationshipType: e.relationshipType,
        id: `${e.sourceID}-${e.targetID}-${e.relationshipType}-${i}`,
      }));
    const nodeData = [...nodeMap.values()];

    // Degree for sizing
    const degree = new Map();
    for (const e of linkData) {
      degree.set(e.source, (degree.get(e.source) || 0) + 1);
      degree.set(e.target, (degree.get(e.target) || 0) + 1);
    }

    const sim = d3
      .forceSimulation(nodeData)
      .force(
        "link",
        d3.forceLink(linkData).id((d) => d.id).distance(100),
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(w / 2, h / 2))
      .force("collide", d3.forceCollide(30));

    simRef.current = sim;

    // Links
    const link = g
      .append("g")
      .selectAll("line")
      .data(linkData)
      .join("line")
      .attr("stroke", (d) => relColors[d.relationshipType] || "#555")
      .attr("stroke-width", (d) => d.relationshipType === "parent-child" ? 2 : 1.5)
      .attr("stroke-dasharray", (d) => relDash[d.relationshipType] || "")
      .attr("marker-end", (d) => `url(#oa-${d.relationshipType.replace(/[^a-zA-Z]/g, "")})`);

    // Link labels
    const linkLabel = g
      .append("g")
      .selectAll("text")
      .data(linkData.filter((d) => d.relationshipType !== "parent-child"))
      .join("text")
      .attr("text-anchor", "middle")
      .attr("font-size", 9)
      .attr("fill", "#9ca3af")
      .attr("pointer-events", "none")
      .text((d) => d.relationshipType);

    // Node groups
    const node = g
      .append("g")
      .selectAll("g")
      .data(nodeData)
      .join("g")
      .attr("cursor", "pointer")
      .call(drag(sim))
      .on("click", (_e, d) => onNodeClick?.(d._id));

    node
      .append("circle")
      .attr("r", (d) => 6 + Math.min(degree.get(d.id) || 0, 15))
      .attr("fill", (d) => TYPE_COLORS[d.type] || "#6b7280")
      .attr("stroke", (d) => d._id === selectedNodeId ? "#fff" : "transparent")
      .attr("stroke-width", 2.5);

    // Labels
    node
      .append("text")
      .attr("dx", (d) => 8 + Math.min(degree.get(d.id) || 0, 15))
      .attr("dy", 4)
      .attr("font-size", 11)
      .attr("fill", "#e5e7eb")
      .text((d) => d.label);

    // Tooltip
    node.append("title").text((d) => `${d._id}\n${d.label}\nType: ${d.type}`);

    sim.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      linkLabel
        .attr("x", (d) => (d.source.x + d.target.x) / 2)
        .attr("y", (d) => (d.source.y + d.target.y) / 2 - 4);

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    function drag(sim) {
      return d3
        .drag()
        .on("start", (e, d) => {
          if (!e.active) sim.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (e, d) => {
          d.fx = e.x;
          d.fy = e.y;
        })
        .on("end", (e, d) => {
          if (!e.active) sim.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        });
    }
  }, [nodes, edges, selectedNodeId, width, height, onNodeClick, relColors, relDash]);

  useEffect(() => {
    render();
    return () => {
      if (simRef.current) simRef.current.stop();
    };
  }, [render]);

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        className="w-full bg-gray-900 rounded-lg border border-gray-700"
        style={{ minHeight: height }}
      />

      {/* Legend */}
      <div className="absolute top-2 right-2 bg-gray-800/90 rounded p-2 text-xs space-y-1 max-h-[90%] overflow-y-auto">
        <div className="text-gray-400 font-semibold mb-1">Node Types</div>
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span className="text-gray-300 capitalize">{type}</span>
          </div>
        ))}
        <div className="text-gray-400 font-semibold mt-2 mb-1">Relationships</div>
        {activeRelTypes
          .filter((t) => t !== "parent-child")
          .map((type) => (
            <div key={type} className="flex items-center gap-1.5">
              <svg width="20" height="6">
                <line
                  x1="0" y1="3" x2="20" y2="3"
                  stroke={relColors[type]}
                  strokeWidth="2"
                  strokeDasharray={relDash[type]}
                />
              </svg>
              <span className="text-gray-300">{type}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
