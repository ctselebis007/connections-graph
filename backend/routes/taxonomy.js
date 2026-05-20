import { Router } from "express";
import {
  getTree,
  getAllNodes,
  getNode,
  getDescendantsBFS,
  createNode,
  updateNode,
  deleteNode,
  moveNode,
  tagDocuments,
  untagDocuments,
  getDocumentsByConcept,
  createRelationship,
  deleteRelationship,
  getRelationships,
  getOntologyGraph,
  tagDocumentsWithInference,
  conceptImpact,
  taxonomyGapDetector,
  relationshipSuggester,
  exportSKOS,
  importSKOS,
  getTaxonomySets,
} from "../services/taxonomy.js";

const router = Router();

/* GET /api/taxonomy/sets — list available taxonomy sets */
router.get("/sets", async (_req, res) => {
  try {
    const sets = await getTaxonomySets();
    res.json({ sets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET /api/taxonomy/tree — full nested tree */
router.get("/tree", async (req, res) => {
  try {
    const taxonomySet = req.query.set || null;
    const tree = await getTree(taxonomySet);
    res.json({ tree });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET /api/taxonomy/nodes — flat list */
router.get("/nodes", async (req, res) => {
  try {
    const taxonomySet = req.query.set || null;
    const nodes = await getAllNodes(taxonomySet);
    res.json({ nodes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET /api/taxonomy/nodes/:id — single node with parent + children */
router.get("/nodes/:id", async (req, res) => {
  try {
    const node = await getNode(req.params.id);
    if (!node) return res.status(404).json({ error: "Node not found" });
    res.json(node);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /api/taxonomy/nodes — create node */
router.post("/nodes", async (req, res) => {
  try {
    const { _id, label, description, type, parentId, properties, taxonomySet } = req.body;
    if (!_id || !label) {
      return res.status(400).json({ error: "_id and label are required" });
    }
    const node = await createNode({ _id, label, description, type, parentId, properties, taxonomySet });
    res.status(201).json(node);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* PUT /api/taxonomy/nodes/:id — update node */
router.put("/nodes/:id", async (req, res) => {
  try {
    const node = await updateNode(req.params.id, req.body);
    if (!node) return res.status(404).json({ error: "Node not found" });
    res.json(node);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* DELETE /api/taxonomy/nodes/:id — delete node */
router.delete("/nodes/:id", async (req, res) => {
  try {
    const mode = req.query.mode || "reparent";
    const result = await deleteNode(req.params.id, mode);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* PUT /api/taxonomy/nodes/:id/move — reparent node */
router.put("/nodes/:id/move", async (req, res) => {
  try {
    const { newParentId } = req.body;
    if (!newParentId) return res.status(400).json({ error: "newParentId is required" });
    const result = await moveNode(req.params.id, newParentId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET /api/taxonomy/nodes/:id/descendants — all descendants (for query expansion) */
router.get("/nodes/:id/descendants", async (req, res) => {
  try {
    const descendants = await getDescendantsBFS(req.params.id);
    res.json({ descendants });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET /api/taxonomy/nodes/:id/documents — documents tagged with this concept */
router.get("/nodes/:id/documents", async (req, res) => {
  try {
    const documents = await getDocumentsByConcept(req.params.id);
    res.json({ documents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /api/taxonomy/tag — tag documents with concepts */
router.post("/tag", async (req, res) => {
  try {
    const { documentIds, conceptIds } = req.body;
    if (!documentIds?.length || !conceptIds?.length) {
      return res.status(400).json({ error: "documentIds and conceptIds arrays are required" });
    }
    const result = await tagDocuments(documentIds, conceptIds);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /api/taxonomy/untag — remove concept tags from documents */
router.post("/untag", async (req, res) => {
  try {
    const { documentIds, conceptIds } = req.body;
    if (!documentIds?.length || !conceptIds?.length) {
      return res.status(400).json({ error: "documentIds and conceptIds arrays are required" });
    }
    const result = await untagDocuments(documentIds, conceptIds);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ------------------------------------------------------------------ */
/*  Ontology relationships                                             */
/* ------------------------------------------------------------------ */

/* GET /api/taxonomy/ontology/graph — full ontology (nodes + all edges) */
router.get("/ontology/graph", async (req, res) => {
  try {
    const taxonomySet = req.query.set || null;
    const graph = await getOntologyGraph(taxonomySet);
    res.json(graph);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET /api/taxonomy/nodes/:id/relationships — all relationships for a concept */
router.get("/nodes/:id/relationships", async (req, res) => {
  try {
    const rels = await getRelationships(req.params.id);
    res.json(rels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /api/taxonomy/relationships — create an ontology relationship */
router.post("/relationships", async (req, res) => {
  try {
    const { sourceID, targetID, relationshipType } = req.body;
    if (!sourceID || !targetID || !relationshipType) {
      return res.status(400).json({ error: "sourceID, targetID, and relationshipType are required" });
    }
    const edge = await createRelationship({ sourceID, targetID, relationshipType });
    res.status(201).json(edge);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* DELETE /api/taxonomy/relationships — delete an ontology relationship */
router.delete("/relationships", async (req, res) => {
  try {
    const { sourceID, targetID, relationshipType } = req.body;
    if (!sourceID || !targetID || !relationshipType) {
      return res.status(400).json({ error: "sourceID, targetID, and relationshipType are required" });
    }
    const result = await deleteRelationship(sourceID, targetID, relationshipType);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ------------------------------------------------------------------ */
/*  Inference                                                          */
/* ------------------------------------------------------------------ */

/* POST /api/taxonomy/tag-with-inference — tag with auto-ancestor inference */
router.post("/tag-with-inference", async (req, res) => {
  try {
    const { documentIds, conceptIds } = req.body;
    if (!documentIds?.length || !conceptIds?.length) {
      return res.status(400).json({ error: "documentIds and conceptIds arrays are required" });
    }
    const result = await tagDocumentsWithInference(documentIds, conceptIds);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ------------------------------------------------------------------ */
/*  Import / Export                                                     */
/* ------------------------------------------------------------------ */

/* GET /api/taxonomy/export/skos — export as SKOS JSON-LD */
router.get("/export/skos", async (_req, res) => {
  try {
    const jsonld = await exportSKOS();
    res.setHeader("Content-Type", "application/ld+json");
    res.setHeader("Content-Disposition", 'attachment; filename="taxonomy-skos.jsonld"');
    res.json(jsonld);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /api/taxonomy/import/skos — import SKOS JSON-LD */
router.post("/import/skos", async (req, res) => {
  try {
    const result = await importSKOS(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ------------------------------------------------------------------ */
/*  Ontology Agents                                                    */
/* ------------------------------------------------------------------ */

/* POST /api/taxonomy/agents/concept-impact */
router.post("/agents/concept-impact", async (req, res) => {
  try {
    const { conceptId } = req.body;
    if (!conceptId) return res.status(400).json({ error: "conceptId is required" });
    const result = await conceptImpact(conceptId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /api/taxonomy/agents/taxonomy-gap-detector */
router.post("/agents/taxonomy-gap-detector", async (_req, res) => {
  try {
    const result = await taxonomyGapDetector();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /api/taxonomy/agents/relationship-suggester */
router.post("/agents/relationship-suggester", async (req, res) => {
  try {
    const minCoOccurrence = parseInt(req.body.minCoOccurrence) || 3;
    const result = await relationshipSuggester(minCoOccurrence);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
