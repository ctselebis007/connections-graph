import { getDb } from "./mongo.js";
import { generateDataset } from "./generateData.js";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/* ------------------------------------------------------------------ */
/*  P2P Reconciliation taxonomy transformer                            */
/* ------------------------------------------------------------------ */

function transformP2PTaxonomy(taxonomyClasses, ontologyRules) {
  const taxonomyNodes = [];
  const taxonomyEdges = [];
  const SET = "p2p-reconciliation";

  // Build a map from collection_name to node _id
  const collToId = new Map();

  // Group classes by category
  const categories = new Map();
  for (const cls of taxonomyClasses) {
    if (!categories.has(cls.category)) categories.set(cls.category, []);
    categories.get(cls.category).push(cls);
  }

  // Root node
  const rootId = "P2P_ROOT";
  taxonomyNodes.push({
    _id: rootId,
    label: "P2P Reconciliation",
    description: "Procure-to-Pay reconciliation process taxonomy",
    type: "category",
    level: 0,
    path: [rootId],
    taxonomySet: SET,
    properties: {},
    metadata: { source: "seed", createdAt: new Date(), updatedAt: new Date() },
  });

  // Category nodes (level 1)
  const categoryLabels = {
    source_document: "Source Documents",
    financial_record: "Financial Records",
    governance_document: "Governance Documents",
    reconciliation_result: "Reconciliation Results",
  };

  for (const [catKey, catClasses] of categories) {
    const catId = `P2P_CAT_${catKey.toUpperCase()}`;
    taxonomyNodes.push({
      _id: catId,
      label: categoryLabels[catKey] || catKey,
      description: catClasses[0]?.description || "",
      type: "category",
      level: 1,
      path: [rootId, catId],
      taxonomySet: SET,
      properties: {},
      metadata: { source: "seed", createdAt: new Date(), updatedAt: new Date() },
    });

    taxonomyEdges.push({
      sourceID: rootId,
      targetID: catId,
      relationshipType: "parent-child",
      taxonomySet: SET,
      metadata: { createdAt: new Date() },
    });

    // Document type nodes (level 2)
    for (const cls of catClasses) {
      const nodeId = `P2P_${cls.document_type.toUpperCase()}`;
      collToId.set(cls.collection_name, nodeId);

      taxonomyNodes.push({
        _id: nodeId,
        label: cls.document_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        description: cls.description || "",
        type: "concept",
        level: 2,
        path: [rootId, catId, nodeId],
        taxonomySet: SET,
        properties: {
          collection_name: cls.collection_name,
          required_fields: cls.required_fields || [],
          optional_fields: cls.optional_fields || [],
        },
        metadata: { source: "seed", createdAt: new Date(), updatedAt: new Date() },
      });

      taxonomyEdges.push({
        sourceID: catId,
        targetID: nodeId,
        relationshipType: "parent-child",
        taxonomySet: SET,
        metadata: { createdAt: new Date() },
      });
    }
  }

  // Ontology rules → edges and validation nodes
  for (const rule of ontologyRules) {
    if (rule.rule_type === "relationship") {
      const sourceId = collToId.get(rule.from_collection);
      const targetId = collToId.get(rule.to_collection);
      if (sourceId && targetId) {
        taxonomyEdges.push({
          sourceID: sourceId,
          targetID: targetId,
          relationshipType: rule.relationship_type,
          taxonomySet: SET,
          metadata: {
            createdAt: new Date(),
            name: rule.name,
            description: rule.description,
            cardinality: rule.cardinality,
            link_field_from: rule.link_field_from,
            link_field_to: rule.link_field_to,
          },
        });
      }
    } else if (rule.rule_type === "validation") {
      // Create validation rule nodes under a validation category
      const ruleId = `P2P_RULE_${rule.rule_id}`;
      if (!taxonomyNodes.find((n) => n._id === "P2P_CAT_VALIDATIONS")) {
        const valCatId = "P2P_CAT_VALIDATIONS";
        taxonomyNodes.push({
          _id: valCatId,
          label: "Validation Rules",
          description: "Rules that validate data consistency across documents",
          type: "category",
          level: 1,
          path: [rootId, valCatId],
          taxonomySet: SET,
          properties: {},
          metadata: { source: "seed", createdAt: new Date(), updatedAt: new Date() },
        });
        taxonomyEdges.push({
          sourceID: rootId,
          targetID: valCatId,
          relationshipType: "parent-child",
          taxonomySet: SET,
          metadata: { createdAt: new Date() },
        });
      }

      taxonomyNodes.push({
        _id: ruleId,
        label: rule.name,
        description: rule.description || "",
        type: "rule",
        level: 2,
        path: [rootId, "P2P_CAT_VALIDATIONS", ruleId],
        taxonomySet: SET,
        properties: {
          rule_id: rule.rule_id,
          severity: rule.severity,
          tolerance: rule.tolerance,
          validation_type: rule.validation_type,
          fields: rule.fields || {},
        },
        metadata: { source: "seed", createdAt: new Date(), updatedAt: new Date() },
      });

      taxonomyEdges.push({
        sourceID: "P2P_CAT_VALIDATIONS",
        targetID: ruleId,
        relationshipType: "parent-child",
        taxonomySet: SET,
        metadata: { createdAt: new Date() },
      });

      // Link validation rules to relevant document types via "validates" relationship
      if (rule.fields) {
        const fieldCollections = Object.keys(rule.fields)
          .map((k) => k.replace("_field", ""))
          .filter((k) => k !== "gl");
        // Map field prefixes to collection names
        const prefixToCollection = {
          po: "purchase_orders",
          invoice: "invoices",
          gl: "general_ledger",
          policy: "policies",
        };
        for (const prefix of Object.keys(rule.fields).map((k) => k.replace("_field", ""))) {
          const collName = prefixToCollection[prefix];
          const targetNodeId = collToId.get(collName);
          if (targetNodeId) {
            taxonomyEdges.push({
              sourceID: ruleId,
              targetID: targetNodeId,
              relationshipType: "validates",
              taxonomySet: SET,
              metadata: { createdAt: new Date() },
            });
          }
        }
      }
    }
  }

  return { taxonomyNodes, taxonomyEdges };
}

