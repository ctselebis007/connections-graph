import { Router } from "express";
import {
  setConfig,
  getConfig,
  connect,
  isConnected,
  getDb,
} from "../services/mongo.js";
import { seedDatabase } from "../services/seed.js";
import {
  createIndexes,
  createSearchIndexes,
  createVectorIndexes,
} from "../services/indexes.js";
import { generateEmbeddings } from "../services/embeddings.js";

const router = Router();

/* POST /api/setup/connect */
router.post("/connect", async (req, res) => {
  try {
    const { uri, dbName, embeddingProvider, embeddingApiKey, embeddingModel } = req.body;
    setConfig({ uri, dbName, embeddingProvider, embeddingApiKey, embeddingModel });
    const result = await connect();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* POST /api/setup/seed */
router.post("/seed", async (_req, res) => {
  try {
    const result = await seedDatabase();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* POST /api/setup/indexes */
router.post("/indexes", async (_req, res) => {
  try {
    const result = await createIndexes();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* POST /api/setup/search-indexes */
router.post("/search-indexes", async (_req, res) => {
  try {
    const result = await createSearchIndexes();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* POST /api/setup/vector-indexes */
router.post("/vector-indexes", async (req, res) => {
  try {
    const { voyageApiKey } = req.body;
    if (voyageApiKey) setConfig({ voyageApiKey });
    const result = await createVectorIndexes();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* POST /api/setup/generate-embeddings */
router.post("/generate-embeddings", async (req, res) => {
  try {
    const { voyageApiKey } = req.body;
    if (voyageApiKey) setConfig({ voyageApiKey });
    const result = await generateEmbeddings();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* GET /api/setup/status */
router.get("/status", async (_req, res) => {
  try {
    const connected = isConnected();
    const status = { connected, collections: {}, config: {} };
    const cfg = getConfig();
    status.config.hasUri = !!cfg.uri;
    status.config.hasDbName = !!cfg.dbName;
    status.config.hasEmbeddingKey = !!cfg.embeddingApiKey;
    status.config.embeddingProvider = cfg.embeddingProvider || "voyageai";
    status.config.embeddingModel = cfg.embeddingModel || "voyage-4-lite";

    if (connected) {
      const db = getDb();
      const colls = await db.listCollections().toArray();
      for (const c of colls) {
        const count = await db.collection(c.name).countDocuments();
        status.collections[c.name] = count;
      }
    }

    res.json(status);
  } catch (err) {
    res.status(500).json({ connected: false, message: err.message });
  }
});

export default router;
