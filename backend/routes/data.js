// backend/routes/data.js
import { Router } from "express";
import User from "../models/User.js";

const router = Router();

/**
 * GET /api/data
 * Returns { exercises, groups, settings } for the current user (or guest).
 */
router.get("/", async (req, res) => {
  try {
    const user = await User.findOne({ sub: req.user.sub });
    if (!user) {
      return res.json({ exercises: [], groups: [], settings: {} });
    }
    return res.json({
      exercises: user.exercises,
      groups: user.groups,
      settings: user.settings,
    });
  } catch (err) {
    console.error("GET /api/data error:", err);
    return res.status(500).json({ error: "internal" });
  }
});

/**
 * PUT /api/data
 * Full state replacement — the frontend sends the complete
 * { exercises, groups, settings } object on every mutation.
 * This keeps the backend dead-simple (no partial PATCH logic).
 */
router.put("/", async (req, res) => {
  try {
    const { exercises, groups, settings } = req.body;

    const update = {};
    if (Array.isArray(exercises)) update.exercises = exercises;
    if (Array.isArray(groups)) update.groups = groups;
    if (settings && typeof settings === "object") update.settings = settings;

    const user = await User.findOneAndUpdate(
      { sub: req.user.sub },
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.json({
      exercises: user.exercises,
      groups: user.groups,
      settings: user.settings,
    });
  } catch (err) {
    console.error("PUT /api/data error:", err);
    return res.status(500).json({ error: "internal" });
  }
});

export default router;
