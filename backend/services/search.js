import { getDb } from "./mongo.js";
import { embedQuery } from "./embeddings.js";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildFilter(filters = {}) {
  const match = {};
  if (filters.channelID) match.channelIDs = filters.channelID;
  if (filters.languageID) match.languageIDs = filters.languageID;
  if (filters.linkType) match["connections.linkType"] = filters.linkType;
  return match;
}

function collectionName(source) {
  return source === "graph" ? "graph_nodes" : "documents";
}

/**
 * Expand query using taxonomy (parent-child only) and/or ontology (is-a, part-of, etc.).
 * @param {string} query
 * @param {{ taxonomy?: boolean, ontology?: boolean }} options
 * Returns { expandedQuery, expandedTerms }.
 */
async function expandQueryWithTaxonomy(query, { taxonomy = false, ontology = false } = {}) {
  const db = getDb();
  const queryWords = query.split(/\s+/).filter((w) => w.length > 2);
  if (queryWords.length === 0) return { expandedQuery: query, expandedTerms: [] };

  const regexPatterns = queryWords.map((w) => new RegExp(w, "i"));
  const matchingNodes = await db.collection("taxonomy_nodes").find({
    $or: regexPatterns.map((r) => ({ label: r })),
  }).toArray();

  if (matchingNodes.length === 0) return { expandedQuery: query, expandedTerms: [] };

  // Determine which relationship types to follow
  const expansionTypes = [];
  if (taxonomy) expansionTypes.push("parent-child");
  if (ontology) expansionTypes.push("is-a", "part-of", "applies-to", "supersedes", "governed-by");
  if (expansionTypes.length === 0) return { expandedQuery: query, expandedTerms: [] };

  // Incoming edge types (reverse traversal)
  const incomingTypes = ontology ? ["is-a", "part-of", "applies-to", "supersedes"] : [];

  const allLabels = new Set();
  const expandedTerms = [];
  const edgesColl = db.collection("taxonomy_edges");
  const nodesColl = db.collection("taxonomy_nodes");

  for (const node of matchingNodes) {
    allLabels.add(node.label);
    expandedTerms.push(node.label);

    // BFS traversal
    const visited = new Set([node._id]);
    const queue = [node._id];

    while (queue.length > 0) {
      const current = queue.shift();

      // Outgoing edges for selected relationship types
      const outEdges = await edgesColl.find({
        sourceID: current,
        relationshipType: { $in: expansionTypes },
      }).toArray();

      for (const e of outEdges) {
        if (!visited.has(e.targetID)) {
          visited.add(e.targetID);
          queue.push(e.targetID);
        }
      }

      // Incoming edges (only for ontology types)
      if (incomingTypes.length > 0) {
        const inEdges = await edgesColl.find({
          targetID: current,
          relationshipType: { $in: incomingTypes },
        }).toArray();

        for (const e of inEdges) {
          if (!visited.has(e.sourceID)) {
            visited.add(e.sourceID);
            queue.push(e.sourceID);
          }
        }
      }
    }

    // Remove the root node itself from visited set
    visited.delete(node._id);

    // Fetch labels for all discovered nodes
    if (visited.size > 0) {
      const relatedNodes = await nodesColl.find({ _id: { $in: [...visited] } }).toArray();
      for (const r of relatedNodes) {
        allLabels.add(r.label);
        expandedTerms.push(r.label);
      }
    }
  }

  const expandedQuery = [query, ...allLabels].join(" ");
  return { expandedQuery, expandedTerms: [...new Set(expandedTerms)] };
}

/* ------------------------------------------------------------------ */
/*  Lexical Search  (Atlas Search $search)                             */
/* ------------------------------------------------------------------ */

export async function lexicalSearch({ query, filters, source, taxonomyExpansion, ontologyExpansion }) {
  const db = getDb();
  const coll = db.collection(collectionName(source));

  let searchQuery = query;
  let expandedTerms = [];

  if (taxonomyExpansion || ontologyExpansion) {
    const expansion = await expandQueryWithTaxonomy(query, { taxonomy: taxonomyExpansion, ontology: ontologyExpansion });
    searchQuery = expansion.expandedQuery;
    expandedTerms = expansion.expandedTerms;
  }

  const pipeline = [
    {
      $search: {
        index: "default",
        text: {
          query: searchQuery,
          path: [
            "documentTitle",
            "metadata.searchtopic",
            "metadata.contentcategory",
            "metadata.serviceline",
            "metadata.focus",
          ],
          fuzzy: { maxEdits: 1 },
        },
      },
    },
    { $addFields: { score: { $meta: "searchScore" } } },
    { $limit: 50 },
  ];

  const preFilter = buildFilter(filters);
  if (Object.keys(preFilter).length) {
    pipeline.splice(1, 0, { $match: preFilter });
  }

  const results = await coll.aggregate(pipeline).toArray();
  return { results, pipeline, expandedTerms };
}

