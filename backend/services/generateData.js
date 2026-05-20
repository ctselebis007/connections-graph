/**
 * Generates a rich, randomized but internally-consistent dataset
 * for the Graph Connections application.
 *
 * All nodes get full titles, metadata, and meaningful connections.
 */

import crypto from "crypto";

/* ------------------------------------------------------------------ */
/*  Reference data (realistic EY / audit domain vocabulary)            */
/* ------------------------------------------------------------------ */

const COLLECTIONS = [
  { id: "C_10001", name: "IFRS Standards" },
  { id: "C_10002", name: "US GAAP Guidance" },
  { id: "C_10003", name: "Audit Methodology" },
  { id: "C_10004", name: "Tax Compliance" },
  { id: "C_10005", name: "Risk Assessment" },
  { id: "C_10006", name: "Internal Controls" },
  { id: "C_10007", name: "Data Analytics" },
  { id: "C_10008", name: "Regulatory Updates" },
  { id: "C_10009", name: "Training Materials" },
  { id: "C_10010", name: "Quality & Review" },
];

const CHANNELS = [
  { id: 20001, name: "Global Audit" },
  { id: 20002, name: "Americas" },
  { id: 20003, name: "EMEIA" },
  { id: 20004, name: "Asia-Pacific" },
  { id: 20005, name: "Advisory" },
  { id: 30001, name: "Tax" },
  { id: 30002, name: "Assurance" },
  { id: 30003, name: "Consulting" },
];

const LANGUAGES = [
  { id: 1, name: "English" },
  { id: 2, name: "Spanish" },
  { id: 3, name: "French" },
  { id: 4, name: "German" },
  { id: 5, name: "Portuguese" },
  { id: 6, name: "Chinese" },
  { id: 7, name: "Japanese" },
];

const SERVICE_LINES = [
  "Audit and Accounting Services",
  "Tax Services",
  "Advisory Services",
  "Consulting Services",
  "Strategy and Transactions",
  "Forensic & Integrity Services",
];

const FOCUS_AREAS = [
  "IFRS", "US GAAP", "Auditing", "Revenue Recognition",
  "Lease Accounting", "Financial Instruments", "Consolidation",
  "Impairment", "Fair Value", "Tax Reporting", "Transfer Pricing",
  "Cybersecurity", "Data Privacy", "ESG Reporting", "Sustainability",
  "Anti-Money Laundering", "Internal Audit", "Risk Management",
];

const CONTENT_CATEGORIES = [
  "External Standards, Regulations and Guidance",
  "EY Enablement",
  "EY Methodology",
  "Practice Guide",
  "Client Alert",
  "Technical Update",
  "Training Module",
  "Template",
  "Checklist",
  "Reference Material",
];

const ORGANIZATIONS = [
  "EY (Global)", "EY (US)", "EY (UK)", "EY (Germany)", "EY (France)",
  "EY (Netherlands)", "EY (Japan)", "EY (Australia)", "EY (Canada)",
  "EY (Brazil)", "EY (India)", "EY (China)", "EY (Singapore)",
  "IASB", "FASB", "PCAOB", "AICPA", "SEC",
];

const LINK_TYPES = ["Cross Reference", "Image Link", "Resource Link"];

/* ------------------------------------------------------------------ */
/*  Taxonomy tree definition                                           */
/* ------------------------------------------------------------------ */

