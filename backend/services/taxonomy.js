import { getDb } from "./mongo.js";

/* ------------------------------------------------------------------ */
/*  Read helpers                                                       */
/* ------------------------------------------------------------------ */

/**
 * Return the list of distinct taxonomy sets.
 */
export async function getTaxonomySets() {
  const db = getDb();
  const sets = await db.collection("taxonomy_nodes").distinct("taxonomySet");
  return sets.filter(Boolean);
}

/**
 * Return the full taxonomy as a nested tree structure.
 */
export async function getTree(taxonomySet) {
  const db = getDb();
  const filter = taxonomySet ? { taxonomySet } : {};
  const edgeFilter = taxonomySet ? { relationshipType: "parent-child", taxonomySet } : { relationshipType: "parent-child" };
  const nodes = await db.collection("taxonomy_nodes").find(filter).sort({ level: 1, label: 1 }).toArray();
  const edges = await db.collection("taxonomy_edges").find(edgeFilter).toArray();

  // Build adjacency map: parentId -> children
  const childrenMap = new Map();
  for (const e of edges) {
    if (!childrenMap.has(e.sourceID)) childrenMap.set(e.sourceID, []);
    childrenMap.get(e.sourceID).push(e.targetID);
  }

  // Build node lookup
  const nodeMap = new Map();
  for (const n of nodes) nodeMap.set(n._id, { ...n, children: [] });

  // Wire children
  for (const [parentId, childIds] of childrenMap) {
    const parent = nodeMap.get(parentId);
    if (!parent) continue;
    for (const cid of childIds) {
      const child = nodeMap.get(cid);
      if (child) parent.children.push(child);
    }
  }

  // Roots are nodes with level 0 or no incoming parent-child edge
  const childIds = new Set(edges.map((e) => e.targetID));
  const roots = nodes.filter((n) => !childIds.has(n._id)).map((n) => nodeMap.get(n._id));

  return roots;
}

/**
 * Return flat list of all taxonomy nodes.
 */
export async function getAllNodes(taxonomySet) {
  const db = getDb();
  const filter = taxonomySet ? { taxonomySet } : {};
  return db.collection("taxonomy_nodes").find(filter).sort({ level: 1, label: 1 }).toArray();
}

/**
 * Return a single node with its parent and direct children.
 */
export async function getNode(id) {
  const db = getDb();
  const node = await db.collection("taxonomy_nodes").findOne({ _id: id });
  if (!node) return null;

  const edges = await db.collection("taxonomy_edges").find({
    relationshipType: "parent-child",
    $or: [{ sourceID: id }, { targetID: id }],
  }).toArray();

  const parentEdge = edges.find((e) => e.targetID === id);
  const childEdges = edges.filter((e) => e.sourceID === id);

  let parent = null;
  if (parentEdge) {
    parent = await db.collection("taxonomy_nodes").findOne({ _id: parentEdge.sourceID });
  }

  const childIds = childEdges.map((e) => e.targetID);
  const children = childIds.length
    ? await db.collection("taxonomy_nodes").find({ _id: { $in: childIds } }).sort({ label: 1 }).toArray()
    : [];

  return { ...node, parent, children };
}

/* ------------------------------------------------------------------ */
/*  Descendant query (for search expansion)                            */
/* ------------------------------------------------------------------ */

/**
 * Get all descendant node IDs and labels for a concept (recursive).
 */
export async function getDescendants(conceptId) {
  const db = getDb();
  const results = await db.collection("taxonomy_nodes").aggregate([
    { $match: { _id: conceptId } },
    {
      $graphLookup: {
        from: "taxonomy_edges",
        startWith: "$_id",
        connectFromField: "targetID",
        connectToField: "sourceID",
        as: "descendant_edges",
        restrictSearchWithMatch: { relationshipType: "parent-child" },
      },
    },
    { $unwind: "$descendant_edges" },
    {
      $lookup: {
        from: "taxonomy_nodes",
        localField: "descendant_edges.targetID",
        foreignField: "_id",
        as: "descendant_node",
      },
    },
    { $unwind: "$descendant_node" },
    { $replaceRoot: { newRoot: "$descendant_node" } },
  ]).toArray();

  return results;
}

/**
 * Simpler BFS-based descendant lookup (more reliable than $graphLookup on edges).
 */
