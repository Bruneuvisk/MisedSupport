import { Mongo } from "../../db/Mongo.js";
import type { Collection } from "mongodb";
import type { NameCategoryConfig } from "./types.js";

export function namesConfig(): Collection<NameCategoryConfig> {
  const db = Mongo.getDb();
  return db.collection<NameCategoryConfig>("names_config");
}
