import { getDb } from "./mongo.js";
import { generateDataset } from "./generateData.js";

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

  if (taxonomyNodes.length > 0) {
    await taxNodesColl.insertMany(taxonomyNodes, { ordered: false });
  }
  log.push(`Taxonomy: inserted ${taxonomyNodes.length} docs into 'taxonomy_nodes'`);

  if (taxonomyEdges.length > 0) {
    await taxEdgesColl.insertMany(taxonomyEdges, { ordered: false });
  }
  log.push(`Taxonomy: inserted ${taxonomyEdges.length} docs into 'taxonomy_edges'`);

  return {
    success: true,
    counts: {
      documents: documents.length,
      graph_nodes: graphNodes.length,
      graph_edges: edges.length,
      taxonomy_nodes: taxonomyNodes.length,
      taxonomy_edges: taxonomyEdges.length,
    },
    log,
  };
}
