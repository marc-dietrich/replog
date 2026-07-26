// src/db/dexie.js
//
// IndexedDB schema managed by Dexie.js.
// Tables:
//   groups     – exercise groups
//   exercises  – individual exercises
//   entries    – workout entries (sets) per exercise
//   syncQueue  – pending mutations not yet pushed to the backend

import Dexie from "dexie";
import config from "virtual:app-config";

const db = new Dexie(config.storage.dbName);

db.version(1).stores({
  groups: "&id, name, order",
  exercises: "&id, name, order, groupId",
  entries: "&id, date, exerciseId, [exerciseId+date]",
  syncQueue: "++localId, entityType, entityId, operation, timestamp",
});

export default db;
