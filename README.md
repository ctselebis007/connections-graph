# Graph Connections

A full-stack application for loading, searching, and visualizing graph-structured document data in MongoDB Atlas. Supports dual storage schemas, multiple search strategies (lexical, vector, hybrid with `$rankFusion`, and graph-expanded hybrid), and intelligent agents for document analysis.

## Quick Start

```bash
# Install everything
npm run install:all

# Run both frontend and backend
npm run dev:full
```

Open http://localhost:5175 → **Setup** page → enter MongoDB URI, DB name, embedding provider + API key → click buttons in order.

## Architecture

```
Frontend (React 19 + Vite + Tailwind + D3.js)     Backend (Express 5 + Node.js)
  ┌────────────────────────────────────┐           ┌──────────────────────────────────────┐
  │  Setup Page                        │──────────►│  /api/setup/*                        │
  │  • MongoDB URI / DB / API Key      │           │  • connect, seed, create indexes     │
  │  • Provider toggle (VoyageAI/OpenAI│           │  • create search & vector indexes    │
  │  • Seed DB, Create Indexes         │           │  • generate embeddings               │
  │  • Generate Embeddings             │           │  • status                            │
  │  • Status dashboard                │           │                                      │
  ├────────────────────────────────────┤           ├──────────────────────────────────────┤
  │  Search Page                       │──────────►│  /api/search/*                       │
  │  • Search bar + type selector      │           │  • lexical, vector                   │
  │  • Data source toggle (A / B)      │           │  • hybrid ($rankFusion)              │
  │  • Aggregation pipeline viewer     │           │  • hybrid-graph (vector → $facet)    │
  │  • Results table                   │           │  • graph/full, graph/neighbors       │
  │  • D3.js graph (force/tree/circle) │           │                                      │
  ├────────────────────────────────────┤           ├──────────────────────────────────────┤
  │  Agents Page                       │──────────►│  /api/agents/*                       │
  │  • Natural Language Query          │           │  • natural-language                  │
  │  • Document Impact                 │           │  • document-impact                   │
  │  • Cross-Reference Analyzer        │           │  • cross-reference-analyzer          │
  │  • Collection Explorer             │           │  • collection-explorer               │
  │  • Similarity Finder               │           │  • similarity-finder                 │
  │  • Critical Node / Hub Detection   │           │  • critical-node                     │
  │  • Stale Document Detector         │           │  • stale-document-detector           │
  │  Taxonomy Page                     │──────────►│  /api/taxonomy/*                     │
  │  • Tree view / Ontology graph view │           │  • CRUD nodes, edges, properties     │
  │  • Drag-drop reparenting           │           │  • ontology relationships CRUD       │
  │  • Properties editor               │           │  • inference (ancestor auto-tag)     │
  │  • Ontology relationship CRUD      │           │  • import/export (SKOS JSON-LD)      │
  │  • Import/Export (SKOS JSON-LD)    │           │  • concept-impact, gap-detector,     │
  │  • Create / Edit / Delete concepts │           │    relationship-suggester agents     │
  └────────────────────────────────────┘           └──────────┬───────────────────────────┘
                                                              │
                                                   ┌──────────┴─────────────────────────┐
                                                   │  MongoDB Atlas                     │
                                                   │  • documents      (Approach A)     │
                                                   │  • graph_nodes    (Approach B)     │
                                                   │  • graph_edges    (Approach B)     │
                                                   │  • taxonomy_nodes (Taxonomy)       │
                                                   │  • taxonomy_edges (Taxonomy)       │
                                                   │  • Atlas Search indexes            │
                                                   │  • Vector Search indexes           │
                                                   ├────────────────────────────────────┤
                                                   │  Embedding Providers               │
                                                   │  • VoyageAI (ai.mongodb.com proxy) │
                                                   │    └ voyage-4-lite (1024 dims)     │
                                                   │  • OpenAI                          │
                                                   │    └ text-embedding-ada-002 (1536d)│
                                                   └────────────────────────────────────┘
```

## Features

### Search Types

| Type | Description | Pipeline |
|------|-------------|----------|
| **Lexical** | Full-text search via Atlas Search `$search` with fuzzy matching | Single-stage `$search` with `text` operator |
| **Vector** | Semantic similarity via Atlas `$vectorSearch` | Embeds query → `$vectorSearch` on `embedding` field |
| **Hybrid ($rankFusion)** | Native MongoDB `$rankFusion` combining vector + text search | Weighted fusion (50/50) with compound `$search` (phrase, word, fuzzy at 3 boost tiers) |
| **Hybrid Graph** | Vector seeds → graph expansion via `$facet` | `$vectorSearch` (5 seeds) → `$facet` → `$graphLookup` (depth 5) → deduplicate → merge |

