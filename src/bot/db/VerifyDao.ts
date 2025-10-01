import type { Document } from "mongodb";
import { Mongo } from "./Mongo.js";

export type VerifyMethod = "captcha" | "button" | "passphrase" | "web";

export interface VerifyGuildConfig extends Document {
  _id: string;             // guildId
  guildId: string;
  enabled: boolean;
  channelId?: string | null;         // canal onde aparece o botão "Verificar"
  verifiedRoleId?: string | null;    // cargo aplicado ao concluir
  unverifiedRoleId?: string | null;  // cargo aplicado ao entrar (opcional)
  methods: VerifyMethod[];           // métodos permitidos
  passphrase?: string | null;        // se usar passphrase
  timeoutSec: number;                // tempo máx para completar (default 10m)
  maxAttempts: number;               // tentativas por usuário (default 3)
  // template de DM/boas-vindas (opcional)
  dmTemplate?: string | null;
}

export interface VerifySession extends Document {
  _id: string;             // `${guildId}:${userId}`
  guildId: string;
  userId: string;
  method?: VerifyMethod | null;
  expectedAnswer?: string | null;    // para captcha/passphrase
  token?: string | null;             // para web
  attempts: number;
  expiresAt: number;                 // epoch ms
  verifiedAt?: number | null;
}

function cfgCol()  { return Mongo.getDb().collection<VerifyGuildConfig>("verifier_cfg"); }
function sesCol()  { return Mongo.getDb().collection<VerifySession>("verifier_sessions"); }

export const VerifyDao = {
  async ensureIndexes() {
    await cfgCol().createIndex({ guildId: 1 }, { unique: true });
    await sesCol().createIndexes([
      { key: { guildId: 1, userId: 1 }, unique: true },
      { key: { expiresAt: 1 }, expireAfterSeconds: 0 }, // TTL: sessão expira
    ]);
  },

  async getCfg(guildId: string) {
    let doc = await cfgCol().findOne({ _id: guildId });
    if (!doc) {
      doc = {
        _id: guildId,
        guildId,
        enabled: false,
        methods: ["captcha", "button", "passphrase", "web"],
        timeoutSec: 600,
        maxAttempts: 3,
        channelId: null,
        verifiedRoleId: null,
        unverifiedRoleId: null,
        passphrase: null,
        dmTemplate: null,
      } as VerifyGuildConfig;
      await cfgCol().insertOne(doc);
    }
    return doc;
  },

  async setCfg(guildId: string, patch: Partial<VerifyGuildConfig>) {
    await cfgCol().updateOne({ _id: guildId }, { $set: { ...patch, guildId } }, { upsert: true });
    return cfgCol().findOne({ _id: guildId });
  },

  async upsertSession(guildId: string, userId: string, init: Partial<VerifySession>) {
    const _id = `${guildId}:${userId}`;
    const now = Date.now();
    await sesCol().updateOne(
      { _id },
      { $setOnInsert: { _id, guildId, userId, attempts: 0, verifiedAt: null }, $set: { ...init } },
      { upsert: true }
    );
    return sesCol().findOne({ _id });
  },

  async getSession(guildId: string, userId: string) {
    return sesCol().findOne({ _id: `${guildId}:${userId}` });
  },

  async setSession(guildId: string, userId: string, patch: Partial<VerifySession>) {
    await sesCol().updateOne({ _id: `${guildId}:${userId}` }, { $set: patch });
  },

  async clearSession(guildId: string, userId: string) {
    await sesCol().deleteOne({ _id: `${guildId}:${userId}` });
  },
};
