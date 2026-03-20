import { getDb } from "./mongo.js";
import { generateDataset } from "./generateData.js";

/**
 * Seed all three collections with generated data.
 */
export async function seedDatabase() {
  const db = getDb();
  const log = [];

  // Generate a rich, randomized dataset
  const { documents, graphNodes, edges } = generateDataset(120);
  log.push(`Generated ${graphNodes.length} nodes and ${edges.length} edges`);

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

  return {
    success: true,
    counts: {
      documents: documents.length,
      graph_nodes: graphNodes.length,
      graph_edges: edges.length,
    },
    log,
  };
}