const TAXONOMY_TREE = [
  {
    _id: "T_ROOT", label: "Knowledge Base", type: "category", children: [
      {
        _id: "T_AUDIT", label: "Audit & Assurance", type: "category",
        properties: { jurisdiction: "Global", applicability: "All audit engagements" },
        children: [
          {
            _id: "T_REVREC", label: "Revenue Recognition", type: "topic",
            properties: { jurisdiction: "Global", effectiveDateStart: "2018-01-01" },
            children: [
              { _id: "T_IFRS15", label: "IFRS 15", type: "standard", properties: { jurisdiction: "International", effectiveDateStart: "2018-01-01", issuingBody: "IASB" } },
              { _id: "T_ASC606", label: "ASC 606", type: "standard", properties: { jurisdiction: "United States", effectiveDateStart: "2018-01-01", issuingBody: "FASB" } },
            ],
          },
          {
            _id: "T_LEASE", label: "Lease Accounting", type: "topic",
            properties: { jurisdiction: "Global", effectiveDateStart: "2019-01-01" },
            children: [
              { _id: "T_ASC842", label: "ASC 842", type: "standard", properties: { jurisdiction: "United States", effectiveDateStart: "2019-01-01", issuingBody: "FASB" } },
              { _id: "T_IFRS16", label: "IFRS 16", type: "standard", properties: { jurisdiction: "International", effectiveDateStart: "2019-01-01", issuingBody: "IASB" } },
            ],
          },
          {
            _id: "T_FAIRVAL", label: "Fair Value", type: "topic",
            properties: { jurisdiction: "Global" },
            children: [
              { _id: "T_ISA540", label: "ISA 540", type: "standard", properties: { jurisdiction: "International", issuingBody: "IAASB" } },
            ],
          },
          { _id: "T_INTCTRL", label: "Internal Controls", type: "topic", properties: { jurisdiction: "Global" } },
          { _id: "T_FININSTR", label: "Financial Instruments", type: "topic", properties: { jurisdiction: "Global" } },
          { _id: "T_IMPAIRMENT", label: "Impairment", type: "topic", properties: { jurisdiction: "Global" } },
          { _id: "T_CONSOLIDATION", label: "Consolidation", type: "topic", properties: { jurisdiction: "Global" } },
        ],
      },
      {
        _id: "T_TAX", label: "Tax", type: "category",
        properties: { jurisdiction: "Global", applicability: "Tax engagements" },
        children: [
          { _id: "T_TRANSPRICE", label: "Transfer Pricing", type: "topic", properties: { jurisdiction: "Global" } },
          { _id: "T_INTTAX", label: "International Tax", type: "topic", properties: { jurisdiction: "Global" } },
          { _id: "T_TAXREPORT", label: "Tax Reporting", type: "topic", properties: { jurisdiction: "Global" } },
        ],
      },
      {
        _id: "T_ADVISORY", label: "Advisory", type: "category",
        properties: { jurisdiction: "Global", applicability: "Advisory engagements" },
        children: [
          { _id: "T_RISKMGMT", label: "Risk Management", type: "topic", properties: { jurisdiction: "Global" } },
          { _id: "T_CYBER", label: "Cybersecurity", type: "topic", properties: { jurisdiction: "Global" } },
          { _id: "T_ESG", label: "ESG & Sustainability", type: "topic", properties: { jurisdiction: "Global", effectiveDateStart: "2024-01-01" } },
          { _id: "T_PRIVACY", label: "Data Privacy", type: "topic", properties: { jurisdiction: "EU", applicability: "GDPR-scope entities" } },
          { _id: "T_AML", label: "Anti-Money Laundering", type: "topic", properties: { jurisdiction: "Global" } },
        ],
      },
      {
        _id: "T_STANDARDS", label: "Standards & Regulation", type: "category",
        properties: { jurisdiction: "Global" },
        children: [
          { _id: "T_IFRS", label: "IFRS Standards", type: "topic", properties: { jurisdiction: "International", issuingBody: "IASB" } },
          { _id: "T_USGAAP", label: "US GAAP Standards", type: "topic", properties: { jurisdiction: "United States", issuingBody: "FASB" } },
          { _id: "T_ISA", label: "ISA Standards", type: "topic", properties: { jurisdiction: "International", issuingBody: "IAASB" } },
        ],
      },
      {
        _id: "T_TECH", label: "Technology", type: "category",
        properties: { jurisdiction: "Global" },
        children: [
          { _id: "T_DATAANALYTICS", label: "Data Analytics", type: "topic", properties: { jurisdiction: "Global" } },
          { _id: "T_AIAUTO", label: "AI & Automation", type: "topic", properties: { jurisdiction: "Global" } },
        ],
      },
    ],
  },
];

/**
 * Ontology relationships beyond parent-child.
 * Each entry: [sourceID, targetID, relationshipType]
 */
