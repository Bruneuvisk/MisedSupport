import type { Document, WithId } from "mongodb";
import { Mongo } from "./Mongo.js";

export interface LevelUserDoc extends Document {
  _id: string;             // `${guildId}:${userId}`
  guildId: string;
  userId: string;
  xp: number;              // XP total acumulado
  level: number;           // nível atual
  lastMsgAt?: Date;        // opcional (telemetria)
}

export interface LevelConfigDoc extends Document {
  _id: string;             // guildId
  guildId: string;
  xpMin: number;           // mínimo por msg (default 15)
  xpMax: number;           // máximo por msg (default 25)
  cooldownSec: number;     // cooldown entre msgs que contam XP (default 60s)
  announceLevelUp: boolean;// anunciar level up no canal da msg (default true)
}

export interface LevelRewardDoc extends Document {
  _id: string;             // `${guildId}:${level}`
  guildId: string;
  level: number;
  roleId: string;
}

function usersCol()  { return Mongo.getDb().collection<LevelUserDoc>("lvl_users"); }
function cfgCol()    { return Mongo.getDb().collection<LevelConfigDoc>("lvl_config"); }
function rwdCol()    { return Mongo.getDb().collection<LevelRewardDoc>("lvl_rewards"); }

export const LevelingDao = {
  async ensureIndexes() {
    await usersCol().createIndexes([
      { key: { guildId: 1, xp: -1 } },
      { key: { guildId: 1, level: -1 } },
    ]);
    await cfgCol().createIndex({ guildId: 1 }, { unique: true });
    await rwdCol().createIndexes([
      { key: { guildId: 1, level: 1 }, unique: true },
      { key: { guildId: 1, roleId: 1 } },
    ]);
  },

  // ===== Users =====
  async getUser(guildId: string, userId: string) {
    return usersCol().findOne({ _id: `${guildId}:${userId}` });
  },

  async upsertUser(guildId: string, userId: string, patch: Partial<LevelUserDoc>) {
    const _id = `${guildId}:${userId}`;
    const now = new Date();
    await usersCol().updateOne(
      { _id },
      { $setOnInsert: { _id, guildId, userId, xp: 0, level: 0 }, $set: { ...patch, lastMsgAt: now } },
      { upsert: true }
    );
    return usersCol().findOne({ _id });
  },

  async setUser(guildId: string, userId: string, data: Partial<LevelUserDoc>) {
    const _id = `${guildId}:${userId}`;
    await usersCol().updateOne({ _id }, { $set: data });
    return usersCol().findOne({ _id });
  },

  async top(guildId: string, limit = 10) {
    return usersCol().find({ guildId }).sort({ xp: -1 }).limit(limit).toArray();
  },

  // ===== Config =====
  async getConfig(guildId: string) {
    const cfg = await cfgCol().findOne({ _id: guildId });
    if (cfg) return cfg;
    const def: LevelConfigDoc = {
      _id: guildId,
      guildId,
      xpMin: 15,
      xpMax: 25,
      cooldownSec: 60,
      announceLevelUp: true,
    };
    await cfgCol().insertOne(def);
    return def;
  },

  async setConfig(guildId: string, patch: Partial<LevelConfigDoc>) {
    await cfgCol().updateOne({ _id: guildId }, { $set: { ...patch, guildId } }, { upsert: true });
    return cfgCol().findOne({ _id: guildId });
  },

  // ===== Rewards =====
  async listRewards(guildId: string) {
    return rwdCol().find({ guildId }).sort({ level: 1 }).toArray();
  },

  async setReward(guildId: string, level: number, roleId: string) {
    const _id = `${guildId}:${level}`;
    await rwdCol().updateOne({ _id }, { $set: { _id, guildId, level, roleId } }, { upsert: true });
    return rwdCol().findOne({ _id });
  },

  async deleteReward(guildId: string, level: number) {
    const _id = `${guildId}:${level}`;
    await rwdCol().deleteOne({ _id });
  },
};
