import { MongoClient } from "mongodb";

let client = null;
let db = null;
let config = { uri: null, dbName: null, embeddingProvider: "voyageai", embeddingApiKey: null, embeddingModel: "voyage-4-lite" };

export function setConfig({ uri, dbName, embeddingProvider, embeddingApiKey, embeddingModel }) {
  if (uri) config.uri = uri;
  if (dbName) config.dbName = dbName;
  if (embeddingProvider) config.embeddingProvider = embeddingProvider;
  if (embeddingApiKey) config.embeddingApiKey = embeddingApiKey;
  if (embeddingModel) config.embeddingModel = embeddingModel;
}

export function getConfig() {
  return { ...config };
}

export async function connect() {
  if (client) {
    await client.close().catch(() => {});
    client = null;
    db = null;
  }
  if (!config.uri || !config.dbName) {
    throw new Error("MongoDB URI and Database Name are required");
  }
  client = new MongoClient(config.uri);
  await client.connect();
  // Verify connectivity
  await client.db("admin").command({ ping: 1 });
  db = client.db(config.dbName);
  return { success: true, message: `Connected to ${config.dbName}` };
}

export function getDb() {
  if (!db) throw new Error("Not connected to MongoDB");
  return db;
}

export function getClient() {
  return client;
}

export function isConnected() {
  if (!client) return false;
  try {
    // MongoClient tracks topology; if it's still open we're connected
    return client.topology?.isConnected?.() ?? !!client.topology;
  } catch {
    return false;
  }
}

export async function disconnect() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
