// src/db/ConvertJobDao.ts
import type { Document } from "mongodb";
import { Mongo } from "./Mongo.js";

export type ConvertStatus =
  | "created"
  | "uploading"
  | "queued"
  | "converting"
  | "finished"
  | "error"
  | "canceled";

export interface ConvertJobDoc extends Document {
  _id: string; // usamos o convertioId como _id
  convertioId: string;
  userId: string;
  guildId: string;
  input: string;
  outputFormat: string;
  status: ConvertStatus;
  resultUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

function col() {
  return Mongo.getDb().collection<ConvertJobDoc>("convert_jobs");
}

export const ConvertJobDao = {
  async create(p: {
    convertioId: string;
    userId: string;
    guildId: string;
    input: string;
    outputFormat: string;
    status: ConvertStatus;
  }): Promise<ConvertJobDoc> {
    const now = new Date();
    const doc: ConvertJobDoc = {
      _id: p.convertioId,
      convertioId: p.convertioId,
      userId: p.userId,
      guildId: p.guildId,
      input: p.input,
      outputFormat: p.outputFormat,
      status: p.status,
      createdAt: now,
      updatedAt: now,
    };
    await col().insertOne(doc);
    return doc;
  },

  async findById(convertioId: string): Promise<ConvertJobDoc | null> {
    return col().findOne({ _id: convertioId });
  },

  async updateStatus(
    convertioId: string,
    status: ConvertStatus,
    resultUrl?: string
  ): Promise<ConvertJobDoc | null> {
    const res = await col().findOneAndUpdate(
        { _id: convertioId },
        {
        $set: {
            status,
            ...(resultUrl ? { resultUrl } : {}),
            updatedAt: new Date(),
        },
        },
        { returnDocument: "after" }
    );

    // res pode ser null → precisamos verificar
    return res ? (res.value as ConvertJobDoc | null) : null;
    },

  async findMostRecentByUser(
    userId: string,
    guildId: string
  ): Promise<ConvertJobDoc | null> {
    return col()
      .find({ userId, guildId })
      .sort({ createdAt: -1 })
      .limit(1)
      .next();
  },

  async ensureIndexes() {
    await col().createIndexes([
      { key: { userId: 1, guildId: 1, createdAt: -1 } },
      { key: { status: 1, createdAt: -1 } },
      { key: { convertioId: 1 }, unique: true },
    ]);
  },
};