All search types support a **Data Source** toggle to query either the `documents` collection (Approach A) or `graph_nodes` (Approach B). A **Taxonomy & Ontology Expansion** toggle expands queries by traversing the full ontology graph — parent-child hierarchy plus all relationship types (is-a, part-of, applies-to, supersedes, governed-by). For example, searching "IFRS 15" also matches documents tagged with its parent "Revenue Recognition", related standards via is-a, and concepts it applies-to or supersedes. An **Aggregation Pipeline** toggle shows the exact MongoDB pipeline executed.

### Taxonomy & Ontology Management

A dedicated **Taxonomy & Ontology** page provides full management of the concept graph:

**Tree View (Phase 1):**
- **Collapsible tree view** — color-coded by type (category / topic / standard / concept)
- **Drag-and-drop reparenting** — move concepts between branches
- **Inline editing** — update label, description, and type
- **Create & delete** — add new concepts, delete with reparent-children or cascade-subtree options
- **Document tagging** — view documents tagged with each concept via `conceptIDs[]` field

**Ontology Graph View (Phase 2):**
- **D3.js force-directed graph** — visualizes all nodes and ALL relationship types (not just parent-child)
- **Color-coded edges** — each relationship type has a distinct color and dash pattern
- **Interactive** — drag nodes, zoom, pan, click to select
- **Legend** — shows node type colors and relationship type line styles

**Ontology Relationships (Phase 2):**
- **Additional edge types**: `is-a`, `part-of`, `applies-to`, `supersedes`, `governed-by` (beyond parent-child)
- **CRUD management** — create and delete ontology relationships from the concept detail panel
- **Bidirectional view** — see both outgoing and incoming relationships for each concept

**Concept Properties (Phase 2):**
- **Structured properties** — jurisdiction, effective dates, applicability, issuing body
- **Inline editing** — add, update, and remove key-value properties per concept

**Inference Rules (Phase 2):**
- **Auto-tag ancestors** — when tagging a document with a leaf concept, all ancestor concepts are automatically added via `tag-with-inference`

**Import/Export (Phase 2):**
- **SKOS JSON-LD export** — export the full taxonomy as W3C SKOS-compatible JSON-LD
- **SKOS JSON-LD import** — import and merge external taxonomies with automatic level/path recalculation

The taxonomy is seeded automatically with ~31 nodes covering the audit domain (Audit & Assurance, Tax, Advisory, Standards & Regulation, Technology) with 3–4 levels of depth, plus ~24 ontology relationships.

### Agents

| Agent | Input | What It Does |
|-------|-------|-------------|
| **Natural Language Query** | Free-text question | Lexical search for matching documents |
| **Document Impact** | Document ID + depth | `$graphLookup` outgoing + incoming edge analysis — blast radius of a document change |
| **Cross-Reference Analyzer** | None | Hub analysis, top targets, link type distribution, bidirectional links, orphan detection |
| **Collection Explorer** | Collection ID | All documents and internal edges within a collection |
| **Similarity Finder** | Text or Document ID | Vector search for semantically similar documents |
| **Critical Node / Hub Detection** | None | Degree centrality + bridge scoring across entire graph. Formula: `totalDegree×1 + bridgeCount×2 + linkTypeCount×0.5` |
| **Stale Document Detector** | Cutoff date (default: 2 years ago) | Finds released documents older than cutoff with high inbound references. Risk score: `inboundRefs × (1 + daysPastCutoff/365)` |
| **Concept Impact** *(Ontology)* | Concept ID | Finds all documents affected by a concept/standard change — follows descendants + ontology relationships (applies-to, governed-by, supersedes) |
| **Taxonomy Gap Detector** *(Ontology)* | None | Finds untagged documents, concepts with no documents, and poorly tagged documents (≤1 concept) |
| **Relationship Suggester** *(Ontology)* | Min co-occurrences (default: 3) | Suggests new ontology relationships based on concept co-occurrence patterns across documents |

### Graph Visualization

Interactive D3.js visualization with three layout modes:

- **Force** — force-directed layout with collision detection
- **Tree** — hierarchical tree from the first node
- **Circle** — radial layout around the center

Nodes are color-coded by collection. Edges are styled by link type (solid = Cross Reference, dashed = Image Link, dotted = Resource Link). Click any node to load its neighbors and see details.

## MongoDB Collections

### Approach A — `documents` (document-centric, embedded connections)

```json
{
  "_id": "500000",
  "documentTitle": "Guide to Revenue Recognition under IFRS 15",
  "collectionIDs": ["C_10001"],
  "channelIDs": [20001, 20002],
  "languageIDs": [1, 2],
  "conceptIDs": ["T_IFRS15", "T_REVREC"],
  "metadata": {
    "focus": "IFRS",
    "serviceline": "Audit and Accounting Services",
    "contentcategory": "External Standards, Regulations and Guidance",
    "searchtopic": "IFRS 15 Revenue",
    "versionstatus": "Released",
    "effectivedate": "2023-06-15",
    "versiondate": "2023-06-15 12:34:56"
  },
  "connections": [
    { "targetID": "500001", "linkType": "Cross Reference" }
  ],
  "embedding": [0.01, -0.03, ...]
}
```