const ONTOLOGY_RELATIONSHIPS = [
  // is-a: IFRS 15 is a type of IFRS Standard
  ["T_IFRS15", "T_IFRS", "is-a"],
  ["T_IFRS16", "T_IFRS", "is-a"],
  ["T_ASC606", "T_USGAAP", "is-a"],
  ["T_ASC842", "T_USGAAP", "is-a"],
  ["T_ISA540", "T_ISA", "is-a"],

  // part-of: Revenue Recognition is part of Audit
  ["T_REVREC", "T_AUDIT", "part-of"],
  ["T_LEASE", "T_AUDIT", "part-of"],
  ["T_FAIRVAL", "T_AUDIT", "part-of"],
  ["T_INTCTRL", "T_AUDIT", "part-of"],

  // applies-to: ISA 540 applies to Fair Value
  ["T_ISA540", "T_FAIRVAL", "applies-to"],
  ["T_INTCTRL", "T_RISKMGMT", "applies-to"],
  ["T_CYBER", "T_PRIVACY", "applies-to"],
  ["T_ESG", "T_RISKMGMT", "applies-to"],
  ["T_DATAANALYTICS", "T_AUDIT", "applies-to"],
  ["T_AIAUTO", "T_DATAANALYTICS", "applies-to"],

  // supersedes: ASC 606 supersedes older revenue standards (conceptual)
  ["T_ASC606", "T_REVREC", "supersedes"],
  ["T_IFRS15", "T_REVREC", "supersedes"],
  ["T_ASC842", "T_LEASE", "supersedes"],
  ["T_IFRS16", "T_LEASE", "supersedes"],

  // governed-by: Transfer Pricing governed by International Tax
  ["T_TRANSPRICE", "T_INTTAX", "governed-by"],
  ["T_AML", "T_RISKMGMT", "governed-by"],
  ["T_PRIVACY", "T_ADVISORY", "governed-by"],
  ["T_TAXREPORT", "T_TAX", "governed-by"],
];

/**
 * Map from metadata focus/searchtopic values to taxonomy concept IDs.
 * Each document gets tagged based on its metadata.
 */
const FOCUS_TO_CONCEPTS = {
  "IFRS": ["T_IFRS", "T_AUDIT"],
  "US GAAP": ["T_USGAAP", "T_AUDIT"],
  "Auditing": ["T_AUDIT"],
  "Revenue Recognition": ["T_REVREC"],
  "Lease Accounting": ["T_LEASE"],
  "Financial Instruments": ["T_FININSTR"],
  "Consolidation": ["T_CONSOLIDATION"],
  "Impairment": ["T_IMPAIRMENT"],
  "Fair Value": ["T_FAIRVAL"],
  "Tax Reporting": ["T_TAXREPORT", "T_TAX"],
  "Transfer Pricing": ["T_TRANSPRICE", "T_TAX"],
  "Cybersecurity": ["T_CYBER", "T_ADVISORY"],
  "Data Privacy": ["T_PRIVACY", "T_ADVISORY"],
  "ESG Reporting": ["T_ESG"],
  "Sustainability": ["T_ESG"],
  "Anti-Money Laundering": ["T_AML", "T_ADVISORY"],
  "Internal Audit": ["T_INTCTRL", "T_AUDIT"],
  "Risk Management": ["T_RISKMGMT", "T_ADVISORY"],
};

const TOPIC_TO_CONCEPTS = {
  "IFRS 15 Revenue": ["T_IFRS15", "T_REVREC"],
  "IFRS 16 Leases": ["T_IFRS16", "T_LEASE"],
  "IFRS 9 Financial Instruments": ["T_FININSTR", "T_IFRS"],
  "IFRS 3 Business Combinations": ["T_IFRS"],
  "IFRS 17 Insurance": ["T_IFRS"],
  "IAS 36 Impairment": ["T_IMPAIRMENT", "T_IFRS"],
  "IAS 19 Employee Benefits": ["T_IFRS"],
  "IAS 21 Foreign Currency": ["T_IFRS"],
  "IAS 12 Income Taxes": ["T_TAXREPORT", "T_IFRS"],
  "ASC 606 Revenue": ["T_ASC606", "T_REVREC"],
  "ASC 842 Leases": ["T_ASC842", "T_LEASE"],
  "ASC 326 Credit Losses": ["T_USGAAP"],
  "SOX Compliance": ["T_INTCTRL"],
  "PCAOB Standards": ["T_ISA", "T_AUDIT"],
  "ISA 540 Estimates": ["T_ISA540", "T_FAIRVAL"],
  "ISA 315 Risk Assessment": ["T_ISA", "T_RISKMGMT"],
  "ISA 330 Audit Responses": ["T_ISA", "T_AUDIT"],
  "ISQM 1 Quality": ["T_ISA", "T_AUDIT"],
  "ESG Reporting": ["T_ESG"],
  "Sustainability": ["T_ESG"],
  "Climate Risk": ["T_ESG", "T_RISKMGMT"],
  "Cybersecurity Audit": ["T_CYBER", "T_AUDIT"],
  "Transfer Pricing": ["T_TRANSPRICE"],
  "Tax Reform": ["T_TAX"],
  "Digital Transformation": ["T_TECH", "T_DATAANALYTICS"],
};

