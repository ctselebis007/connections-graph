import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";

const LINK_COLORS = {
  "Cross Reference": "#6ee7b7",
  "Image Link": "#93c5fd",
  "Resource Link": "#fbbf24",
};

const LINK_DASH = {
  "Cross Reference": "",
  "Image Link": "6,3",
  "Resource Link": "2,3",
};

function collectionColor(collectionIDs) {
  const palette = [
    "#f472b6", "#a78bfa", "#60a5fa", "#34d399", "#fbbf24",
    "#fb923c", "#f87171", "#818cf8", "#22d3ee", "#a3e635",
  ];
  if (!collectionIDs || collectionIDs.length === 0) return "#6b7280";
  let hash = 0;
  const id = collectionIDs[0] || "";
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

export default function GraphVisualization({
  nodes = [],
  edges = [],
  layout = "force",
  onNodeClick,
  selectedNodeId,
  width = 800,
  height = 600,
}) {
  const svgRef = useRef(null);
  const simRef = useRef(null);

  const render = useCallback(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const w = width;
    const h = height;
    svg.attr("viewBox", `0 0 ${w} ${h}`);

    // Defs — arrowheads
    const defs = svg.append("defs");
    Object.entries(LINK_COLORS).forEach(([type, color]) => {
      defs
        .append("marker")
        .attr("id", `arrow-${type.replace(/\s/g, "")}`)
        .attr("viewBox", "0 0 10 6")
        .attr("refX", 20)
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
      })
    );

    // Build D3 data
    const nodeMap = new Map(nodes.map((n) => [n.id, { ...n }]));
    const linkData = edges
      .filter((e) => nodeMap.has(e.sourceID) && nodeMap.has(e.targetID) && e.sourceID !== e.targetID)
      .map((e) => ({
        source: e.sourceID,
        target: e.targetID,
        linkType: e.linkType,
      }));
    const nodeData = [...nodeMap.values()];

    // Degree for sizing
    const degree = new Map();
    for (const e of linkData) {
      degree.set(e.source, (degree.get(e.source) || 0) + 1);
      degree.set(e.target, (degree.get(e.target) || 0) + 1);
    }

    if (layout === "force") {
      renderForce(g, nodeData, linkData, degree, w, h);
    } else if (layout === "tree") {
      renderTree(g, nodeData, linkData, degree, w, h);
    } else {
      renderCircle(g, nodeData, linkData, degree, w, h);
    }

    function renderForce(g, nodeData, linkData, degree, w, h) {
      const sim = d3
        .forceSimulation(nodeData)
        .force(
          "link",
          d3.forceLink(linkData).id((d) => d.id).distance(80)
        )
        .force("charge", d3.forceManyBody().strength(-200))
        .force("center", d3.forceCenter(w / 2, h / 2))
        .force("collide", d3.forceCollide(20));

      simRef.current = sim;

      const link = g
        .append("g")
        .selectAll("line")
        .data(linkData)
        .join("line")
        .attr("stroke", (d) => LINK_COLORS[d.linkType] || "#555")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", (d) => LINK_DASH[d.linkType] || "")
        .attr("marker-end", (d) => `url(#arrow-${d.linkType.replace(/\s/g, "")})`);

      const node = g
        .append("g")
        .selectAll("circle")
        .data(nodeData)
        .join("circle")
        .attr("r", (d) => 4 + Math.min((degree.get(d.id) || 0), 20))
        .attr("fill", (d) => collectionColor(d.collectionIDs))
        .attr("stroke", (d) =>
          d.id === selectedNodeId ? "#fff" : "transparent"
        )
        .attr("stroke-width", 2)
        .attr("cursor", "pointer")
        .call(drag(sim))
        .on("click", (_e, d) => onNodeClick?.(d));

      // Tooltips
      node.append("title").text((d) => `${d.id}\n${d.documentTitle}`);

      sim.on("tick", () => {
        link
          .attr("x1", (d) => d.source.x)
          .attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x)
          .attr("y2", (d) => d.target.y);
        node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
      });
    }

    function renderTree(g, nodeData, linkData, degree, w, h) {
      // Find root: highest out-degree
      const outDeg = new Map();
      for (const e of linkData) outDeg.set(e.source, (outDeg.get(e.source) || 0) + 1);
      let root = nodeData[0]?.id;
      let maxDeg = 0;
      for (const [id, d] of outDeg) {
        if (d > maxDeg) { maxDeg = d; root = id; }
      }

      // BFS tree
      const children = new Map();
      const visited = new Set([root]);
      const queue = [root];
      while (queue.length) {
        const curr = queue.shift();
        const kids = linkData
          .filter((e) => e.source === curr && !visited.has(e.target))
          .map((e) => e.target);
        if (kids.length) children.set(curr, kids);
        for (const k of kids) {
          visited.add(k);
          queue.push(k);
        }
      }

      // Add unvisited nodes as children of root
      const unvisited = nodeData.filter((n) => !visited.has(n.id)).map((n) => n.id);
      if (unvisited.length) {
        const existing = children.get(root) || [];
        children.set(root, [...existing, ...unvisited]);
      }

      // Build hierarchy
      function buildHierarchy(id) {
        const kids = children.get(id) || [];
        return { id, children: kids.map(buildHierarchy) };
      }

      const hier = d3.hierarchy(buildHierarchy(root));
      const treeLayout = d3.tree().size([w - 100, h - 100]);
      treeLayout(hier);

      // Position map
      const posMap = new Map();
      hier.each((n) => posMap.set(n.data.id, { x: n.x + 50, y: n.y + 50 }));

      // Draw links (all original edges, not just tree edges)
      g.append("g")
        .selectAll("line")
        .data(linkData.filter((e) => posMap.has(e.source) && posMap.has(e.target)))
        .join("line")
        .attr("x1", (d) => posMap.get(d.source)?.x)
        .attr("y1", (d) => posMap.get(d.source)?.y)
        .attr("x2", (d) => posMap.get(d.target)?.x)
        .attr("y2", (d) => posMap.get(d.target)?.y)
        .attr("stroke", (d) => LINK_COLORS[d.linkType] || "#555")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", (d) => LINK_DASH[d.linkType] || "")
        .attr("opacity", 0.6);

      // Draw nodes
      const nodeGroup = g.append("g");
      const nodeMapLocal = new Map(nodeData.map((n) => [n.id, n]));

      hier.each((n) => {
        const data = nodeMapLocal.get(n.data.id) || { id: n.data.id };
        const pos = posMap.get(n.data.id);
        if (!pos) return;

        nodeGroup
          .append("circle")
          .datum(data)
          .attr("cx", pos.x)
          .attr("cy", pos.y)
          .attr("r", 4 + Math.min((degree.get(data.id) || 0), 20))
          .attr("fill", collectionColor(data.collectionIDs))
          .attr("stroke", data.id === selectedNodeId ? "#fff" : "transparent")
          .attr("stroke-width", 2)
          .attr("cursor", "pointer")
          .on("click", (_e, d) => onNodeClick?.(d))
          .append("title")
          .text(`${data.id}\n${data.documentTitle || ""}`);
      });
    }

    function renderCircle(g, nodeData, linkData, degree, w, h) {
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) / 2 - 60;

      // Place nodes on circle
      nodeData.forEach((n, i) => {
        const angle = (2 * Math.PI * i) / nodeData.length - Math.PI / 2;
        n.fx = cx + r * Math.cos(angle);
        n.fy = cy + r * Math.sin(angle);
        n.x = n.fx;
        n.y = n.fy;
      });

      const posMap = new Map(nodeData.map((n) => [n.id, { x: n.x, y: n.y }]));

      // Draw edges as curves
      g.append("g")
        .selectAll("path")
        .data(linkData.filter((e) => posMap.has(e.source) && posMap.has(e.target)))
        .join("path")
        .attr("d", (d) => {
          const s = posMap.get(d.source);
          const t = posMap.get(d.target);
          const midX = (s.x + t.x) / 2;
          const midY = (s.y + t.y) / 2;
          // Pull toward center for curve
          const pullX = midX + (cx - midX) * 0.3;
          const pullY = midY + (cy - midY) * 0.3;
          return `M${s.x},${s.y} Q${pullX},${pullY} ${t.x},${t.y}`;
        })
        .attr("fill", "none")
        .attr("stroke", (d) => LINK_COLORS[d.linkType] || "#555")
        .attr("stroke-width", 1.2)
        .attr("stroke-dasharray", (d) => LINK_DASH[d.linkType] || "")
        .attr("opacity", 0.5);

      // Draw nodes
      g.append("g")
        .selectAll("circle")
        .data(nodeData)
        .join("circle")
        .attr("cx", (d) => d.x)
        .attr("cy", (d) => d.y)
        .attr("r", (d) => 4 + Math.min((degree.get(d.id) || 0), 20))
        .attr("fill", (d) => collectionColor(d.collectionIDs))
        .attr("stroke", (d) => (d.id === selectedNodeId ? "#fff" : "transparent"))
        .attr("stroke-width", 2)
        .attr("cursor", "pointer")
        .on("click", (_e, d) => onNodeClick?.(d))
        .append("title")
        .text((d) => `${d.id}\n${d.documentTitle || ""}`);
    }

    function drag(sim) {
      return d3
        .drag()
        .on("start", (event, d) => {
          if (!event.active) sim.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) sim.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        });
    }
  }, [nodes, edges, layout, selectedNodeId, width, height, onNodeClick]);

  useEffect(() => {
    render();
    return () => {
      if (simRef.current) simRef.current.stop();
    };
  }, [render]);

  return (
    <svg
      ref={svgRef}
      className="w-full bg-gray-900 rounded border border-gray-800"
      style={{ height }}
    />
  );
}
