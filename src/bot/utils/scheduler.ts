// src/utils/scheduler.ts
import { Client, Guild } from "discord.js";
import { listEnabledSchedules } from "../repos/scheduleRepo.js";
import { createBackup } from "../repos/backupRepo.js";
import { snapshotGuild } from "./snapshot.js";
import { Mongo } from "../db/Mongo.js";

const RUN_EVERY_MS = 60_000;

export function startBackupScheduler(client: Client) {
  setInterval(async () => {
    try {
      // se DB ainda não conectou, apenas sai
      try { Mongo.getDb(); } catch { return; }

      const all = await listEnabledSchedules();
      const now = new Date();
      const hourUTC = now.getUTCHours();
      const weekdayUTC = now.getUTCDay();

      for (const sch of all) {
        const guild = client.guilds.cache.get(sch.guildId);
        if (!guild) continue;

        if (sch.interval === "hourly") {
          await runOne(guild, sch.label ?? "auto-hourly");
        } else if (sch.interval === "daily") {
          if (sch.hourUTC === hourUTC) await runOne(guild, sch.label ?? "auto-daily");
        } else if (sch.interval === "weekly") {
          if (sch.weekdayUTC === weekdayUTC && sch.hourUTC === hourUTC) {
            await runOne(guild, sch.label ?? "auto-weekly");
          }
        }
      }
    } catch (e) {
      console.error("[scheduler] error:", e);
    }
  }, RUN_EVERY_MS);
}

async function runOne(guild: Guild, label: string) {
  const snap = await snapshotGuild(guild, label);
  await createBackup({
    guildId: guild.id,
    createdBy: "system",
    label,
    snapshot: snap,
    createdAt: new Date()
  });
}
