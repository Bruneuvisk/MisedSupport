import type { Document } from "mongodb";
import { Mongo } from "./Mongo.js";

export interface LogConfigDoc extends Document {
  _id: string;      // guildId
  guildId: string;
  channelId: string;
  enabled: boolean;
}

function col() {
  return Mongo.getDb().collection<LogConfigDoc>("log_config");
}

export const LogConfigDao = {
  async get(guildId: string) {
    return col().findOne({ _id: guildId });
  },
  async set(guildId: string, channelId: string, enabled: boolean) {
    const doc: LogConfigDoc = { _id: guildId, guildId, channelId, enabled };
    await col().updateOne({ _id: guildId }, { $set: doc }, { upsert: true });
    return doc;
  },
  async disable(guildId: string) {
    await col().updateOne({ _id: guildId }, { $set: { enabled: false } });
  },
};