export async function getDescendantsBFS(conceptId) {
  const db = getDb();
  const edgesColl = db.collection("taxonomy_edges");
  const nodesColl = db.collection("taxonomy_nodes");

  const visited = new Set();
  const queue = [conceptId];
  const descendantIds = [];

  while (queue.length > 0) {
    const current = queue.shift();
    const childEdges = await edgesColl.find({
      sourceID: current,
      relationshipType: "parent-child",
    }).toArray();

    for (const e of childEdges) {
      if (!visited.has(e.targetID)) {
        visited.add(e.targetID);
        descendantIds.push(e.targetID);
        queue.push(e.targetID);
      }
    }
  }

  if (descendantIds.length === 0) return [];

  return nodesColl.find({ _id: { $in: descendantIds } }).toArray();
}

/* ------------------------------------------------------------------ */
/*  CRUD                                                               */
/* ------------------------------------------------------------------ */

/**
 * Create a new taxonomy node and optionally link it to a parent.
 */
export async function createNode({ _id, label, description, type, parentId, properties, taxonomySet }) {
  const db = getDb();
  const nodesColl = db.collection("taxonomy_nodes");
  const edgesColl = db.collection("taxonomy_edges");

  // Determine level and path
  let level = 0;
  let path = [_id];
  let resolvedSet = taxonomySet;
  if (parentId) {
    const parent = await nodesColl.findOne({ _id: parentId });
    if (!parent) throw new Error(`Parent node '${parentId}' not found`);
    level = (parent.level || 0) + 1;
    path = [...(parent.path || [parent._id]), _id];
    if (!resolvedSet) resolvedSet = parent.taxonomySet;
  }

  const node = {
    _id,
    label,
    description: description || "",
    type: type || "concept",
    level,
    path,
    taxonomySet: resolvedSet || null,
    properties: properties || {},
    metadata: {
      source: "manual",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  await nodesColl.insertOne(node);

  if (parentId) {
    await edgesColl.insertOne({
      sourceID: parentId,
      targetID: _id,
      relationshipType: "parent-child",
      taxonomySet: resolvedSet || null,
      metadata: { createdAt: new Date() },
    });
  }

  return node;
}

/**
 * Update a taxonomy node's label, description, type, or properties.
 */
export async function updateNode(id, updates) {
  const db = getDb();
  const allowed = {};
  if (updates.label !== undefined) allowed.label = updates.label;
  if (updates.description !== undefined) allowed.description = updates.description;
  if (updates.type !== undefined) allowed.type = updates.type;
  if (updates.properties !== undefined) allowed.properties = updates.properties;
  allowed["metadata.updatedAt"] = new Date();

  const result = await db.collection("taxonomy_nodes").findOneAndUpdate(
    { _id: id },
    { $set: allowed },
    { returnDocument: "after" },
  );
  return result;
}

/**
 * Delete a taxonomy node. Mode: "reparent" moves children to grandparent,
 * "cascade" deletes entire subtree.
 */
export async function deleteNode(id, mode = "reparent") {
  const db = getDb();
  const nodesColl = db.collection("taxonomy_nodes");
  const edgesColl = db.collection("taxonomy_edges");

  // Find parent edge
  const parentEdge = await edgesColl.findOne({ targetID: id, relationshipType: "parent-child" });
  const parentId = parentEdge?.sourceID || null;

  // Find children
  const childEdges = await edgesColl.find({ sourceID: id, relationshipType: "parent-child" }).toArray();
  const childIds = childEdges.map((e) => e.targetID);

  if (mode === "cascade") {
    // Recursively collect all descendants
    const allIds = [id];
    const queue = [id];
    while (queue.length > 0) {
      const cur = queue.shift();
      const edges = await edgesColl.find({ sourceID: cur, relationshipType: "parent-child" }).toArray();
      for (const e of edges) {
        allIds.push(e.targetID);
        queue.push(e.targetID);
      }
    }

    await nodesColl.deleteMany({ _id: { $in: allIds } });
    await edgesColl.deleteMany({
      $or: [{ sourceID: { $in: allIds } }, { targetID: { $in: allIds } }],
    });

    // Remove conceptIDs references from documents
    await db.collection("documents").updateMany(
      { conceptIDs: { $in: allIds } },
      { $pullAll: { conceptIDs: allIds } },
    );
    await db.collection("graph_nodes").updateMany(
      { conceptIDs: { $in: allIds } },
      { $pullAll: { conceptIDs: allIds } },
    );

    return { deleted: allIds.length, mode: "cascade" };
  }

  // Reparent mode: move children to grandparent
  if (childIds.length > 0 && parentId) {
    // Point children's parent edges to grandparent
    for (const cid of childIds) {
      await edgesColl.updateOne(
        { sourceID: id, targetID: cid, relationshipType: "parent-child" },
        { $set: { sourceID: parentId } },
      );
    }

    // Recalculate path/level for reparented children
    const grandparent = await nodesColl.findOne({ _id: parentId });
    const newBasePath = grandparent?.path || [parentId];
    for (const cid of childIds) {
      await recalcSubtree(cid, newBasePath, (grandparent?.level || 0) + 1);
    }
  } else if (childIds.length > 0) {
    // No grandparent — children become roots
    await edgesColl.deleteMany({ sourceID: id, relationshipType: "parent-child" });
    for (const cid of childIds) {
      await recalcSubtree(cid, [], 0);
    }
  }

  // Remove the node itself and its parent edge
  await nodesColl.deleteOne({ _id: id });
  await edgesColl.deleteMany({
    $or: [{ sourceID: id }, { targetID: id }],
  });

  // Remove conceptIDs references from documents
  await db.collection("documents").updateMany(
    { conceptIDs: id },
    { $pull: { conceptIDs: id } },
  );
  await db.collection("graph_nodes").updateMany(
    { conceptIDs: id },
    { $pull: { conceptIDs: id } },
  );

  return { deleted: 1, reparented: childIds.length, mode: "reparent" };
}

/**
 * Move a node to a new parent.
 */
export async function moveNode(id, newParentId) {
  const db = getDb();
  const nodesColl = db.collection("taxonomy_nodes");
  const edgesColl = db.collection("taxonomy_edges");

  // Validate new parent exists
  const newParent = await nodesColl.findOne({ _id: newParentId });
  if (!newParent) throw new Error(`New parent '${newParentId}' not found`);

  // Prevent moving a node under its own descendant (would create cycle)
  const descendants = await getDescendantsBFS(id);
  if (descendants.some((d) => d._id === newParentId)) {
    throw new Error("Cannot move a node under its own descendant");
  }

  // Remove old parent edge
  await edgesColl.deleteOne({ targetID: id, relationshipType: "parent-child" });

  // Create new parent edge
  await edgesColl.insertOne({
    sourceID: newParentId,
    targetID: id,
    relationshipType: "parent-child",
    metadata: { createdAt: new Date() },
  });

  // Recalculate path/level for node and subtree
  const newBasePath = [...(newParent.path || [newParentId])];
  await recalcSubtree(id, newBasePath, (newParent.level || 0) + 1);

  return { success: true };
}

/**
 * Recursively recalculate path and level for a node and its subtree.
 */
async function recalcSubtree(nodeId, parentPath, level) {
  const db = getDb();
  const nodesColl = db.collection("taxonomy_nodes");
  const edgesColl = db.collection("taxonomy_edges");

  const path = [...parentPath, nodeId];
  await nodesColl.updateOne({ _id: nodeId }, { $set: { path, level, "metadata.updatedAt": new Date() } });

  const childEdges = await edgesColl.find({ sourceID: nodeId, relationshipType: "parent-child" }).toArray();
  for (const e of childEdges) {
    await recalcSubtree(e.targetID, path, level + 1);
  }
}

/* ------------------------------------------------------------------ */
/*  Document tagging                                                   */
/* ------------------------------------------------------------------ */

/**
 * Tag documents with concept IDs.
 */
export async function tagDocuments(documentIds, conceptIds) {
  const db = getDb();

  const result = { documents: 0, graph_nodes: 0 };

  const updateOp = { $addToSet: { conceptIDs: { $each: conceptIds } } };
  const filter = { _id: { $in: documentIds } };

  const r1 = await db.collection("documents").updateMany(filter, updateOp);
  result.documents = r1.modifiedCount;

  const r2 = await db.collection("graph_nodes").updateMany(filter, updateOp);
  result.graph_nodes = r2.modifiedCount;

  return result;
}

/**
 * Remove concept tags from documents.
 */
export async function untagDocuments(documentIds, conceptIds) {
  const db = getDb();

  const result = { documents: 0, graph_nodes: 0 };

  const updateOp = { $pullAll: { conceptIDs: conceptIds } };
  const filter = { _id: { $in: documentIds } };

  const r1 = await db.collection("documents").updateMany(filter, updateOp);
  result.documents = r1.modifiedCount;

  const r2 = await db.collection("graph_nodes").updateMany(filter, updateOp);
  result.graph_nodes = r2.modifiedCount;

  return result;
}

/**
 * Get documents tagged with a specific concept.
 */
export async function getDocumentsByConcept(conceptId) {
  const db = getDb();
  return db.collection("graph_nodes").find({ conceptIDs: conceptId }).toArray();
}

/* ------------------------------------------------------------------ */
/*  Ontology relationships (Phase 2)                                   */
/* ------------------------------------------------------------------ */

const ONTOLOGY_RELATIONSHIP_TYPES = [
  "parent-child", "is-a", "part-of", "applies-to", "supersedes", "governed-by",
  "references", "records", "authorizes", "governs", "validates",
];

/**
 * Create a typed ontology relationship between two concepts.
 */
export async function createRelationship({ sourceID, targetID, relationshipType }) {
  const db = getDb();
  if (!ONTOLOGY_RELATIONSHIP_TYPES.includes(relationshipType)) {
    throw new Error(`Invalid relationship type '${relationshipType}'. Valid types: ${ONTOLOGY_RELATIONSHIP_TYPES.join(", ")}`);
  }

  // Verify both nodes exist
  const nodesColl = db.collection("taxonomy_nodes");
  const src = await nodesColl.findOne({ _id: sourceID });
  const tgt = await nodesColl.findOne({ _id: targetID });
  if (!src) throw new Error(`Source node '${sourceID}' not found`);
  if (!tgt) throw new Error(`Target node '${targetID}' not found`);

  // Prevent duplicate
  const existing = await db.collection("taxonomy_edges").findOne({ sourceID, targetID, relationshipType });
  if (existing) throw new Error(`Relationship '${relationshipType}' from '${sourceID}' to '${targetID}' already exists`);

  const edge = {
    sourceID,
    targetID,
    relationshipType,
    taxonomySet: src.taxonomySet || null,
    metadata: { createdAt: new Date() },
  };

  await db.collection("taxonomy_edges").insertOne(edge);
  return edge;
}

/**
 * Delete a specific ontology relationship.
 */
export async function deleteRelationship(sourceID, targetID, relationshipType) {
  const db = getDb();
  const result = await db.collection("taxonomy_edges").deleteOne({ sourceID, targetID, relationshipType });
  return { deleted: result.deletedCount };
}

/**
 * Get all relationships for a given concept (both directions, all types).
 */
export async function getRelationships(conceptId) {
  const db = getDb();
  const edges = await db.collection("taxonomy_edges").find({
    $or: [{ sourceID: conceptId }, { targetID: conceptId }],
  }).toArray();

  // Collect related node IDs
  const relatedIds = new Set();
  for (const e of edges) {
    relatedIds.add(e.sourceID);
    relatedIds.add(e.targetID);
  }
  relatedIds.delete(conceptId);

  const relatedNodes = relatedIds.size > 0
    ? await db.collection("taxonomy_nodes").find({ _id: { $in: [...relatedIds] } }).toArray()
    : [];
  const nodeMap = new Map(relatedNodes.map((n) => [n._id, n]));

  const outgoing = edges
    .filter((e) => e.sourceID === conceptId)
    .map((e) => ({ ...e, targetNode: nodeMap.get(e.targetID) || null }));
  const incoming = edges
    .filter((e) => e.targetID === conceptId)
    .map((e) => ({ ...e, sourceNode: nodeMap.get(e.sourceID) || null }));

  return { outgoing, incoming };
}

/**
 * Get the full ontology as a graph (nodes + all edges including non-hierarchical).
 */
export async function getOntologyGraph(taxonomySet) {
  const db = getDb();
  const filter = taxonomySet ? { taxonomySet } : {};
  const nodes = await db.collection("taxonomy_nodes").find(filter, { projection: { path: 0 } }).toArray();
  const edges = await db.collection("taxonomy_edges").find(filter).toArray();
  return { nodes, edges };
}

/* ------------------------------------------------------------------ */
/*  Inference — auto-tag ancestor concepts                             */
/* ------------------------------------------------------------------ */

/**
 * Given a set of leaf conceptIDs, infer all ancestor concepts
 * via parent-child edges and return the full expanded set.
 */
export async function inferAncestors(conceptIds) {
  const db = getDb();
  const edgesColl = db.collection("taxonomy_edges");

  const allIds = new Set(conceptIds);
  const queue = [...conceptIds];

  while (queue.length > 0) {
    const current = queue.shift();
    // Find parent of this concept
    const parentEdge = await edgesColl.findOne({
      targetID: current,
      relationshipType: "parent-child",
    });
    if (parentEdge && !allIds.has(parentEdge.sourceID)) {
      allIds.add(parentEdge.sourceID);
      queue.push(parentEdge.sourceID);
    }
  }

  return [...allIds];
}

/**
 * Tag documents with concept IDs and auto-infer ancestor concepts.
 */
export async function tagDocumentsWithInference(documentIds, conceptIds) {
  const expandedIds = await inferAncestors(conceptIds);
  return tagDocuments(documentIds, expandedIds);
}

/* ------------------------------------------------------------------ */
/*  Ontology-aware agent helpers                                       */
/* ------------------------------------------------------------------ */

/**
 * Concept Impact: what documents are affected if a concept/standard changes.
 * Finds all documents tagged with the concept or any of its descendants,
 * plus documents linked via ontology relationships.
 */
export async function conceptImpact(conceptId) {
  const db = getDb();
  const nodesColl = db.collection("taxonomy_nodes");
  const edgesColl = db.collection("taxonomy_edges");

  const concept = await nodesColl.findOne({ _id: conceptId });
  if (!concept) throw new Error(`Concept '${conceptId}' not found`);

  // Get all descendants
  const descendants = await getDescendantsBFS(conceptId);
  const allConceptIds = [conceptId, ...descendants.map((d) => d._id)];

  // Get ontology-related concepts (applies-to, governed-by, is-a, supersedes)
  const relatedEdges = await edgesColl.find({
    $or: [
      { sourceID: { $in: allConceptIds }, relationshipType: { $in: ["applies-to", "governed-by", "supersedes"] } },
      { targetID: { $in: allConceptIds }, relationshipType: { $in: ["applies-to", "governed-by", "supersedes"] } },
    ],
  }).toArray();

  const relatedConceptIds = new Set(allConceptIds);
  for (const e of relatedEdges) {
    relatedConceptIds.add(e.sourceID);
    relatedConceptIds.add(e.targetID);
  }

  // Find all documents tagged with any of these concepts
  const allIds = [...relatedConceptIds];
  const documents = await db.collection("graph_nodes")
    .find({ conceptIDs: { $in: allIds } }, { projection: { embedding: 0 } })
    .toArray();

  return {
    concept,
    descendants: descendants.map((d) => ({ _id: d._id, label: d.label })),
    relatedEdges,
    relatedConcepts: allIds,
    affectedDocuments: documents,
  };
}

/**
 * Taxonomy Gap Detector: find documents not tagged with any concept,
 * or concepts with no documents.
 */
export async function taxonomyGapDetector() {
  const db = getDb();
  const nodesColl = db.collection("taxonomy_nodes");

  // Documents with no conceptIDs or empty conceptIDs
  const untaggedDocs = await db.collection("graph_nodes")
    .find(
      { $or: [{ conceptIDs: { $exists: false } }, { conceptIDs: { $size: 0 } }] },
      { projection: { embedding: 0 } },
    )
    .toArray();

  // Concepts with no documents
  const allConcepts = await nodesColl.find().toArray();
  const emptyConcepts = [];

  for (const concept of allConcepts) {
    const count = await db.collection("graph_nodes").countDocuments({ conceptIDs: concept._id });
    if (count === 0) {
      emptyConcepts.push({ _id: concept._id, label: concept.label, type: concept.type });
    }
  }

  // Documents with only root-level concepts (poorly tagged)
  const poorlyTagged = await db.collection("graph_nodes")
    .find(
      { conceptIDs: { $exists: true, $ne: [] }, $expr: { $lte: [{ $size: "$conceptIDs" }, 1] } },
      { projection: { embedding: 0 } },
    )
    .toArray();

  return {
    untaggedDocuments: untaggedDocs,
    emptyConcepts,
    poorlyTaggedDocuments: poorlyTagged,
    summary: {
      totalDocuments: await db.collection("graph_nodes").countDocuments(),
      untagged: untaggedDocs.length,
      emptyConcepts: emptyConcepts.length,
      poorlyTagged: poorlyTagged.length,
    },
  };
}

/**
 * Relationship Suggester: suggest ontology edges based on document co-reference patterns.
 * If two concepts frequently appear together in document conceptIDs, they likely have a relationship.
 */
export async function relationshipSuggester(minCoOccurrence = 3) {
  const db = getDb();

  // Find concept co-occurrences across documents
  const pipeline = [
    { $match: { conceptIDs: { $exists: true, $not: { $size: 0 } } } },
    { $project: { conceptIDs: 1 } },
    { $unwind: "$conceptIDs" },
    {
      $group: {
        _id: "$_id",
        concepts: { $push: "$conceptIDs" },
      },
    },
    { $match: { $expr: { $gte: [{ $size: "$concepts" }, 2] } } },
  ];

  const docsWithMultiple = await db.collection("graph_nodes").aggregate(pipeline).toArray();

  // Count co-occurrences between pairs
  const pairCounts = new Map();
  for (const doc of docsWithMultiple) {
    const concepts = [...new Set(doc.concepts)].sort();
    for (let i = 0; i < concepts.length; i++) {
      for (let j = i + 1; j < concepts.length; j++) {
        const key = `${concepts[i]}|${concepts[j]}`;
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
      }
    }
  }

  // Filter by threshold and exclude existing relationships
  const edgesColl = db.collection("taxonomy_edges");
  const suggestions = [];

  for (const [key, count] of pairCounts) {
    if (count < minCoOccurrence) continue;
    const [sourceID, targetID] = key.split("|");

    // Check if any relationship already exists
    const existing = await edgesColl.findOne({
      $or: [
        { sourceID, targetID },
        { sourceID: targetID, targetID: sourceID },
      ],
    });
    if (existing) continue;

    suggestions.push({ sourceID, targetID, coOccurrences: count });
  }

  // Enrich with node labels
  const allIds = new Set();
  for (const s of suggestions) {
    allIds.add(s.sourceID);
    allIds.add(s.targetID);
  }
  const nodes = await db.collection("taxonomy_nodes")
    .find({ _id: { $in: [...allIds] } })
    .toArray();
  const nodeMap = new Map(nodes.map((n) => [n._id, n.label]));

  return suggestions
    .map((s) => ({
      ...s,
      sourceLabel: nodeMap.get(s.sourceID) || s.sourceID,
      targetLabel: nodeMap.get(s.targetID) || s.targetID,
    }))
    .sort((a, b) => b.coOccurrences - a.coOccurrences);
}

/* ------------------------------------------------------------------ */
/*  Import / Export  (SKOS JSON-LD, OWL JSON-LD)                       */
/* ------------------------------------------------------------------ */

const SKOS = "http://www.w3.org/2004/02/skos/core#";
const OWL = "http://www.w3.org/2002/07/owl#";
const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const BASE_URI = "http://example.org/taxonomy/";

const REL_TO_OWL = {
  "parent-child": `${SKOS}broader`,
  "is-a": `${RDFS}subClassOf`,
  "part-of": `${BASE_URI}partOf`,
  "applies-to": `${BASE_URI}appliesTo`,
  "supersedes": `${BASE_URI}supersedes`,
  "governed-by": `${BASE_URI}governedBy`,
};

/**
 * Export the taxonomy as SKOS-compatible JSON-LD.
 */
export async function exportSKOS() {
  const db = getDb();
  const nodes = await db.collection("taxonomy_nodes").find().toArray();
  const edges = await db.collection("taxonomy_edges").find().toArray();

  const concepts = nodes.map((n) => {
    const concept = {
      "@id": `${BASE_URI}${n._id}`,
      "@type": `${SKOS}Concept`,
      [`${SKOS}prefLabel`]: n.label,
    };

    if (n.description) concept[`${SKOS}definition`] = n.description;
    if (n.properties && Object.keys(n.properties).length > 0) {
      concept[`${BASE_URI}properties`] = n.properties;
    }

    // Add broader (parent) relationships
    const parentEdges = edges.filter((e) => e.targetID === n._id && e.relationshipType === "parent-child");
    if (parentEdges.length > 0) {
      concept[`${SKOS}broader`] = parentEdges.map((e) => ({ "@id": `${BASE_URI}${e.sourceID}` }));
    }

    // Add narrower (children) relationships
    const childEdges = edges.filter((e) => e.sourceID === n._id && e.relationshipType === "parent-child");
    if (childEdges.length > 0) {
      concept[`${SKOS}narrower`] = childEdges.map((e) => ({ "@id": `${BASE_URI}${e.targetID}` }));
    }

    // Add ontology relationships
    for (const e of edges.filter((e) => e.sourceID === n._id && e.relationshipType !== "parent-child")) {
      const predicate = REL_TO_OWL[e.relationshipType] || `${BASE_URI}${e.relationshipType}`;
      if (!concept[predicate]) concept[predicate] = [];
      concept[predicate].push({ "@id": `${BASE_URI}${e.targetID}` });
    }

    return concept;
  });

  return {
    "@context": {
      skos: SKOS,
      owl: OWL,
      rdf: RDF,
      rdfs: RDFS,
      tax: BASE_URI,
    },
    "@graph": concepts,
  };
}

/**
 * Import taxonomy from SKOS-compatible JSON-LD.
 * Merges with existing data (upserts nodes, adds non-duplicate edges).
 */
export async function importSKOS(jsonld) {
  const db = getDb();
  const nodesColl = db.collection("taxonomy_nodes");
  const edgesColl = db.collection("taxonomy_edges");
  const log = [];

  const graph = jsonld["@graph"] || [];
  if (graph.length === 0) throw new Error("No @graph array found in JSON-LD");

  let nodesImported = 0;
  let edgesImported = 0;

  // Reverse mapping from OWL URIs to relationship types
  const OWL_TO_REL = {};
  for (const [rel, uri] of Object.entries(REL_TO_OWL)) {
    OWL_TO_REL[uri] = rel;
  }

  for (const concept of graph) {
    const uri = concept["@id"] || "";
    const _id = uri.replace(BASE_URI, "");
    if (!_id) continue;

    const label = concept[`${SKOS}prefLabel`] || _id;
    const description = concept[`${SKOS}definition`] || "";
    const properties = concept[`${BASE_URI}properties`] || {};

    // Upsert node
    await nodesColl.updateOne(
      { _id },
      {
        $set: { label, description, properties, "metadata.updatedAt": new Date() },
        $setOnInsert: {
          type: "concept",
          level: 0,
          path: [_id],
          metadata: { source: "import", createdAt: new Date() },
        },
      },
      { upsert: true },
    );
    nodesImported++;

    // Process broader (parent) relationships
    const broader = concept[`${SKOS}broader`] || [];
    const broaderArr = Array.isArray(broader) ? broader : [broader];
    for (const b of broaderArr) {
      const parentId = (b["@id"] || "").replace(BASE_URI, "");
      if (!parentId) continue;
      const exists = await edgesColl.findOne({ sourceID: parentId, targetID: _id, relationshipType: "parent-child" });
      if (!exists) {
        await edgesColl.insertOne({ sourceID: parentId, targetID: _id, relationshipType: "parent-child", metadata: { createdAt: new Date() } });
        edgesImported++;
      }
    }

    // Process other ontology relationships
    for (const [predicate, targets] of Object.entries(concept)) {
      const relType = OWL_TO_REL[predicate];
      if (!relType || relType === "parent-child") continue;
      const targetArr = Array.isArray(targets) ? targets : [targets];
      for (const t of targetArr) {
        const targetId = (t["@id"] || "").replace(BASE_URI, "");
        if (!targetId) continue;
        const exists = await edgesColl.findOne({ sourceID: _id, targetID: targetId, relationshipType: relType });
        if (!exists) {
          await edgesColl.insertOne({ sourceID: _id, targetID: targetId, relationshipType: relType, metadata: { createdAt: new Date() } });
          edgesImported++;
        }
      }
    }
  }

  // Recalculate levels and paths for imported nodes
  const allEdges = await edgesColl.find({ relationshipType: "parent-child" }).toArray();
  const childSet = new Set(allEdges.map((e) => e.targetID));
  const allNodes = await nodesColl.find().toArray();
  const roots = allNodes.filter((n) => !childSet.has(n._id));

  for (const root of roots) {
    await recalcSubtree(root._id, [], 0);
  }

  log.push(`Imported ${nodesImported} nodes and ${edgesImported} edges`);
  return { success: true, nodesImported, edgesImported, log };
}
