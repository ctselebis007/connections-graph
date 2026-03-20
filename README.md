# Connections — graph

## Quick Start

```bash
# Terminal 1 — Backend
cd backend && npm install && npm run dev

# Terminal 2 — Frontend
cd frontend && npm install && npm run dev
```

Open http://localhost:5173 → **Setup** page → enter MongoDB URI, DB name, VoyageAI key → click buttons in order.

## Architecture

```
Frontend (React + Vite + Tailwind)         Backend (Express 5)
  ┌──────────────────────────┐             ┌──────────────────────────────┐
  │  Setup Page              │─────────►   │  /api/setup/*                │
  │  • Connection form       │             │  • connect, seed, indexes    │
  │  • Seed + index controls │             │  • generate embeddings       │
  │  • Status dashboard      │             │  • status                    │
  ├──────────────────────────┤             ├──────────────────────────────┤
  │  Search Page             │─────────►   │  /api/search/*               │
  │  • Search bar + filters  │             │  • universal, lexical,       │
  │  • Results table         │             │    vector, hybrid, graph     │
  │  • Graph viz (D3.js)     │             │  • graph/full, graph/neighbors│
  │  • Force / Tree / Circle │             │                              │
  ├──────────────────────────┤             ├──────────────────────────────┤
  │  Agents Page             │─────────►   │  /api/agents/*               │
  │  • Natural Language      │             │  • natural-language          │
  │  • Document Impact       │             │  • document-impact           │
  │  • Cross-Ref Analyzer    │             │  • cross-reference-analyzer  │
  │  • Collection Explorer   │             │  • collection-explorer       │
  │  • Similarity Finder     │             │  • similarity-finder         │
  └──────────────────────────┘             └──────────┬───────────────────┘
                                                      │
                                           ┌──────────┴───────────────────┐
                                           │  MongoDB Atlas               │
                                           │  • documents (Approach A)    │
                                           │  • graph_nodes (Approach B)  │
                                           │  • graph_edges (Approach B)  │
                                           │  • Atlas Search indexes      │
                                           │  • Vector Search indexes     │
                                           ├──────────────────────────────┤
                                           │  VoyageAI API                │
                                           │  • voyage-3-lite (512 dims)  │
                                           └──────────────────────────────┘
```

## MongoDB Collections

### Approach A — `documents` (document-centric, embedded connections)

```json
{
  "_id": "<ExternalID>",
  "documentTitle": "...",
  "internalID": "...",
  "collectionIDs": ["C_..."],
  "channelIDs": [30080],
  "languageIDs": [9],
  "nodePath": "...",
  "metadata": { "access": "No", "focus": "Local GAAP", ... },
  "connections": [
    { "targetID": "...", "linkType": "Cross Reference" }
  ],
  "embedding": [0.01, -0.03, ...]
}
```

### Approach B — `graph_nodes` + `graph_edges` (separate collections)

```json
// graph_nodes
{ "_id": "<ExternalID>", "documentTitle": "...", "metadata": {...}, "embedding": [...] }

// graph_edges
{ "sourceID": "519945", "targetID": "1480065", "linkType": "Cross Reference", "channelID": 30080 }
```

---