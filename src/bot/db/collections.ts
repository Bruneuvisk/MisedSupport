// src/db/collections.ts
import { Mongo } from "./Mongo.js";
import type { Collection, Db } from "mongodb";
import type { BackupDoc, BackupScheduleDoc } from "../../types.js";

export function getDb(): Db {
  return Mongo.getDb(); // vai lançar "Mongo não conectado" se não chamou connect()
}

export function backups(): Collection<BackupDoc> {
  return getDb().collection<BackupDoc>("backups");
}

export function backupSchedules(): Collection<BackupScheduleDoc> {
  return getDb().collection<BackupScheduleDoc>("backup_schedules");
}
