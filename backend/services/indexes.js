import { getDb } from "./mongo.js";
import { getConfig } from "./mongo.js";

const MODEL_DIMS = {
  "voyage-4-lite": 1024,
  "voyage-3-lite": 512,
  "voyage-3": 1024,
  "voyage-code-3": 1024,
  "voyage-finance-2": 1024,
  "voyage-large-2": 1536,
  "voyage-2": 1024,
  "text-embedding-ada-002": 1536,
};

/**
 * Create regular MongoDB indexes on all three collections.
 */
export async function createIndexes() {
  const db = getDb();
  const log = [];

  // --- documents (Approach A) ---
  const docs = db.collection("documents");
  await docs.createIndex({ channelIDs: 1 }, { name: "idx_channelIDs" });
  await docs.createIndex({ languageIDs: 1 }, { name: "idx_languageIDs" });
  await docs.createIndex({ "connections.targetID": 1 }, { name: "idx_conn_targetID" });
  await docs.createIndex({ "connections.linkType": 1 }, { name: "idx_conn_linkType" });
  await docs.createIndex({ "metadata.serviceline": 1 }, { name: "idx_meta_serviceline" });
  log.push("Created 5 indexes on 'documents'");

  // --- graph_nodes (Approach B) ---
  const nodes = db.collection("graph_nodes");
  await nodes.createIndex({ channelIDs: 1 }, { name: "idx_channelIDs" });
  await nodes.createIndex({ languageIDs: 1 }, { name: "idx_languageIDs" });
  await nodes.createIndex({ "metadata.serviceline": 1 }, { name: "idx_meta_serviceline" });
  log.push("Created 3 indexes on 'graph_nodes'");

  // --- graph_edges (Approach B) ---
  const edges = db.collection("graph_edges");
  await edges.createIndex({ sourceID: 1, targetID: 1 }, { name: "idx_source_target" });
  await edges.createIndex({ targetID: 1 }, { name: "idx_targetID" });
  await edges.createIndex({ linkType: 1 }, { name: "idx_linkType" });
  await edges.createIndex({ channelID: 1 }, { name: "idx_channelID" });
  log.push("Created 4 indexes on 'graph_edges'");

  // --- conceptIDs on documents and graph_nodes ---
  await docs.createIndex({ conceptIDs: 1 }, { name: "idx_conceptIDs" });
  await nodes.createIndex({ conceptIDs: 1 }, { name: "idx_conceptIDs" });
  log.push("Created conceptIDs indexes on 'documents' and 'graph_nodes'");

  // --- taxonomy_nodes ---
  const taxNodes = db.collection("taxonomy_nodes");
  await taxNodes.createIndex({ type: 1 }, { name: "idx_type" });
  await taxNodes.createIndex({ level: 1 }, { name: "idx_level" });
  await taxNodes.createIndex({ path: 1 }, { name: "idx_path" });
  await taxNodes.createIndex({ label: 1 }, { name: "idx_label" });
  log.push("Created 4 indexes on 'taxonomy_nodes'");

  // --- taxonomy_edges ---
  const taxEdges = db.collection("taxonomy_edges");
  await taxEdges.createIndex({ sourceID: 1, targetID: 1 }, { name: "idx_source_target" });
  await taxEdges.createIndex({ targetID: 1 }, { name: "idx_targetID" });
  await taxEdges.createIndex({ relationshipType: 1 }, { name: "idx_relationshipType" });
  log.push("Created 3 indexes on 'taxonomy_edges'");

  return { success: true, log };
}

/**
 * Create Atlas Search indexes for text search.
 */
export async function createSearchIndexes() {
  const db = getDb();
  const log = [];

  const searchMappings = {
    dynamic: false,
    fields: {
      documentTitle: { type: "string", analyzer: "lucene.standard" },
      "metadata.searchtopic": { type: "string", analyzer: "lucene.standard" },
      "metadata.contentcategory": { type: "string", analyzer: "lucene.standard" },
      "metadata.serviceline": { type: "string", analyzer: "lucene.standard" },
      "metadata.focus": { type: "string", analyzer: "lucene.standard" },
      "metadata.issuingorganization": { type: "string", analyzer: "lucene.standard" },
    },
  };

  const collections = ["documents", "graph_nodes"];

  for (const collName of collections) {
    const coll = db.collection(collName);
    try {
      await coll.createSearchIndex({
        name: "default",
        type: "search",
        definition: { mappings: searchMappings },
      });
      log.push(`Created Atlas Search index 'default' on '${collName}'`);
    } catch (err) {
      if (err.codeName === "IndexAlreadyExists" || err.message?.includes("already exists")) {
        log.push(`Atlas Search index 'default' already exists on '${collName}'`);
      } else {
        throw err;
      }
    }
  }

  return { success: true, log };
}

/**
 * Create Atlas Vector Search indexes.
 */
export async function createVectorIndexes() {
  const db = getDb();
  const { embeddingModel } = getConfig();
  const dims = MODEL_DIMS[embeddingModel] || 512;
  const log = [];
  log.push(`Using ${dims} dimensions (model: ${embeddingModel || "voyage-4-lite"})`);

  const collections = ["documents", "graph_nodes"];

  for (const collName of collections) {
    const coll = db.collection(collName);
    try {
      await coll.createSearchIndex({
        name: "vector_index",
        type: "vectorSearch",
        definition: {
          fields: [
            {
              type: "vector",
              path: "embedding",
              numDimensions: dims,
              similarity: "cosine",
            },
          ],
        },
      });
      log.push(`Created Vector Search index 'vector_index' (${dims}d) on '${collName}'`);
    } catch (err) {
      if (err.codeName === "IndexAlreadyExists" || err.message?.includes("already exists")) {
        log.push(`Vector Search index 'vector_index' already exists on '${collName}'`);
      } else {
        throw err;
      }
    }
  }

  return { success: true, log };
}