/* ------------------------------------------------------------------ */
/*  Seed                                                               */
/* ------------------------------------------------------------------ */

/**
 * Seed all collections with generated data (documents, graph, and taxonomy).
 */
export async function seedDatabase() {
  const db = getDb();
  const log = [];

  // Generate a rich, randomized dataset
  const { documents, graphNodes, edges, taxonomyNodes, taxonomyEdges } = generateDataset(120);
  log.push(`Generated ${graphNodes.length} nodes and ${edges.length} edges`);
  log.push(`Generated ${taxonomyNodes.length} taxonomy nodes and ${taxonomyEdges.length} taxonomy edges`);

  // Load and transform P2P taxonomy data
  const dataDir = join(__dirname, "..", "data");
  const p2pClassesRaw = await readFile(join(dataDir, "p2p_reconciliation.taxonomy_classes.json"), "utf-8");
  const p2pRulesRaw = await readFile(join(dataDir, "p2p_reconciliation.ontology_rules.json"), "utf-8");
  const p2pClasses = JSON.parse(p2pClassesRaw);
  const p2pRules = JSON.parse(p2pRulesRaw);
  const { taxonomyNodes: p2pNodes, taxonomyEdges: p2pEdges } = transformP2PTaxonomy(p2pClasses, p2pRules);
  log.push(`P2P Taxonomy: transformed ${p2pNodes.length} nodes and ${p2pEdges.length} edges`);

  // --- Approach A: documents collection (document-centric) ---
  const docsColl = db.collection("documents");
  await docsColl.drop().catch(() => {});

  if (documents.length > 0) {
    await docsColl.insertMany(documents, { ordered: false });
  }
  log.push(`Approach A: inserted ${documents.length} docs into 'documents'`);

  // --- Approach B: graph_nodes + graph_edges ---
  const nodesColl = db.collection("graph_nodes");
  const edgesColl = db.collection("graph_edges");
  await nodesColl.drop().catch(() => {});
  await edgesColl.drop().catch(() => {});

  if (graphNodes.length > 0) {
    await nodesColl.insertMany(graphNodes, { ordered: false });
  }
  log.push(`Approach B: inserted ${graphNodes.length} docs into 'graph_nodes'`);

  if (edges.length > 0) {
    await edgesColl.insertMany(edges, { ordered: false });
  }
  log.push(`Approach B: inserted ${edges.length} docs into 'graph_edges'`);

  // --- Taxonomy: taxonomy_nodes + taxonomy_edges ---
  const taxNodesColl = db.collection("taxonomy_nodes");
  const taxEdgesColl = db.collection("taxonomy_edges");
  await taxNodesColl.drop().catch(() => {});
  await taxEdgesColl.drop().catch(() => {});

  // Merge Audit + P2P taxonomy nodes and edges
  const allTaxNodes = [...taxonomyNodes, ...p2pNodes];
  const allTaxEdges = [...taxonomyEdges, ...p2pEdges];

  if (allTaxNodes.length > 0) {
    await taxNodesColl.insertMany(allTaxNodes, { ordered: false });
  }
  log.push(`Taxonomy: inserted ${allTaxNodes.length} docs into 'taxonomy_nodes' (${taxonomyNodes.length} audit + ${p2pNodes.length} p2p)`);

  if (allTaxEdges.length > 0) {
    await taxEdgesColl.insertMany(allTaxEdges, { ordered: false });
  }
  log.push(`Taxonomy: inserted ${allTaxEdges.length} docs into 'taxonomy_edges' (${taxonomyEdges.length} audit + ${p2pEdges.length} p2p)`);

  return {
    success: true,
    counts: {
      documents: documents.length,
      graph_nodes: graphNodes.length,
      graph_edges: edges.length,
      taxonomy_nodes: allTaxNodes.length,
      taxonomy_edges: allTaxEdges.length,
    },
    log,
  };
}