const DOC_TITLE_PREFIXES = [
  "Guide to", "Overview of", "Implementing", "Understanding",
  "Analysis of", "Framework for", "Procedures for", "Standards on",
  "Requirements for", "Best Practices in", "Introduction to",
  "Advanced Topics in", "Updates to", "Amendments to", "Supplement to",
];

const DOC_TITLE_SUBJECTS = [
  "Revenue Recognition under IFRS 15",
  "Lease Accounting (IFRS 16 / ASC 842)",
  "Expected Credit Loss Models",
  "Consolidation Procedures",
  "Business Combinations (IFRS 3)",
  "Fair Value Measurement",
  "Financial Instrument Classification",
  "Impairment of Non-Financial Assets",
  "Employee Benefits and Pensions",
  "Share-Based Payment Transactions",
  "Foreign Currency Translation",
  "Segment Reporting Standards",
  "Related Party Disclosures",
  "Interim Financial Reporting",
  "Going Concern Assessments",
  "Audit Sampling Methodology",
  "Substantive Analytical Procedures",
  "Internal Control Testing",
  "IT General Controls Review",
  "Data Analytics in Auditing",
  "Group Audit Coordination",
  "Key Audit Matters Reporting",
  "Risk Assessment Procedures",
  "Fraud Risk Identification",
  "Transfer Pricing Documentation",
  "Tax Provision Calculations",
  "Deferred Tax Asset Recognition",
  "Multi-Jurisdiction Tax Compliance",
  "ESG Reporting Frameworks",
  "Climate Risk Disclosures",
  "Sustainability Assurance Standards",
  "Cybersecurity Risk Assessment",
  "Data Privacy Compliance (GDPR)",
  "Anti-Money Laundering Controls",
  "Whistleblower Program Design",
  "Quality Management Standards (ISQM 1)",
  "Engagement Quality Review",
  "Professional Skepticism",
  "Audit Evidence Evaluation",
  "Accounting Estimates and Uncertainty",
  "Insurance Contracts (IFRS 17)",
  "Extractive Industries Accounting",
  "Agriculture and Biological Assets",
  "Government Grant Accounting",
  "Inventory Valuation Methods",
  "Property Plant and Equipment",
  "Intangible Asset Recognition",
  "Provisions and Contingencies",
  "Events After Reporting Period",
  "First-Time IFRS Adoption",
];

