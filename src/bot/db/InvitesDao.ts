import type { Document } from "mongodb";
import { Mongo } from "./Mongo.js";

export interface InviteStatDoc extends Document {
  _id: string;               // `${guildId}:${userId}`
  guildId: string;
  userId: string;            // convidador
  regular: number;           // entradas legítimas via link
  bonus: number;             // bônus manual
  leaves: number;            // membros convidados que saíram
  fake: number;              // se quiser marcar “fake/duvidoso”
  updatedAt: Date;
}

export interface InviteJoinDoc extends Document {
  _id: string;               // `${guildId}:${memberId}`
  guildId: string;
  memberId: string;          // novo membro
  inviterId: string | null;  // quem convidou (pode ser null = desconhecido/vanity)
  code?: string | null;      // código usado (se souber)
  joinedAt: Date;
}

export interface InviteSnapshotDoc extends Document {
  _id: string;               // `${guildId}:${code}`
  guildId: string;
  code: string;
  inviterId: string | null;  // dono do invite
  uses: number;              // uses atuais (snapshot)
  maxUses?: number | null;
  createdTimestamp?: number | null;
  updatedAt: Date;
}

function statsCol() { return Mongo.getDb().collection<InviteStatDoc>("inv_stats"); }
function joinsCol() { return Mongo.getDb().collection<InviteJoinDoc>("inv_joins"); }
function snapCol()  { return Mongo.getDb().collection<InviteSnapshotDoc>("inv_snap"); }

export const InvitesDao = {
  async ensureIndexes() {
    await statsCol().createIndexes([
      { key: { guildId: 1, userId: 1 }, unique: true },
      { key: { guildId: 1, regular: -1 } },
    ]);
    await joinsCol().createIndexes([
      { key: { guildId: 1, memberId: 1 }, unique: true },
      { key: { guildId: 1, inviterId: 1 } },
    ]);
    await snapCol().createIndexes([
      { key: { guildId: 1, code: 1 }, unique: true },
      { key: { guildId: 1, inviterId: 1 } },
    ]);
  },

  // ===== stats
  async getStats(guildId: string, userId: string) {
    return statsCol().findOne({ _id: `${guildId}:${userId}` });
  },
  async upsertStats(guildId: string, userId: string, patch: Partial<InviteStatDoc>) {
    const _id = `${guildId}:${userId}`;
    await statsCol().updateOne(
      { _id },
      { $setOnInsert: { _id, guildId, userId, regular: 0, bonus: 0, leaves: 0, fake: 0 }, $set: { ...patch, updatedAt: new Date() } },
      { upsert: true }
    );
    return statsCol().findOne({ _id });
  },
  async incRegular(guildId: string, userId: string, by = 1) {
    const _id = `${guildId}:${userId}`;
    await statsCol().updateOne(
      { _id },
      { $setOnInsert: { _id, guildId, userId, regular: 0, bonus: 0, leaves: 0, fake: 0 }, $inc: { regular: by }, $set: { updatedAt: new Date() } },
      { upsert: true }
    );
  },
  async incLeaves(guildId: string, userId: string, by = 1) {
    await statsCol().updateOne({ _id: `${guildId}:${userId}` }, { $inc: { leaves: by }, $set: { updatedAt: new Date() } }, { upsert: true });
  },
  async incBonus(guildId: string, userId: string, by = 1) {
    await statsCol().updateOne({ _id: `${guildId}:${userId}` }, { $inc: { bonus: by }, $set: { updatedAt: new Date() } }, { upsert: true });
  },
  async top(guildId: string, limit = 10) {
    return statsCol().find({ guildId }).sort({ regular: -1, bonus: -1 }).limit(limit).toArray();
  },

  // ===== joins
  async setJoin(guildId: string, memberId: string, inviterId: string | null, code?: string | null) {
    const _id = `${guildId}:${memberId}`;
    await joinsCol().updateOne(
      { _id },
      { $set: { _id, guildId, memberId, inviterId, code: code ?? null, joinedAt: new Date() } },
      { upsert: true }
    );
  },
  async getJoin(guildId: string, memberId: string) {
    return joinsCol().findOne({ _id: `${guildId}:${memberId}` });
  },

  // ===== snapshots
  async setSnapshot(guildId: string, code: string, data: Omit<InviteSnapshotDoc, "_id" | "guildId" | "code" | "updatedAt"> & { uses: number }) {
    const _id = `${guildId}:${code}`;
    await snapCol().updateOne(
      { _id },
      { $set: { _id, guildId, code, ...data, updatedAt: new Date() } },
      { upsert: true }
    );
  },
  async getAllSnapshots(guildId: string) {
    return snapCol().find({ guildId }).toArray();
  },
};
