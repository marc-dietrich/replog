// backend/server.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";

import { authMiddleware } from "./middleware/auth.js";
import authRoutes from "./routes/auth.js";
import dataRoutes from "./routes/data.js";

const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI || "mongodb://mongo:27017/replog";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

const app = express();

// ---------- Middleware ----------
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

// Health check (unauthenticated)
app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", time: new Date().toISOString() })
);

// Auth routes need the middleware too (for guest_id cookie reading)
app.use("/api/auth", authMiddleware, authRoutes);
app.use("/api/data", authMiddleware, dataRoutes);

// ---------- Start ----------
async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`✓ MongoDB connected (${MONGO_URI})`);
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✓ RepLog API listening on :${PORT}`);
  });
}

start();
