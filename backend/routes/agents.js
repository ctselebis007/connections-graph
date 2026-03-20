import { Router } from "express";
import { getDb } from "../services/mongo.js";
import { graphLookupA, graphLookupB } from "../services/graph.js";
import { vectorSearch, lexicalSearch } from "../services/search.js";

const router = Router();

/* ------------------------------------------------------------------ */
/*  POST /api/agents/natural-language                                  */
/* ------------------------------------------------------------------ */
router.post("/natural-language", async (req, res) => {
  try {
    const { query } = req.body;
    // For now, delegate to hybrid-style search
    const { results } = await lexicalSearch({ query, source: "documents" });
    res.json({
      agent: "natural-language",
      input: query,
      results,
      explanation: `Found ${results.length} documents matching your query using lexical search.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /api/agents/document-impact                                   */
/* ------------------------------------------------------------------ */
router.post("/document-impact", async (req, res) => {
  try {
    const { nodeId, depth = 3 } = req.body;
    const graph = await graphLookupB({ nodeId, depth });

    // Also check incoming edges
    const db = getDb();
    const incoming = await db
      .collection("graph_edges")
      .find({ targetID: nodeId })
      .toArray();

    const incomingNodes = incoming.map((e) => e.sourceID);
    const incomingDocs = await db
      .collection("graph_nodes")
      .find({ _id: { $in: incomingNodes } })
      .toArray();

    res.json({
      agent: "document-impact",
      input: { nodeId, depth },
      outgoing: graph,
      incoming: {
        edges: incoming.map((e) => ({
          sourceID: e.sourceID,
          targetID: e.targetID,
          linkType: e.linkType,
        })),
        nodes: incomingDocs.map((n) => ({
          id: n._id,
          documentTitle: n.documentTitle,
        })),
      },
      explanation: `Document ${nodeId} has ${graph.edges.length} outgoing connections (${graph.nodes.length} nodes reachable within ${depth} hops) and ${incoming.length} incoming references.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /api/agents/cross-reference-analyzer                          */
/* ------------------------------------------------------------------ */
router.post("/cross-reference-analyzer", async (req, res) => {
  try {
    const db = getDb();
    const edges = db.collection("graph_edges");

    // Hub analysis — nodes with most outgoing connections
    const hubs = await edges
      .aggregate([
        { $group: { _id: "$sourceID", outDegree: { $sum: 1 } } },
        { $sort: { outDegree: -1 } },
        { $limit: 10 },
      ])
      .toArray();

    // Nodes with most incoming
    const targets = await edges
      .aggregate([
        { $group: { _id: "$targetID", inDegree: { $sum: 1 } } },
        { $sort: { inDegree: -1 } },
        { $limit: 10 },
      ])
      .toArray();

    // Link type distribution
    const linkDist = await edges
      .aggregate([
        { $group: { _id: "$linkType", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();

    // Bidirectional links
    const bidir = await edges
      .aggregate([
        {
          $lookup: {
            from: "graph_edges",
            let: { src: "$sourceID", tgt: "$targetID" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$sourceID", "$$tgt"] },
                      { $eq: ["$targetID", "$$src"] },
                    ],
                  },
                },
              },
            ],
            as: "reverse",
          },
        },
        { $match: { reverse: { $ne: [] } } },
        { $project: { sourceID: 1, targetID: 1, linkType: 1, _id: 0 } },
        { $limit: 20 },
      ])
      .toArray();

    // Orphan nodes (no outgoing and no incoming)
    const allNodes = await db.collection("graph_nodes").find({}, { projection: { _id: 1 } }).toArray();
    const nodeIds = new Set(allNodes.map((n) => n._id));
    const connectedSources = new Set((await edges.distinct("sourceID")));
    const connectedTargets = new Set((await edges.distinct("targetID")));
    const orphans = [...nodeIds].filter(
      (id) => !connectedSources.has(id) && !connectedTargets.has(id)
    );

    res.json({
      agent: "cross-reference-analyzer",
      hubs,
      topTargets: targets,
      linkTypeDistribution: linkDist,
      bidirectionalLinks: bidir,
      orphanNodes: orphans,
      explanation: `Analyzed ${linkDist.reduce((s, l) => s + l.count, 0)} edges. Top hub: ${hubs[0]?._id} (${hubs[0]?.outDegree} outgoing). ${orphans.length} orphan nodes found. ${bidir.length} bidirectional link pairs.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /api/agents/collection-explorer                               */
/* ------------------------------------------------------------------ */
router.post("/collection-explorer", async (req, res) => {
  try {
    const { collectionId } = req.body;
    const db = getDb();

    const nodes = await db
      .collection("graph_nodes")
      .find({ collectionIDs: collectionId }, { projection: { embedding: 0 } })
      .toArray();

    const nodeIds = nodes.map((n) => n._id);
    const edges = await db
      .collection("graph_edges")
      .find({ sourceID: { $in: nodeIds }, targetID: { $in: nodeIds } })
      .toArray();

    res.json({
      agent: "collection-explorer",
      input: { collectionId },
      nodes: nodes.map((n) => ({
        id: n._id,
        documentTitle: n.documentTitle,
        collectionIDs: n.collectionIDs,
        metadata: n.metadata,
      })),
      edges: edges.map((e) => ({
        sourceID: e.sourceID,
        targetID: e.targetID,
        linkType: e.linkType,
      })),
      explanation: `Collection ${collectionId} contains ${nodes.length} documents with ${edges.length} internal connections.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /api/agents/similarity-finder                                 */
/* ------------------------------------------------------------------ */
router.post("/similarity-finder", async (req, res) => {
  try {
    const { query, nodeId } = req.body;

    let searchText = query;
    if (!searchText && nodeId) {
      const db = getDb();
      const doc = await db.collection("graph_nodes").findOne({ _id: nodeId });
      if (doc) {
        const parts = [doc.documentTitle || ""];
        const m = doc.metadata || {};
        if (m.searchtopic) parts.push(m.searchtopic);
        if (m.contentcategory) parts.push(m.contentcategory);
        searchText = parts.filter(Boolean).join(" | ");
      }
    }

    if (!searchText) {
      return res.status(400).json({ error: "Provide query text or nodeId" });
    }

    const { results } = await vectorSearch({
      query: searchText,
      source: "graph",
    });

    res.json({
      agent: "similarity-finder",
      input: { query: searchText, nodeId },
      results: results.map((r) => ({
        id: r._id,
        documentTitle: r.documentTitle,
        score: r.score,
        metadata: r.metadata,
      })),
      explanation: `Found ${results.length} semantically similar documents.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /api/agents/critical-node                                     */
/* ------------------------------------------------------------------ */
router.post("/critical-node", async (req, res) => {
  try {
    const { topN = 15 } = req.body;
    const db = getDb();
    const edgesColl = db.collection("graph_edges");
    const nodesColl = db.collection("graph_nodes");

    // 1. Compute outDegree per node
    const outDegrees = await edgesColl
      .aggregate([
        { $group: { _id: "$sourceID", outDegree: { $sum: 1 } } },
      ])
      .toArray();

    // 2. Compute inDegree per node
    const inDegrees = await edgesColl
      .aggregate([
        { $group: { _id: "$targetID", inDegree: { $sum: 1 } } },
      ])
      .toArray();

    // 3. Count unique link types per node (diversity)
    const linkDiversity = await edgesColl
      .aggregate([
        {
          $group: {
            _id: "$sourceID",
            linkTypes: { $addToSet: "$linkType" },
          },
        },
        { $addFields: { linkTypeCount: { $size: "$linkTypes" } } },
      ])
      .toArray();

    // 4. Cross-collection bridge count per node
    const bridges = await edgesColl
      .aggregate([
        {
          $lookup: {
            from: "graph_nodes",
            localField: "sourceID",
            foreignField: "_id",
            as: "srcNode",
          },
        },
        {
          $lookup: {
            from: "graph_nodes",
            localField: "targetID",
            foreignField: "_id",
            as: "tgtNode",
          },
        },
        { $unwind: "$srcNode" },
        { $unwind: "$tgtNode" },
        {
          $match: {
            $expr: {
              $ne: [
                { $arrayElemAt: ["$srcNode.collectionIDs", 0] },
                { $arrayElemAt: ["$tgtNode.collectionIDs", 0] },
              ],
            },
          },
        },
        { $group: { _id: "$sourceID", bridgeCount: { $sum: 1 } } },
      ])
      .toArray();

    // 5. Merge all metrics into a single map
    const metrics = new Map();
    const ensure = (id) => {
      if (!metrics.has(id)) {
        metrics.set(id, {
          id,
          inDegree: 0,
          outDegree: 0,
          totalDegree: 0,
          linkTypeCount: 0,
          bridgeCount: 0,
          criticalityScore: 0,
        });
      }
      return metrics.get(id);
    };

    for (const r of outDegrees) {
      ensure(r._id).outDegree = r.outDegree;
    }
    for (const r of inDegrees) {
      ensure(r._id).inDegree = r.inDegree;
    }
    for (const r of linkDiversity) {
      ensure(r._id).linkTypeCount = r.linkTypeCount;
    }
    for (const r of bridges) {
      ensure(r._id).bridgeCount = r.bridgeCount;
    }

    // 6. Compute criticality score
    // Formula: totalDegree * 1.0 + bridgeCount * 2.0 + linkTypeCount * 0.5
    // Bridge edges are weighted higher because cross-collection connectors
    // are structural bottlenecks.
    for (const m of metrics.values()) {
      m.totalDegree = m.inDegree + m.outDegree;
      m.criticalityScore =
        m.totalDegree * 1.0 + m.bridgeCount * 2.0 + m.linkTypeCount * 0.5;
    }

    // 7. Rank and take top N
    const ranked = [...metrics.values()]
      .sort((a, b) => b.criticalityScore - a.criticalityScore)
      .slice(0, topN);

    // 8. Fetch document details for the top nodes
    const topIds = ranked.map((r) => r.id);
    const docs = await nodesColl
      .find({ _id: { $in: topIds } }, { projection: { embedding: 0 } })
      .toArray();
    const docMap = new Map(docs.map((d) => [d._id, d]));

    const results = ranked.map((r) => {
      const doc = docMap.get(r.id) || {};
      return {
        ...r,
        documentTitle: doc.documentTitle || "—",
        collectionIDs: doc.collectionIDs || [],
        metadata: {
          focus: doc.metadata?.focus,
          serviceline: doc.metadata?.serviceline,
          contentcategory: doc.metadata?.contentcategory,
        },
      };
    });

    // 9. Build the subgraph of edges among top nodes for visualization
    const topIdSet = new Set(topIds);
    const subEdges = await edgesColl
      .find(
        { sourceID: { $in: topIds }, targetID: { $in: topIds } },
        { projection: { _id: 0, sourceID: 1, targetID: 1, linkType: 1 } }
      )
      .toArray();

    const graphNodes = results.map((r) => ({
      id: r.id,
      documentTitle: r.documentTitle,
      collectionIDs: r.collectionIDs,
    }));

    const totalNodes = await nodesColl.countDocuments();
    const totalEdges = await edgesColl.countDocuments();

    res.json({
      agent: "critical-node",
      results,
      nodes: graphNodes,
      edges: subEdges,
      summary: {
        totalNodes,
        totalEdges,
        analyzedNodes: metrics.size,
      },
      explanation: `Analyzed ${metrics.size} nodes across ${totalEdges} edges. Top critical node: ${results[0]?.id} "${results[0]?.documentTitle}" (score: ${results[0]?.criticalityScore.toFixed(1)}, degree: ${results[0]?.totalDegree}, bridges: ${results[0]?.bridgeCount}). Scoring: totalDegree×1 + bridgeCount×2 + linkTypeCount×0.5.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /api/agents/stale-document-detector                           */
/* ------------------------------------------------------------------ */
router.post("/stale-document-detector", async (req, res) => {
  try {
    const { cutoffDate } = req.body;
    const db = getDb();
    const nodesColl = db.collection("graph_nodes");
    const edgesColl = db.collection("graph_edges");

    // Default cutoff: 2 years ago
    const cutoff = cutoffDate
      ? cutoffDate
      : new Date(Date.now() - 2 * 365.25 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];

    // 1. Find released docs with old dates
    const staleDocs = await nodesColl
      .find(
        {
          "metadata.versionstatus": "Released",
          $or: [
            { "metadata.versiondate": { $lt: cutoff } },
            { "metadata.effectivedate": { $lt: cutoff } },
          ],
        },
        { projection: { embedding: 0 } }
      )
      .toArray();

    const staleIds = staleDocs.map((d) => d._id);

    // 2. Compute inbound edge counts for stale docs
    const inboundCounts = await edgesColl
      .aggregate([
        { $match: { targetID: { $in: staleIds } } },
        { $group: { _id: "$targetID", inboundCount: { $sum: 1 } } },
      ])
      .toArray();
    const inboundMap = new Map(inboundCounts.map((r) => [r._id, r.inboundCount]));

    // 3. Build results with risk scoring
    const results = staleDocs
      .map((doc) => {
        const inbound = inboundMap.get(doc._id) || 0;
        const versionDate = (doc.metadata?.versiondate || "").slice(0, 10);
        const effectiveDate = (doc.metadata?.effectivedate || "").slice(0, 10);
        const oldestDate = versionDate < effectiveDate ? versionDate : effectiveDate;

        // Days since cutoff (how far past the threshold)
        const daysPastCutoff = Math.max(
          0,
          Math.floor((new Date(cutoff) - new Date(oldestDate)) / (24 * 60 * 60 * 1000))
        );

        // Risk score: inbound references × age factor
        const riskScore = inbound * (1 + daysPastCutoff / 365);

        return {
          id: doc._id,
          documentTitle: doc.documentTitle || "—",
          versionDate,
          effectiveDate,
          versionStatus: doc.metadata?.versionstatus,
          inboundReferences: inbound,
          daysPastCutoff,
          riskScore: Math.round(riskScore * 10) / 10,
          collectionIDs: doc.collectionIDs || [],
          metadata: {
            focus: doc.metadata?.focus,
            serviceline: doc.metadata?.serviceline,
            contentcategory: doc.metadata?.contentcategory,
          },
        };
      })
      .sort((a, b) => b.riskScore - a.riskScore);

    // 4. Get edges among stale docs for graph viz
    const highRiskIds = results.slice(0, 20).map((r) => r.id);
    const subEdges = await edgesColl
      .find(
        { sourceID: { $in: highRiskIds }, targetID: { $in: highRiskIds } },
        { projection: { _id: 0, sourceID: 1, targetID: 1, linkType: 1 } }
      )
      .toArray();

    const graphNodes = results.slice(0, 20).map((r) => ({
      id: r.id,
      documentTitle: r.documentTitle,
      collectionIDs: r.collectionIDs,
    }));

    const withInbound = results.filter((r) => r.inboundReferences > 0);

    res.json({
      agent: "stale-document-detector",
      input: { cutoffDate: cutoff },
      results,
      nodes: graphNodes,
      edges: subEdges,
      summary: {
        totalStale: staleDocs.length,
        withInboundRefs: withInbound.length,
        highestRisk: results[0]?.id,
      },
      explanation: `Found ${staleDocs.length} released documents older than ${cutoff}. ${withInbound.length} of them have inbound references (compliance risk). Highest risk: ${results[0]?.id} "${results[0]?.documentTitle}" (risk score: ${results[0]?.riskScore}, ${results[0]?.inboundReferences} inbound refs, ${results[0]?.daysPastCutoff} days past cutoff).`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
