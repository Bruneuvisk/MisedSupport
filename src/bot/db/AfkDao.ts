import type { Document } from "mongodb";
import { Mongo } from "./Mongo.js";

export interface AfkDoc extends Document {
  _id: string;           // `${guildId}:${userId}`
  guildId: string;
  userId: string;
  reason?: string;
  since: Date;
  // opcional: para tentar restaurar depois (se quiser usar)
  oldNick?: string | null;
}

function col() {
  return Mongo.getDb().collection<AfkDoc>("afk_status");
}

export const AfkDao = {
  async ensureIndexes() {
    await col().createIndexes([
      { key: { guildId: 1, userId: 1 }, unique: true },
      { key: { since: -1 } },
    ]);
  },

  async setAfk(guildId: string, userId: string, reason?: string, oldNick?: string | null) {
    const _id = `${guildId}:${userId}`;
    const doc: AfkDoc = {
      _id,
      guildId,
      userId,
      reason,
      since: new Date(),
      ...(oldNick !== undefined ? { oldNick } : {}),
    };
    await col().updateOne(
      { _id },
      { $set: doc },
      { upsert: true },
    );
    return doc;
  },

  async clearAfk(guildId: string, userId: string) {
    const _id = `${guildId}:${userId}`;
    const res = await col().findOneAndDelete({ _id });
    return res?.value ?? null; // retorna doc removido (para restaurar nick se quiser)
  },

  async getAfk(guildId: string, userId: string) {
    const _id = `${guildId}:${userId}`;
    return col().findOne({ _id });
  },

  async getManyAfk(guildId: string, userIds: string[]) {
    const ids = userIds.map(u => `${guildId}:${u}`);
    return col().find({ _id: { $in: ids } }).toArray();
  },
};
