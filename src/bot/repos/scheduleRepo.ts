// src/repos/scheduleRepo.ts
import { backupSchedules } from "../db/collections.js";
import type { BackupScheduleDoc } from "../../types.js";

export async function upsertSchedule(input: BackupScheduleDoc) {
  await backupSchedules().updateOne(
    { guildId: input.guildId },
    { $set: input },
    { upsert: true }
  );
  return backupSchedules().findOne({ guildId: input.guildId });
}

export async function getSchedule(guildId: string) {
  return backupSchedules().findOne({ guildId });
}

export async function listEnabledSchedules() {
  return backupSchedules().find({ enabled: true }).toArray();
}
