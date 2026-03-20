import { getDb } from "./mongo.js";
import { getConfig } from "./mongo.js";

const VOYAGE_URL = "https://ai.mongodb.com/v1/embeddings";
const OPENAI_URL = "https://api.openai.com/v1/embeddings";
const BATCH_SIZE = 32;

/**
 * Call VoyageAI (via MongoDB AI proxy) to get embeddings.
 */
async function fetchVoyageEmbeddings(texts, apiKey, model) {
  const res = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: texts }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`VoyageAI error ${res.status}: ${body}`);
  }
  const json = await res.json();
  return json.data.map((d) => d.embedding);
}

/**
 * Call OpenAI to get embeddings.
 */
async function fetchOpenAIEmbeddings(texts, apiKey, model) {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: texts }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${body}`);
  }
  const json = await res.json();
  return json.data.map((d) => d.embedding);
}

/**
 * Dispatch to the correct provider.
 */
function fetchEmbeddings(texts, apiKey, model, provider) {
  if (provider === "openai") {
    return fetchOpenAIEmbeddings(texts, apiKey, model);
  }
  return fetchVoyageEmbeddings(texts, apiKey, model);
}

/**
 * Build the text to embed for a given document.
 * Returns empty string if no meaningful text is available.
 */
function buildEmbeddingText(doc) {
  const parts = [];
  if (doc.documentTitle) parts.push(doc.documentTitle);
  const meta = doc.metadata || {};
  if (meta.searchtopic) parts.push(meta.searchtopic);
  if (meta.contentcategory) parts.push(meta.contentcategory);
  if (meta.focus) parts.push(meta.focus);
  if (meta.serviceline) parts.push(meta.serviceline);
  if (parts.length === 0) parts.push(`Document ${doc._id}`);
  return parts.join(" | ");
}

/**
 * Generate embeddings for all documents in a collection and store them.
 */
async function embedCollection(collectionName, apiKey, model, provider) {
  const db = getDb();
  const coll = db.collection(collectionName);
  const docs = await coll.find({}, { projection: { _id: 1, documentTitle: 1, metadata: 1 } }).toArray();

  let processed = 0;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    const texts = batch.map(buildEmbeddingText);
    const embeddings = await fetchEmbeddings(texts, apiKey, model, provider);

    const ops = batch.map((doc, idx) => ({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { embedding: embeddings[idx] } },
      },
    }));
    await coll.bulkWrite(ops);
    processed += batch.length;
  }

  return processed;
}

/**
 * Generate embeddings for both collections.
 */
export async function generateEmbeddings() {
  const { embeddingApiKey, embeddingModel, embeddingProvider } = getConfig();
  if (!embeddingApiKey) throw new Error("Embedding API key not configured");

  const provider = embeddingProvider || "voyageai";
  const model = embeddingModel || "voyage-4-lite";
  const log = [];
  log.push(`Provider: ${provider}, Model: ${model}`);
  const countDocs = await embedCollection("documents", embeddingApiKey, model, provider);
  log.push(`Generated embeddings for ${countDocs} docs in 'documents'`);

  const countNodes = await embedCollection("graph_nodes", embeddingApiKey, model, provider);
  log.push(`Generated embeddings for ${countNodes} docs in 'graph_nodes'`);

  return { success: true, log };
}

/**
 * Embed a single query string.
 */
export async function embedQuery(text) {
  const { embeddingApiKey, embeddingModel, embeddingProvider } = getConfig();
  if (!embeddingApiKey) throw new Error("Embedding API key not configured");
  const provider = embeddingProvider || "voyageai";
  const model = embeddingModel || "voyage-4-lite";
  const [embedding] = await fetchEmbeddings([text], embeddingApiKey, model, provider);
  return embedding;
}
