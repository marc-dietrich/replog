// backend/seed.js
// Seed the database with sample-data.json for a demo guest user.
import mongoose from "mongoose";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import User from "./models/User.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MONGO_URI = process.env.MONGO_URI || "mongodb://mongo:27017/replog";

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB for seeding");

  const raw = readFileSync(join(__dirname, "..", "frontend", "sample-data.json"), "utf-8");
  const data = JSON.parse(raw);

  const demoSub = "guest|demo-user";

  await User.findOneAndUpdate(
    { sub: demoSub },
    {
      $set: {
        provider: "guest",
        exercises: data.exercises,
        groups: data.groups,
        settings: data.settings,
      },
    },
    { upsert: true }
  );

  console.log(`✓ Seeded user "${demoSub}" with ${data.exercises.length} exercises`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
