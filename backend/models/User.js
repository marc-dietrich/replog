// backend/models/User.js
import mongoose from "mongoose";

const entrySchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    weight: { type: Number, required: true },
    reps: { type: Number, required: true },
    note: { type: String, default: "" },
  },
  { _id: false }
);

const exerciseSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    groupId: { type: String, default: null },
    order: { type: Number, default: 0 },
    entries: { type: [entrySchema], default: [] },
  },
  { _id: false }
);

const groupSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const settingsSchema = new mongoose.Schema(
  {
    exerciseViewMode: {
      type: String,
      enum: ["topSet", "volume", "sets"],
      default: "topSet",
    },
    setsDisplayMode: {
      type: String,
      enum: ["continuous", "discrete"],
      default: "continuous",
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    // For authenticated users: "google|<sub>" etc.
    // For guest sessions: "guest|<uuid>"
    sub: { type: String, required: true, unique: true, index: true },
    provider: {
      type: String,
      enum: ["guest", "google"],
      default: "guest",
    },
    email: { type: String, default: null },
    displayName: { type: String, default: null },
    exercises: { type: [exerciseSchema], default: [] },
    groups: { type: [groupSchema], default: [] },
    settings: { type: settingsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