const SEARCH_TOPICS = [
  "IFRS 15 Revenue", "IFRS 16 Leases", "IFRS 9 Financial Instruments",
  "IFRS 3 Business Combinations", "IFRS 17 Insurance", "IAS 36 Impairment",
  "IAS 19 Employee Benefits", "IAS 21 Foreign Currency", "IAS 12 Income Taxes",
  "ASC 606 Revenue", "ASC 842 Leases", "ASC 326 Credit Losses",
  "SOX Compliance", "PCAOB Standards", "ISA 540 Estimates",
  "ISA 315 Risk Assessment", "ISA 330 Audit Responses", "ISQM 1 Quality",
  "ESG Reporting", "Sustainability", "Climate Risk", "Cybersecurity Audit",
  "Transfer Pricing", "Tax Reform", "Digital Transformation",
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN(arr, min, max) {
  const n = min + Math.floor(Math.random() * (max - min + 1));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function uuid() {
  return crypto.randomUUID();
}

function randomDate(startYear = 2018, endYear = 2025) {
  const start = new Date(startYear, 0, 1).getTime();
  const end = new Date(endYear, 11, 31).getTime();
  const d = new Date(start + Math.random() * (end - start));
  return d.toISOString().split("T")[0];
}

function randomDateTimeFull() {
  const d = randomDate();
  const h = String(Math.floor(Math.random() * 24)).padStart(2, "0");
  const m = String(Math.floor(Math.random() * 60)).padStart(2, "0");
  const s = String(Math.floor(Math.random() * 60)).padStart(2, "0");
  return `${d} ${h}:${m}:${s}`;
}

/* ------------------------------------------------------------------ */
/*  Node generation                                                    */
/* ------------------------------------------------------------------ */

function generateNode(id, collection) {
  const title = `${pick(DOC_TITLE_PREFIXES)} ${pick(DOC_TITLE_SUBJECTS)}`;
  const channels = pickN(CHANNELS, 1, 3);
  const languages = pickN(LANGUAGES, 1, 2);
  const focus = pick(FOCUS_AREAS);
  const serviceline = pick(SERVICE_LINES);
  const org = pick(ORGANIZATIONS);
  const category = pick(CONTENT_CATEGORIES);
  const topic = pick(SEARCH_TOPICS);
  const pubDate = randomDate();
  const verDate = randomDateTimeFull();

  // Derive conceptIDs from focus area and search topic
  const conceptSet = new Set();
  const focusConcepts = FOCUS_TO_CONCEPTS[focus] || [];
  const topicConcepts = TOPIC_TO_CONCEPTS[topic] || [];
  for (const c of focusConcepts) conceptSet.add(c);
  for (const c of topicConcepts) conceptSet.add(c);
  // Ensure at least one concept
  if (conceptSet.size === 0) conceptSet.add("T_ROOT");

  return {
    _id: id,
    documentTitle: title,
    internalID: uuid(),
    collectionIDs: [collection.id],
    channelIDs: channels.map((c) => c.id),
    languageIDs: languages.map((l) => l.id),
    nodePath: `${collection.id}/${id}`,
    conceptIDs: [...conceptSet],
    metadata: {
      access: Math.random() > 0.2 ? "Yes" : "No",
      contentcategory: category,
      documentstatus: pick(["Final", "Draft", "Under Review", "Archived"]),
      effectivedate: pubDate,
      eyid: String(100000000 + Math.floor(Math.random() * 900000000)),
      focus,
      indexforsearch: "Yes",
      issuingorganization: org,
      language: languages[0].name,
      majorpublicationdate: `${pubDate} 00:00:00`,
      majorpublicationflag: Math.random() > 0.7 ? "Yes" : "No",
      objecttypeid: String(pick([100, 200, 300, 400])),
      parentcollectionid: collection.id,
      searchtopic: topic,
      serviceline,
      topicbestbet: topic,
      versiondate: verDate,
      versionsetid: id,
      versionstatus: pick(["Released", "Pending", "Superseded"]),
    },
    embedding: [],
  };
}

/* ------------------------------------------------------------------ */
/*  Edge generation — builds a connected graph                         */
/* ------------------------------------------------------------------ */

function generateEdges(nodes) {
  const edges = [];
  const nodeIds = nodes.map((n) => n._id);
  const edgeSet = new Set();

  // 1. Ensure every node has at least one connection (spanning tree)
  for (let i = 1; i < nodeIds.length; i++) {
    const sourceIdx = Math.floor(Math.random() * i);
    const sourceID = nodeIds[sourceIdx];
    const targetID = nodeIds[i];
    const key = `${sourceID}->${targetID}`;
    edgeSet.add(key);

    const srcNode = nodes[sourceIdx];
    edges.push({
      sourceID,
      targetID,
      linkType: "Cross Reference",
      channelID: srcNode.channelIDs[0],
      languageID: srcNode.languageIDs[0],
      collectionID: srcNode.collectionIDs[0],
      documentTitle: srcNode.documentTitle,
    });
  }

  // 2. Add extra cross-references within same collection (clustering)
  const byCollection = new Map();
  for (const n of nodes) {
    const cid = n.collectionIDs[0];
    if (!byCollection.has(cid)) byCollection.set(cid, []);
    byCollection.get(cid).push(n);
  }

  for (const [, group] of byCollection) {
    const extraCount = Math.floor(group.length * 1.5);
    for (let i = 0; i < extraCount; i++) {
      const src = pick(group);
      const tgt = pick(group);
      if (src._id === tgt._id) continue;
      const key = `${src._id}->${tgt._id}`;
      if (edgeSet.has(key)) continue;
      edgeSet.add(key);

      edges.push({
        sourceID: src._id,
        targetID: tgt._id,
        linkType: pick(LINK_TYPES),
        channelID: src.channelIDs[0],
        languageID: src.languageIDs[0],
        collectionID: src.collectionIDs[0],
        documentTitle: src.documentTitle,
      });
    }
  }

  // 3. Add cross-collection links (10-15% of nodes link to another collection)
  const crossCount = Math.floor(nodeIds.length * 0.12);
  for (let i = 0; i < crossCount; i++) {
    const src = pick(nodes);
    const tgt = pick(nodes);
    if (src._id === tgt._id) continue;
    if (src.collectionIDs[0] === tgt.collectionIDs[0]) continue;
    const key = `${src._id}->${tgt._id}`;
    if (edgeSet.has(key)) continue;
    edgeSet.add(key);

    edges.push({
      sourceID: src._id,
      targetID: tgt._id,
      linkType: pick(["Cross Reference", "Resource Link"]),
      channelID: src.channelIDs[0],
      languageID: src.languageIDs[0],
      collectionID: src.collectionIDs[0],
      documentTitle: src.documentTitle,
    });
  }

  return edges;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Generate a complete dataset with `nodeCount` nodes distributed
 * across collections, plus a rich set of edges.
 */
export function generateDataset(nodeCount = 120) {
  const nodes = [];
  const nodesPerCollection = Math.ceil(nodeCount / COLLECTIONS.length);
  let idCounter = 500000;

  for (const collection of COLLECTIONS) {
    for (let i = 0; i < nodesPerCollection && nodes.length < nodeCount; i++) {
      const id = String(idCounter++);
      nodes.push(generateNode(id, collection));
    }
  }

  const edges = generateEdges(nodes);

  // Build deduped embedded connections for Approach A
  const embeddedMap = new Map();
  const embedKeySet = new Map();
  for (const e of edges) {
    if (!embeddedMap.has(e.sourceID)) {
      embeddedMap.set(e.sourceID, []);
      embedKeySet.set(e.sourceID, new Set());
    }
    const key = `${e.targetID}|${e.linkType}`;
    if (!embedKeySet.get(e.sourceID).has(key)) {
      embedKeySet.get(e.sourceID).add(key);
      embeddedMap.get(e.sourceID).push({
        targetID: e.targetID,
        linkType: e.linkType,
      });
    }
  }

  // Build Approach A documents (nodes with embedded connections)
  const documents = nodes.map((n) => ({
    ...n,
    connections: embeddedMap.get(n._id) || [],
  }));

  // Approach B: nodes stay as-is, edges are separate
  const graphNodes = nodes.map(({ ...n }) => n);

  // Generate taxonomy
  const { taxonomyNodes, taxonomyEdges } = generateTaxonomy();

  return { documents, graphNodes, edges, taxonomyNodes, taxonomyEdges };
}

/* ------------------------------------------------------------------ */
/*  Taxonomy generation                                                */
/* ------------------------------------------------------------------ */

function generateTaxonomy() {
  const taxonomyNodes = [];
  const taxonomyEdges = [];

  function walk(items, parentId, level, parentPath) {
    for (const item of items) {
      const path = [...parentPath, item._id];
      taxonomyNodes.push({
        _id: item._id,
        label: item.label,
        description: "",
        type: item.type || "concept",
        level,
        path,
        taxonomySet: "audit",
        properties: item.properties || {},
        metadata: {
          source: "seed",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      if (parentId) {
        taxonomyEdges.push({
          sourceID: parentId,
          targetID: item._id,
          relationshipType: "parent-child",
          taxonomySet: "audit",
          metadata: { createdAt: new Date() },
        });
      }

      if (item.children) {
        walk(item.children, item._id, level + 1, path);
      }
    }
  }

  walk(TAXONOMY_TREE, null, 0, []);

  // Add ontology relationships (non-hierarchical)
  for (const [sourceID, targetID, relationshipType] of ONTOLOGY_RELATIONSHIPS) {
    taxonomyEdges.push({
      sourceID,
      targetID,
      relationshipType,
      taxonomySet: "audit",
      metadata: { createdAt: new Date() },
    });
  }

  return { taxonomyNodes, taxonomyEdges };
}
