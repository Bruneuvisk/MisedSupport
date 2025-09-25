// src/repos/backupRepo.ts
import { ObjectId } from "mongodb";
import { backups } from "../db/collections.js";
import type { BackupDoc } from "../../types.js";

export async function createBackup(doc: BackupDoc) {
  doc.createdAt = doc.createdAt ?? new Date();
  const res = await backups().insertOne(doc);
  return { ...doc, _id: res.insertedId };
}
export async function listBackups(guildId: string, limit = 15) {
  return backups().find({ guildId }).sort({ createdAt: -1 }).limit(limit).toArray();
}
export async function findBackupById(guildId: string, id: string) {
  return backups().findOne({ _id: new ObjectId(id), guildId });
}
export async function deleteBackup(guildId: string, id: string) {
  const res = await backups().deleteOne({ _id: new ObjectId(id), guildId });
  return res.deletedCount === 1;
}
