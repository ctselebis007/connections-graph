import { getDb } from "./mongo.js";

/* ------------------------------------------------------------------ */
/*  Graph traversal — Approach A ($graphLookup on documents)           */
/* ------------------------------------------------------------------ */

export async function graphLookupA({ nodeId, depth = 5, linkTypes }) {
  const db = getDb();
  const coll = db.collection("documents");

  const pipeline = [
    { $match: { _id: nodeId } },
    {
      $graphLookup: {
        from: "documents",
        startWith: "$connections.targetID",
        connectFromField: "connections.targetID",
        connectToField: "_id",
        as: "related",
        maxDepth: depth - 1,
        depthField: "depth",
      },
    },
  ];

  const [result] = await coll.aggregate(pipeline).toArray();
  if (!result) return { nodes: [], edges: [] };

  // Build node list (root + related)
  const nodesMap = new Map();
  const addNode = (doc) => {
    if (!nodesMap.has(doc._id)) {
      nodesMap.set(doc._id, {
        id: doc._id,
        documentTitle: doc.documentTitle || "",
        collectionIDs: doc.collectionIDs || [],
        channelIDs: doc.channelIDs || [],
        metadata: doc.metadata || {},
        connectionCount: (doc.connections || []).length,
      });
    }
  };

  addNode(result);
  for (const rel of result.related || []) {
    addNode(rel);
  }

  // Build edges from all discovered nodes
  const edges = [];
  const edgeSet = new Set();
  const allDocs = [result, ...(result.related || [])];
  for (const doc of allDocs) {
    for (const conn of doc.connections || []) {
      if (nodesMap.has(conn.targetID)) {
        const key = `${doc._id}->${conn.targetID}|${conn.linkType}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          if (!linkTypes || linkTypes.includes(conn.linkType)) {
            edges.push({
              sourceID: doc._id,
              targetID: conn.targetID,
              linkType: conn.linkType,
            });
          }
        }
      }
    }
  }

  return { nodes: [...nodesMap.values()], edges };
}

/* ------------------------------------------------------------------ */
/*  Graph traversal — Approach B (graph_nodes + graph_edges)           */
/* ------------------------------------------------------------------ */

export async function graphLookupB({ nodeId, depth = 5, linkTypes }) {
  const db = getDb();
  const nodesColl = db.collection("graph_nodes");
  const edgesColl = db.collection("graph_edges");

  // BFS traversal
  const visited = new Set([nodeId]);
  let frontier = [nodeId];

  const allEdges = [];

  for (let d = 0; d < depth && frontier.length > 0; d++) {
    const edgeFilter = { sourceID: { $in: frontier } };
    if (linkTypes && linkTypes.length) {
      edgeFilter.linkType = { $in: linkTypes };
    }

    const edges = await edgesColl.find(edgeFilter).toArray();
    const nextFrontier = [];

    for (const e of edges) {
      allEdges.push({
        sourceID: e.sourceID,
        targetID: e.targetID,
        linkType: e.linkType,
      });
      if (!visited.has(e.targetID)) {
        visited.add(e.targetID);
        nextFrontier.push(e.targetID);
      }
    }

    frontier = nextFrontier;
  }

  // Fetch node details
  const nodeDocs = await nodesColl
    .find({ _id: { $in: [...visited] } })
    .toArray();

  const nodes = nodeDocs.map((n) => ({
    id: n._id,
    documentTitle: n.documentTitle || "",
    collectionIDs: n.collectionIDs || [],
    channelIDs: n.channelIDs || [],
    metadata: n.metadata || {},
  }));

  // Dedupe edges
  const edgeSet = new Set();
  const uniqueEdges = [];
  for (const e of allEdges) {
    const key = `${e.sourceID}->${e.targetID}|${e.linkType}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      uniqueEdges.push(e);
    }
  }

  return { nodes, edges: uniqueEdges };
}

/* ------------------------------------------------------------------ */
/*  Full graph (all nodes + edges) for initial visualization           */
/* ------------------------------------------------------------------ */

export async function getFullGraph(source) {
  const db = getDb();

  if (source === "graph") {
    const nodes = await db.collection("graph_nodes")
      .find({}, { projection: { embedding: 0 } })
      .toArray();
    const edges = await db.collection("graph_edges")
      .find({}, { projection: { _id: 0, sourceID: 1, targetID: 1, linkType: 1 } })
      .toArray();

    return {
      nodes: nodes.map((n) => ({
        id: n._id,
        documentTitle: n.documentTitle || "",
        collectionIDs: n.collectionIDs || [],
        channelIDs: n.channelIDs || [],
        metadata: n.metadata || {},
      })),
      edges,
    };
  }

  // Approach A — extract from documents collection
  const docs = await db.collection("documents")
    .find({}, { projection: { embedding: 0 } })
    .toArray();

  const nodes = docs.map((d) => ({
    id: d._id,
    documentTitle: d.documentTitle || "",
    collectionIDs: d.collectionIDs || [],
    channelIDs: d.channelIDs || [],
    metadata: d.metadata || {},
    connectionCount: (d.connections || []).length,
  }));

  const edgeSet = new Set();
  const edges = [];
  for (const d of docs) {
    for (const c of d.connections || []) {
      const key = `${d._id}->${c.targetID}|${c.linkType}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ sourceID: d._id, targetID: c.targetID, linkType: c.linkType });
      }
    }
  }

  return { nodes, edges };
}
