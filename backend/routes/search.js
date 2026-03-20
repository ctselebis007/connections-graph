import { Router } from "express";
import {
  lexicalSearch,
  vectorSearch,
  hybridSearch,
  hybridGraphSearch,
} from "../services/search.js";
import {
  graphLookupA,
  graphLookupB,
  getFullGraph,
} from "../services/graph.js";

const router = Router();

/* POST /api/search/lexical */
router.post("/lexical", async (req, res) => {
  try {
    const { results, pipeline } = await lexicalSearch(req.body);
    res.json({ results, pipeline });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /api/search/vector */
router.post("/vector", async (req, res) => {
  try {
    const { results, pipeline } = await vectorSearch(req.body);
    res.json({ results, pipeline });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /api/search/hybrid */
router.post("/hybrid", async (req, res) => {
  try {
    const { results, pipeline } = await hybridSearch(req.body);
    res.json({ results, pipeline });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /api/search/hybrid-graph */
router.post("/hybrid-graph", async (req, res) => {
  try {
    const { results, pipeline } = await hybridGraphSearch(req.body);
    res.json({ results, pipeline });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /api/search/graph */
router.post("/graph", async (req, res) => {
  try {
    const { nodeId, depth, linkTypes, source } = req.body;
    const fn = source === "graph" ? graphLookupB : graphLookupA;
    const result = await fn({ nodeId, depth, linkTypes });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /api/search/graph/neighbors */
router.post("/graph/neighbors", async (req, res) => {
  try {
    const { nodeId, depth = 2, linkTypes, source } = req.body;
    const fn = source === "graph" ? graphLookupB : graphLookupA;
    const result = await fn({ nodeId, depth, linkTypes });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET /api/search/graph/full?source=documents|graph */
router.get("/graph/full", async (req, res) => {
  try {
    const result = await getFullGraph(req.query.source || "documents");
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