/* ------------------------------------------------------------------ */
/*  Vector Search  (Atlas $vectorSearch)                                */
/* ------------------------------------------------------------------ */

export async function vectorSearch({ query, filters, source, taxonomyExpansion, ontologyExpansion }) {
  const db = getDb();
  const coll = db.collection(collectionName(source));

  let embedText = query;
  let expandedTerms = [];

  if (taxonomyExpansion || ontologyExpansion) {
    const expansion = await expandQueryWithTaxonomy(query, { taxonomy: taxonomyExpansion, ontology: ontologyExpansion });
    embedText = expansion.expandedQuery;
    expandedTerms = expansion.expandedTerms;
  }

  const queryVector = await embedQuery(embedText);

  const pipeline = [
    {
      $vectorSearch: {
        index: "vector_index",
        path: "embedding",
        queryVector,
        numCandidates: 100,
        limit: 50,
      },
    },
    { $addFields: { score: { $meta: "vectorSearchScore" } } },
  ];

  const postFilter = buildFilter(filters);
  if (Object.keys(postFilter).length) {
    pipeline.push({ $match: postFilter });
  }

  const results = await coll.aggregate(pipeline).toArray();

  // Return pipeline with vector placeholder for display
  const displayPipeline = pipeline.map((stage) => {
    if (stage.$vectorSearch) {
      return { $vectorSearch: { ...stage.$vectorSearch, queryVector: `<float[${queryVector.length}]>` } };
    }
    return stage;
  });

  return { results, pipeline: displayPipeline, expandedTerms };
}

/* ------------------------------------------------------------------ */
/*  Hybrid Search  (MongoDB native $rankFusion)                        */
/* ------------------------------------------------------------------ */

export async function hybridSearch({ query, filters, source, taxonomyExpansion, ontologyExpansion }) {
  const db = getDb();
  const coll = db.collection(collectionName(source));

  let searchQuery = query;
  let expandedTerms = [];

  if (taxonomyExpansion || ontologyExpansion) {
    const expansion = await expandQueryWithTaxonomy(query, { taxonomy: taxonomyExpansion, ontology: ontologyExpansion });
    searchQuery = expansion.expandedQuery;
    expandedTerms = expansion.expandedTerms;
  }

  const queryVector = await embedQuery(searchQuery);

  const textPaths = [
    "documentTitle",
    "metadata.searchtopic",
    "metadata.contentcategory",
    "metadata.serviceline",
    "metadata.focus",
  ];

  const pipeline = [
    {
      $rankFusion: {
        input: {
          pipelines: {
            vector: [
              {
                $vectorSearch: {
                  index: "vector_index",
                  path: "embedding",
                  queryVector,
                  numCandidates: 150,
                  limit: 50,
                },
              },
            ],
            text: [
              {
                $search: {
                  index: "default",
                  compound: {
                    should: [
                      // Exact phrase matching (highest priority)
                      ...textPaths.map((p) => ({
                        phrase: {
                          query: searchQuery,
                          path: p,
                          score: { boost: { value: p === "documentTitle" ? 10 : 8 } },
                        },
                      })),
                      // Individual word matching (medium priority)
                      ...textPaths.map((p) => ({
                        text: {
                          query: searchQuery,
                          path: p,
                          score: { boost: { value: p === "documentTitle" ? 5 : 4 } },
                        },
                      })),
                      // Fuzzy matching (lowest priority)
                      ...textPaths.map((p) => ({
                        text: {
                          query: searchQuery,
                          path: p,
                          fuzzy: { maxEdits: 1, prefixLength: 3 },
                          score: { boost: { value: p === "documentTitle" ? 2 : 1.5 } },
                        },
                      })),
                    ],
                  },
                },
              },
            ],
          },
        },
        combination: {
          weights: {
            vector: 0.5,
            text: 0.5,
          },
        },
        scoreDetails: true,
      },
    },
    { $limit: 50 },
    {
      $addFields: {
        score: { $meta: "score" },
        score_details: { $meta: "scoreDetails" },
      },
    },
  ];

  const postFilter = buildFilter(filters);
  if (Object.keys(postFilter).length) {
    pipeline.push({ $match: postFilter });
  }

  const results = await coll.aggregate(pipeline).toArray();

  // Build display pipeline with vector placeholder
  const displayPipeline = JSON.parse(JSON.stringify(pipeline, (key, value) => {
    if (key === "queryVector") return `<float[${queryVector.length}]>`;
    return value;
  }));

  return { results, pipeline: displayPipeline, expandedTerms };
}

