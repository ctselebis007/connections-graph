import express from "express";
import cors from "cors";
import setupRoutes from "./routes/setup.js";
import searchRoutes from "./routes/search.js";
import agentRoutes from "./routes/agents.js";
import taxonomyRoutes from "./routes/taxonomy.js";

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.use("/api/setup", setupRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api/taxonomy", taxonomyRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Global error handler — always return JSON
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