### Approach B — `graph_nodes` + `graph_edges` (separate collections)

```json
// graph_nodes — same as above without connections array
{ "_id": "500000", "documentTitle": "...", "conceptIDs": [...], "metadata": {...}, "embedding": [...] }

// graph_edges — one document per edge
{
  "sourceID": "500000",
  "targetID": "500001",
  "linkType": "Cross Reference",
  "channelID": 20001,
  "collectionID": "C_10001"
}
```

### Taxonomy — `taxonomy_nodes` + `taxonomy_edges`

```json
// taxonomy_nodes — hierarchical concept tree with properties
{
  "_id": "T_IFRS15",
  "label": "IFRS 15",
  "description": "",
  "type": "standard",
  "level": 3,
  "path": ["T_ROOT", "T_AUDIT", "T_REVREC", "T_IFRS15"],
  "properties": {
    "jurisdiction": "International",
    "effectiveDateStart": "2018-01-01",
    "issuingBody": "IASB"
  },
  "metadata": { "source": "seed", "createdAt": "...", "updatedAt": "..." }
}

// taxonomy_edges — parent-child + ontology relationships
{
  "sourceID": "T_REVREC",
  "targetID": "T_IFRS15",
  "relationshipType": "parent-child",
  "metadata": { "createdAt": "..." }
}

// Ontology edge types: is-a, part-of, applies-to, supersedes, governed-by
{
  "sourceID": "T_IFRS15",
  "targetID": "T_IFRS",
  "relationshipType": "is-a",
  "metadata": { "createdAt": "..." }
}
```

## Project Structure

```
├── package.json                    # Root — npm run dev:full (concurrently)
├── backend/
│   ├── server.js                   # Express 5 entry point
│   ├── routes/
│   │   ├── setup.js                # Connect, seed, indexes, embeddings, status
│   │   ├── search.js               # Lexical, vector, hybrid, hybrid-graph, graph
│   │   ├── agents.js               # 7 analysis agents
│   │   └── taxonomy.js             # Taxonomy CRUD, tree, tag/untag
│   └── services/
│       ├── mongo.js                # MongoDB client singleton + config store
│       ├── seed.js                 # Seeds 5 collections from generated data
│       ├── generateData.js         # 120 randomized nodes, ~280 edges, ~30 taxonomy nodes
│       ├── embeddings.js           # Multi-provider: VoyageAI + OpenAI
│       ├── indexes.js              # DB, Atlas Search, Vector Search, and taxonomy indexes
│       ├── search.js               # Lexical, vector, hybrid ($rankFusion), hybrid-graph + taxonomy expansion
│       ├── graph.js                # $graphLookup (A), BFS traversal (B), full graph
│       └── taxonomy.js             # Taxonomy tree, CRUD, ontology relationships, inference, import/export, agents
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # React Router — 3 pages
│   │   ├── hooks/useApi.js         # Fetch wrapper for all API calls
│   │   ├── pages/
│   │   │   ├── SetupPage.jsx       # Connection form + action buttons + status
│   │   │   ├── SearchPage.jsx      # Search + graph visualization + taxonomy expansion
│   │   │   ├── AgentsPage.jsx      # Agent selector + I/O + graph viz (7 + 3 ontology agents)
│   │   │   └── TaxonomyPage.jsx    # Taxonomy tree + ontology graph + import/export
│   │   └── components/
│   │       ├── setup/              # ConnectionForm, ActionButton, StatusDashboard
│   │       ├── search/             # GraphVisualization (D3.js), ResultsTable, NodeDetail
│   │       └── taxonomy/           # TaxonomyTree, ConceptDetail, ConceptForm, OntologyGraph
│   └── vite.config.js              # Proxy /api → localhost:3005
└── Connections_sample.json         # Original Neo4j export (reference)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 6, Tailwind CSS 3.4, D3.js 7.9, React Router 7 |
| Backend | Express 5, Node.js |
| Database | MongoDB Atlas (Atlas Search + Vector Search) |
| Embeddings | VoyageAI (`voyage-4-lite`, 1024d) or OpenAI (`text-embedding-ada-002`, 1536d) |
| Dev tooling | concurrently (parallel dev servers) |

## Setup Flow

1. **Establish Connection** — Enter MongoDB URI, database name, choose embedding provider + API key
2. **Seed DB & Collections** — Generates 120 randomized documents across 10 collections with ~280 edges, plus ~30 taxonomy nodes in a 4-level hierarchy
3. **Create DB Indexes** — Standard indexes on `_id`, `collectionIDs`, `channelIDs`, etc.
4. **Create Search Indexes** — Atlas Search index (`default`) on text fields
5. **Create Vector Indexes** — Atlas Vector Search index (`vector_index`) on `embedding` field
6. **Generate Embeddings** — Calls the selected provider API to embed all documents

---