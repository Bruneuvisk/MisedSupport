import type { Document } from "mongodb";
import { Mongo } from "./Mongo.js";

export type Platform = "youtube" | "twitch";

export interface NotifyGuildConfig extends Document {
  _id: string;           // guildId
  guildId: string;
  channelId: string;     // canal onde notificar
  intervalSec: number;   // padrão 90s
  enabled: boolean;
  template?: string | null;     // ex.: "{name} postou: {title}\n{url}"
}

export interface NotifySubscription extends Document {
  _id: string;           // `${guildId}:${platform}:${sourceId}`
  guildId: string;
  platform: Platform;
  sourceId: string;      // youtube: channel_id | twitch: login ou user_id (ver provider)
  enabled: boolean;
  lastItemId?: string | null;     // id do último vídeo/stream notificado
  lastPublishedAt?: number | null;// timestamp ms
  customTemplate?: string | null;        // sobrescreve a do guild
  createdAt: Date;
  updatedAt: Date;
}

export interface TwitchTokenDoc extends Document {
  _id: "twitch";
  accessToken: string;
  expiresAt: number;     // epoch ms
}

function cfgCol()   { return Mongo.getDb().collection<NotifyGuildConfig>("notify_cfg"); }
function subCol()   { return Mongo.getDb().collection<NotifySubscription>("notify_subs"); }
function authCol()  { return Mongo.getDb().collection<TwitchTokenDoc>("notify_auth"); }

export const NotifyDao = {
  async ensureIndexes() {
    await cfgCol().createIndex({ guildId: 1 }, { unique: true });
    await subCol().createIndexes([
      { key: { guildId: 1, platform: 1, sourceId: 1 }, unique: true },
      { key: { guildId: 1, updatedAt: -1 } },
    ]);
  },

  // guild config
  async getGuildCfg(guildId: string) {
    let doc = await cfgCol().findOne({ _id: guildId });
    if (!doc) {
      doc = { _id: guildId, guildId, channelId: "", intervalSec: 90, enabled: false } as NotifyGuildConfig;
      await cfgCol().insertOne(doc);
    }
    return doc;
  },
  async setGuildCfg(guildId: string, patch: Partial<NotifyGuildConfig>) {
    await cfgCol().updateOne(
      { _id: guildId },
      { $set: { ...patch, guildId } },
      { upsert: true }
    );
    return cfgCol().findOne({ _id: guildId });
  },

  // subs
  async addSub(guildId: string, platform: Platform, sourceId: string) {
    const _id = `${guildId}:${platform}:${sourceId}`;
    const now = new Date();
    await subCol().updateOne(
      { _id },
      { $setOnInsert: { _id, guildId, platform, sourceId, enabled: true, createdAt: now }, $set: { updatedAt: now } },
      { upsert: true }
    );
    return subCol().findOne({ _id });
  },
  async listSubs(guildId: string) {
    return subCol().find({ guildId }).sort({ platform: 1, sourceId: 1 }).toArray();
  },
  async setSubEnabled(guildId: string, platform: Platform, sourceId: string, enabled: boolean) {
    await subCol().updateOne(
      { _id: `${guildId}:${platform}:${sourceId}` },
      { $set: { enabled, updatedAt: new Date() } }
    );
  },
  async setSubTemplate(guildId: string, platform: Platform, sourceId: string, template?: string) {
    await subCol().updateOne(
      { _id: `${guildId}:${platform}:${sourceId}` },
      { $set: { customTemplate: template ?? null, updatedAt: new Date() } }
    );
  },
  async removeSub(guildId: string, platform: Platform, sourceId: string) {
    await subCol().deleteOne({ _id: `${guildId}:${platform}:${sourceId}` });
  },
  async updateCheckpoint(id: string, lastItemId: string, lastPublishedAt?: number | null) {
    await subCol().updateOne(
      { _id: id },
      { $set: { lastItemId, lastPublishedAt: lastPublishedAt ?? null, updatedAt: new Date() } }
    );
  },

  // auth cache (twitch)
  async getTwitchToken() { return authCol().findOne({ _id: "twitch" }); },
  async setTwitchToken(token: TwitchTokenDoc) {
    await authCol().updateOne({ _id: "twitch" }, { $set: token }, { upsert: true });
  },
};