/* ------------------------------------------------------------------ */
/*  Hybrid Graph Search  (Vector → Graph Expansion via $facet)         */
/* ------------------------------------------------------------------ */

export async function hybridGraphSearch({ query, filters, source, taxonomyExpansion, ontologyExpansion }) {
  const db = getDb();
  const coll = db.collection(collectionName(source));

  let embedText = query;
  let expandedTerms = [];

  if (taxonomyExpansion || ontologyExpansion) {
    const expansion = await expandQueryWithTaxonomy(query, { taxonomy: taxonomyExpansion, ontology: ontologyExpansion });
    embedText = expansion.expandedQuery;
    expandedTerms = expansion.expandedTerms;
  }

  const queryVector = await embedQuery(embedText);

  const pipeline = [
    // Step 1: Vector search for exactly 5 seed documents
    {
      $vectorSearch: {
        index: "vector_index",
        path: "embedding",
        queryVector,
        numCandidates: 50,
        limit: 5,
      },
    },
    // Step 2: $facet splits into two parallel processing paths
    {
      $facet: {
        // Path A: Preserve original 5 seeds exactly as-is
        seeds: [
          {
            $addFields: {
              source: "vector_seed",
              depth: 0,
              score: { $meta: "vectorSearchScore" },
              seed_id: "$_id",
            },
          },
        ],
        // Path B: Graph expansion from seeds
        expansion: [
          { $group: { _id: null, seed_ids: { $push: "$_id" }, seed_docs: { $push: "$$ROOT" } } },
          { $unwind: "$seed_docs" },
          { $replaceRoot: { newRoot: "$seed_docs" } },
          {
            $graphLookup: {
              from: collectionName(source),
              startWith: "$connections.targetID",
              connectFromField: "connections.targetID",
              connectToField: "_id",
              as: "graph_neighbors",
              maxDepth: 4,
              depthField: "traversal_depth",
            },
          },
          { $project: { neighbors: "$graph_neighbors" } },
          { $unwind: "$neighbors" },
          { $replaceRoot: { newRoot: "$neighbors" } },
          {
            $addFields: {
              source: "graph_expansion",
              depth: { $add: [{ $ifNull: ["$traversal_depth", 0] }, 1] },
              score: {
                $subtract: [
                  0.5,
                  { $multiply: [0.1, { $add: [{ $ifNull: ["$traversal_depth", 0] }, 1] }] },
                ],
              },
            },
          },
          // Deduplicate expanded results
          {
            $group: {
              _id: "$_id",
              doc: { $first: "$$ROOT" },
              max_score: { $max: "$score" },
              min_depth: { $min: "$depth" },
            },
          },
          {
            $replaceRoot: {
              newRoot: {
                $mergeObjects: ["$doc", { score: "$max_score", depth: "$min_depth" }],
              },
            },
          },
          { $sort: { score: -1, depth: 1 } },
          { $limit: 60 },
        ],
      },
    },
    // Step 3: Build seed_ids list for exclusion
    {
      $project: {
        seeds: 1,
        expansion: 1,
        seed_ids: { $map: { input: "$seeds", as: "seed", in: "$$seed._id" } },
      },
    },
    // Step 4: Filter expansion to exclude seed IDs (prevent duplicates)
    {
      $project: {
        seeds: 1,
        filtered_expansion: {
          $filter: {
            input: "$expansion",
            as: "exp",
            cond: { $not: { $in: ["$$exp._id", "$seed_ids"] } },
          },
        },
      },
    },
    // Step 5: Limit expanded results
    {
      $project: {
        seeds: 1,
        filtered_expansion: { $slice: ["$filtered_expansion", 25] },
      },
    },
    // Step 6: Combine seeds (always 5) + filtered expansion
    {
      $project: {
        combined: { $concatArrays: ["$seeds", "$filtered_expansion"] },
      },
    },
    { $unwind: "$combined" },
    { $replaceRoot: { newRoot: "$combined" } },
    // Remove internal fields from final output
    { $project: { seed_id: 0, graph_neighbors: 0, traversal_depth: 0 } },
  ];

  const postFilter = buildFilter(filters);
  if (Object.keys(postFilter).length) {
    pipeline.push({ $match: postFilter });
  }

  const results = await coll.aggregate(pipeline).toArray();

  // Build display pipeline with vector placeholder
  const displayPipelineHG = JSON.parse(JSON.stringify(pipeline, (key, value) => {
    if (key === "queryVector") return `<float[${queryVector.length}]>`;
    return value;
  }));

  return { results, pipeline: displayPipelineHG, expandedTerms };
}
